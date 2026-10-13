import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { passwordResetEmail, sendMail, welcomeEmail } from '../services/mail.service';

const generateTokens = (userId: string) => {
  const accessOptions: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'] };
  const refreshOptions: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'] };
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET! as Secret,
    accessOptions
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET! as Secret,
    refreshOptions
  );
  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, orgName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'ADMIN',
          orgId: org.id,
        },
        select: { id: true, name: true, email: true, role: true, orgId: true },
      });

      return { user, org };
    });

    const tokens = generateTokens(result.user.id);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: result.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login`;
    sendMail({
      to: result.user.email,
      subject: `Welcome to ${result.org.name}`,
      ...welcomeEmail({ name: result.user.name, loginUrl, orgName: result.org.name }),
    }).catch(error => console.error('Welcome email failed:', error.message));

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: result.user,
        organization: result.org,
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { id: true, name: true, slug: true, plan: true, logo: true } } },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const tokens = generateTokens(user.id);

    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          orgId: user.orgId,
        },
        organization: user.organization,
        ...tokens,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Delete old token and issue new ones
    await prisma.refreshToken.delete({ where: { token: refreshToken } });

    const tokens = generateTokens(decoded.userId);
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: decoded.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, data: tokens });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user?.isActive) {
      const token = jwt.sign(
        { userId: user.id, purpose: 'password-reset' },
        process.env.JWT_REFRESH_SECRET! as Secret,
        { expiresIn: '30m' }
      );
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login?resetToken=${encodeURIComponent(token)}`;
      const emailBody = passwordResetEmail({ name: user.name, resetUrl });
      await sendMail({
        to: user.email,
        subject: 'Reset your WACrm Pro password',
        ...emailBody,
      }).catch(err => {
        console.warn('SMTP send failed (check backend/.env SMTP settings):', err.message);
      });
    }

    res.json({ success: true, message: 'If that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any;
    if (decoded.purpose !== 'password-reset' || !decoded.userId) {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashed },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: decoded.userId } });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Reset link is invalid or expired' });
  }
};

export const getMe = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        phone: true, isActive: true, lastLoginAt: true, createdAt: true,
        orgId: true,
        organization: { select: { id: true, name: true, slug: true, plan: true, logo: true, settings: true } },
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};
