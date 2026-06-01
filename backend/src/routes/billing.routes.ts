import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticate);

const PLAN_PRICES: Record<string, number> = {
  STARTER: 99900,
  PROFESSIONAL: 249900,
  ENTERPRISE: 999900,
};

function paymentDelegate(res: any) {
  const payment = (prisma as any).payment;
  if (!payment) {
    res.status(503).json({
      success: false,
      message: 'Billing database client is not ready. Run `npx prisma generate` in backend and restart the server.',
    });
    return null;
  }
  return payment;
}

function isMissingPaymentTable(error: any) {
  return error?.code === 'P2021' && String(error?.meta?.table || '').includes('payments');
}

function missingPaymentTableResponse(res: any, success = false) {
  return res.status(success ? 200 : 503).json({
    success,
    data: [],
    message: 'Billing payments table is missing. Run `npx prisma migrate deploy` in backend, then restart the server.',
  });
}

function requireAdmin(req: AuthRequest, res: any) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return false;
  }
  return true;
}

function requireSuperAdmin(req: AuthRequest, res: any) {
  if (req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, message: 'Super admin access required' });
    return false;
  }
  return true;
}

router.get('/plans', async (_req, res) => {
  const globalSettings = await prisma.organization.findFirst({
    where: { slug: 'system' },
    select: { settings: true },
  }).catch(() => null);
  const pricing = ((globalSettings?.settings as any)?.pricing || {}) as Record<string, number>;
  res.json({
    success: true,
    data: [
      { plan: 'FREE', amount: 0, currency: 'INR', features: ['Basic CRM', 'Manual leads'] },
      { plan: 'STARTER', amount: pricing.STARTER || PLAN_PRICES.STARTER, currency: 'INR', features: ['Campaigns', 'Lead scraper', 'WhatsApp inbox'] },
      { plan: 'PROFESSIONAL', amount: pricing.PROFESSIONAL || PLAN_PRICES.PROFESSIONAL, currency: 'INR', features: ['AI campaigns', 'Team workflows', 'Advanced analytics'] },
      { plan: 'ENTERPRISE', amount: pricing.ENTERPRISE || PLAN_PRICES.ENTERPRISE, currency: 'INR', features: ['Higher usage', 'Priority support', 'Manual plan controls'] },
    ],
  });
});

router.get('/payments', async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const payment = paymentDelegate(res);
  if (!payment) return;
  try {
    const payments = await payment.findMany({
      where: { orgId: req.user!.orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: payments });
  } catch (error: any) {
    if (isMissingPaymentTable(error)) return missingPaymentTableResponse(res, true);
    throw error;
  }
});

router.post('/orders', async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const plan = String(req.body.plan || '').toUpperCase();
  const globalSettings = await prisma.organization.findFirst({
    where: { slug: 'system' },
    select: { settings: true },
  }).catch(() => null);
  const pricing = ((globalSettings?.settings as any)?.pricing || {}) as Record<string, number>;
  const amount = pricing[plan] || PLAN_PRICES[plan];
  if (!amount) return res.status(400).json({ success: false, message: 'Select a paid plan' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(400).json({ success: false, message: 'Razorpay keys are not configured' });
  }

  const payment = paymentDelegate(res);
  if (!payment) return;
  try {
    await payment.count();
  } catch (error: any) {
    if (isMissingPaymentTable(error)) return missingPaymentTableResponse(res);
    throw error;
  }

  const receipt = `wacrm_${Date.now()}`;
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, currency: 'INR', receipt, notes: { orgId: req.user!.orgId, plan } }),
  });
  const order = await response.json() as any;
  if (!response.ok) return res.status(400).json({ success: false, message: order?.error?.description || 'Failed to create Razorpay order' });

  const createdPayment = await payment.create({
    data: {
      orgId: req.user!.orgId,
      amount,
      plan: plan as any,
      razorpayOrderId: order.id,
      notes: { receipt },
    },
  });

  res.json({ success: true, data: { keyId, order, payment: createdPayment } });
});

