type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const OTP_SERVICE_URL = (process.env.OTP_SERVICE_URL || 'https://otpservice.crowncraftinnovations.in').replace(/\/$/, '');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function isMailConfigured() {
  return Boolean(process.env.OTP_SERVICE_API_KEY);
}

export async function sendMail(options: MailOptions) {
  if (!isMailConfigured()) {
    throw new Error('OTP email service is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${OTP_SERVICE_URL}/api/emails/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.OTP_SERVICE_API_KEY!,
      },
      body: JSON.stringify({
        to: options.to,
        subject: options.subject.replace(/\r?\n/g, ' ').trim(),
        text: options.text,
        html: options.html || `<p>${escapeHtml(options.text).replace(/\n/g, '<br />')}</p>`,
      }),
      signal: controller.signal,
    });

    if (response.status !== 202) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`OTP email service rejected the message (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
    }

    const result = await response.json() as { messageId?: string };
    console.info(`[Mail] Accepted by OTP service for ${options.to}`);
    return { sent: true, skipped: false, messageId: result.messageId };
  } catch (error: any) {
    console.error(`[Mail] OTP service request failed for ${options.to}:`, error?.message || error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function invitationEmail(params: { name: string; email: string; password: string; loginUrl: string; orgName?: string }) {
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

export function passwordResetEmail(params: { name: string; resetUrl: string }) {
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

export function welcomeEmail(params: { name: string; loginUrl: string; orgName?: string }) {
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
