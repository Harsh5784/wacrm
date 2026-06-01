"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMailConfigured = isMailConfigured;
exports.sendMail = sendMail;
exports.invitationEmail = invitationEmail;
exports.passwordResetEmail = passwordResetEmail;
exports.welcomeEmail = welcomeEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const SMTP_HOST = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.zoho.in';
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || process.env.MAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.MAIL_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.MAIL_FROM || SMTP_USER;
const SMTP_SECURE = (process.env.SMTP_SECURE || process.env.MAIL_SECURE || '').toLowerCase() === 'true' ||
    SMTP_PORT === 465;
const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
function isMailConfigured() {
    return Boolean(SMTP_HOST && SMTP_FROM && SMTP_USER && SMTP_PASS);
}
async function sendMail(options) {
    if (!isMailConfigured()) {
        console.warn(`[Mail] SMTP not configured. Skipping email to ${options.to}: ${options.subject}`);
        return { sent: false, skipped: true };
    }
    const transporter = nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
    });
    const attempts = Number(process.env.SMTP_RETRY_ATTEMPTS || 3);
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const info = await transporter.sendMail({
                from: SMTP_FROM,
                to: options.to,
                subject: options.subject.replace(/\r?\n/g, ' ').trim(),
                text: options.text,
                html: options.html || `<p>${escapeHtml(options.text).replace(/\n/g, '<br />')}</p>`,
            });
            console.info(`[Mail] Sent ${info.messageId} to ${options.to} via ${SMTP_HOST}:${SMTP_PORT}`);
            return { sent: true, skipped: false, messageId: info.messageId };
        }
        catch (error) {
            lastError = error;
            console.error(`[Mail] Attempt ${attempt}/${attempts} failed for ${options.to} via ${SMTP_HOST}:${SMTP_PORT}`, {
                code: error?.code,
                command: error?.command,
                message: error?.message,
            });
            if (attempt < attempts) {
                await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            }
        }
    }
    throw lastError;
}
function invitationEmail(params) {
    const org = params.orgName || 'WACrm Pro';
    const text = [
        `Hi ${params.name},`,
        '',
        `You have been invited to ${org}.`,
        `Login: ${params.loginUrl}`,
        `Email: ${params.email}`,
        `Temporary password: ${params.password}`,
        '',
        'Please sign in and change your password from Settings.',
    ].join('\n');
    return {
        text,
        html: `
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>You have been invited to <strong>${escapeHtml(org)}</strong>.</p>
      <p><a href="${escapeHtml(params.loginUrl)}">Open WACrm Pro</a></p>
      <p><strong>Email:</strong> ${escapeHtml(params.email)}<br /><strong>Temporary password:</strong> ${escapeHtml(params.password)}</p>
      <p>Please sign in and change your password from Settings.</p>
    `,
    };
}
function passwordResetEmail(params) {
    const text = [
        `Hi ${params.name},`,
        '',
        'Use the link below to reset your WACrm Pro password. This link expires in 30 minutes.',
        params.resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
    ].join('\n');
    return {
        text,
        html: `
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>Use the link below to reset your WACrm Pro password. This link expires in 30 minutes.</p>
      <p><a href="${escapeHtml(params.resetUrl)}">Reset password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
    };
}
function welcomeEmail(params) {
    const org = params.orgName || 'WACrm Pro';
    const text = [
        `Hi ${params.name},`,
        '',
        `Welcome to ${org}. Your CRM workspace is ready.`,
        `Login: ${params.loginUrl}`,
        '',
        'You can now manage leads, WhatsApp conversations, campaigns, and AI-assisted follow-ups from one place.',
    ].join('\n');
    return {
        text,
        html: `
      <p>Hi ${escapeHtml(params.name)},</p>
      <p>Welcome to <strong>${escapeHtml(org)}</strong>. Your CRM workspace is ready.</p>
      <p><a href="${escapeHtml(params.loginUrl)}">Open your CRM</a></p>
      <p>You can now manage leads, WhatsApp conversations, campaigns, and AI-assisted follow-ups from one place.</p>
    `,
    };
}
//# sourceMappingURL=mail.service.js.map