router.post('/verify', async (req: AuthRequest, res) => {
  if (!requireAdmin(req, res)) return;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return res.status(400).json({ success: false, message: 'Razorpay secret is not configured' });

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) return res.status(400).json({ success: false, message: 'Payment signature mismatch' });

  const payment = paymentDelegate(res);
  if (!payment) return;
  let updatedPayment: any;
  let paid: any;
  try {
    updatedPayment = await payment.updateMany({
      where: { orgId: req.user!.orgId, razorpayOrderId: razorpay_order_id },
      data: { status: 'PAID', razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature },
    });
    paid = await payment.findFirst({ where: { orgId: req.user!.orgId, razorpayOrderId: razorpay_order_id } });
  } catch (error: any) {
    if (isMissingPaymentTable(error)) return missingPaymentTableResponse(res);
    throw error;
  }
  if (paid) {
    await prisma.organization.update({
      where: { id: req.user!.orgId },
      data: { plan: paid.plan, planExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
  }

  res.json({ success: true, data: { updated: updatedPayment.count, plan: paid?.plan } });
});

router.get('/admin/organizations', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const include: any = { _count: { select: { users: true, leads: true, campaigns: true } } };
  if ((prisma as any).payment) include._count.select.payments = true;
  let orgs;
  try {
    orgs = await prisma.organization.findMany({
      where: { slug: { not: 'system' } },
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  } catch (error: any) {
    if (isMissingPaymentTable(error)) {
      delete include._count.select.payments;
      orgs = await prisma.organization.findMany({
        where: { slug: { not: 'system' } },
        include,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    } else {
      throw error;
    }
  }
  res.json({ success: true, data: orgs });
});

router.get('/admin/organizations/:id/users', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const users = await prisma.user.findMany({
    where: { orgId: req.params.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ success: true, data: users });
});

router.put('/admin/users/:id', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(req.body.role ? { role: req.body.role } : {}),
      ...(req.body.isActive !== undefined ? { isActive: Boolean(req.body.isActive) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user.isActive) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  }
  res.json({ success: true, data: user });
});

router.put('/admin/organizations/:id/settings', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const existing = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { settings: true } });
  if (!existing) return res.status(404).json({ success: false, message: 'Organization not found' });
  const current = ((existing.settings as any) || {});
  const settings = {
    ...current,
    limits: {
      ...(current.limits || {}),
      ...((req.body.limits as any) || {}),
    },
    features: {
      ...(current.features || {}),
      ...((req.body.features as any) || {}),
    },
  };
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: { settings },
  });
  res.json({ success: true, data: org });
});

router.put('/admin/pricing', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const pricing = {
    STARTER: Math.max(Number(req.body.STARTER || PLAN_PRICES.STARTER), 0),
    PROFESSIONAL: Math.max(Number(req.body.PROFESSIONAL || PLAN_PRICES.PROFESSIONAL), 0),
    ENTERPRISE: Math.max(Number(req.body.ENTERPRISE || PLAN_PRICES.ENTERPRISE), 0),
  };
  const system = await prisma.organization.upsert({
    where: { slug: 'system' },
    update: { settings: { pricing } },
    create: { name: 'System Settings', slug: 'system', settings: { pricing } },
  });
  res.json({ success: true, data: { pricing, systemId: system.id } });
});

router.put('/admin/organizations/:id/plan', async (req: AuthRequest, res) => {
  if (!requireSuperAdmin(req, res)) return;
  const plan = String(req.body.plan || '').toUpperCase();
  if (!['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ success: false, message: 'Invalid plan' });
  }
  const org = await prisma.organization.update({
    where: { id: req.params.id },
    data: {
      plan: plan as any,
      planExpiry: req.body.planExpiry ? new Date(req.body.planExpiry) : null,
    },
  });
  const payment = (prisma as any).payment;
  if (payment) {
    await payment.create({
      data: {
        orgId: org.id,
        amount: 0,
        plan: plan as any,
        status: 'MANUAL',
        notes: { changedBy: req.user!.id, reason: req.body.reason || 'Manual super admin change' },
      },
    }).catch((error: any) => {
      if (!isMissingPaymentTable(error)) throw error;
    });
  }
  res.json({ success: true, data: org });
});

export default router;
