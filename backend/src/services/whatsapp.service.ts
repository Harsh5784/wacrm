import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { prisma } from '../lib/prisma';

type SendResult = { success: boolean; messageId?: string; error?: string };

type WhatsAppClient = {
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
  sendMessage: (chatId: string, message: any, options?: any) => Promise<{ id?: { _serialized?: string } }>;
  getNumberId?: (phone: string) => Promise<{ _serialized?: string; user?: string } | null>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  info?: { wid?: { user?: string } };
};

const clients = new Map<string, WhatsAppClient>();
const readyClients = new Set<string>();
let ioServer: Server | null = null;
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

function loadWhatsAppWeb() {
  try {
    // Optional at runtime so the backend can return a clear API error if
    // dependencies have not been installed yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('whatsapp-web.js') as any;
  } catch {
    throw new Error('WhatsApp Web dependency is missing. Run `npm install` in backend and restart the server.');
  }
}

function normalizeIndianPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `91${digits.slice(1)}`;
  return digits;
}

function phoneFromChatId(chatId: string) {
  return String(chatId || '').split('@')[0].replace(/\D/g, '');
}

async function phoneFromMessage(message: any) {
  const candidates = [
    message?._data?.from?.user,
    message?._data?.id?.remote,
    message?.from,
    message?.author,
  ].filter(Boolean);

  if (typeof message?.getContact === 'function') {
    const contact = await message.getContact().catch(() => null);
    if (contact?.number) candidates.unshift(contact.number);
    if (contact?.id?._serialized) candidates.unshift(contact.id._serialized);
  }

  for (const candidate of candidates) {
    const phone = phoneFromChatId(String(candidate));
    if (phone.length >= 10 && phone.length <= 15) return phone;
  }
  return '';
}

async function pickExecutive(orgId: string) {
  const members = await prisma.user.findMany({
    where: { orgId, isActive: true, role: { in: ['ADMIN', 'MANAGER', 'MEMBER'] } },
    select: { id: true, _count: { select: { assignedLeads: true } } },
    orderBy: { assignedLeads: { _count: 'asc' } },
    take: 1,
  });
  return members[0]?.id || null;
}

async function resolveChatId(client: WhatsAppClient, phone: string) {
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return null;
  if (client.getNumberId) {
    const numberId = await client.getNumberId(normalizedPhone).catch(() => null);
    if (numberId?._serialized) return numberId._serialized;
  }
  return `${normalizedPhone}@c.us`;
}

function mediaTypeFromMessage(message: any) {
  if (message.type === 'image') return 'IMAGE';
  if (message.type === 'audio' || message.type === 'ptt') return 'AUDIO';
  if (message.type === 'video') return 'VIDEO';
  if (message.type === 'document') return 'DOCUMENT';
  return 'TEXT';
}

function isStatusOrBroadcastMessage(message: any) {
  const candidates = [
    message?.from,
    message?.to,
    message?.author,
    message?._data?.from,
    message?._data?.to,
    message?._data?.id?.remote,
    message?.id?.remote,
  ].filter(Boolean).map((value) => String(value));

  return Boolean(
    message?.isStatus ||
    message?._data?.isStatus ||
    candidates.some((value) => value === 'status@broadcast' || value.endsWith('@broadcast') || value.includes('status@broadcast'))
  );
}

function isInboxMessage(message: any) {
  if (isStatusOrBroadcastMessage(message)) return false;
  if (message.fromMe || message.from?.endsWith('@g.us') || message.from?.endsWith('@newsletter')) return false;
  return ['chat', 'image'].includes(message.type);
}

function localUploadPathFromUrl(mediaUrl: string) {
  try {
    const parsed = new URL(mediaUrl);
    const marker = '/uploads/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const filename = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    const resolved = path.resolve(uploadDir, filename);
    return resolved.startsWith(uploadDir) ? resolved : null;
  } catch {
    const marker = '/uploads/';
    const index = mediaUrl.indexOf(marker);
    if (index === -1) return null;
    const filename = decodeURIComponent(mediaUrl.slice(index + marker.length));
    const resolved = path.resolve(uploadDir, filename);
    return resolved.startsWith(uploadDir) ? resolved : null;
  }
}

async function saveInboundImage(message: any) {
  if (message.type !== 'image' || typeof message.downloadMedia !== 'function') return null;
  const media = await message.downloadMedia().catch(() => null);
  if (!media?.data || !media?.mimetype) return null;

  await fs.promises.mkdir(uploadDir, { recursive: true });
  const extension = media.mimetype.split('/')[1]?.split(';')[0] || 'jpg';
  const fileName = `${Date.now()}-${message.id?.id || 'whatsapp-image'}.${extension.replace(/[^a-zA-Z0-9]/g, '')}`;
  await fs.promises.writeFile(path.join(uploadDir, fileName), Buffer.from(media.data, 'base64'));
  const baseUrl = process.env.BACKEND_PUBLIC_URL || '';
  return {
    mediaUrl: baseUrl ? `${baseUrl}/uploads/${fileName}` : `/uploads/${fileName}`,
    fileName,
    mimeType: media.mimetype,
  };
}

async function findOrCreateWhatsAppLead(orgId: string, phone: string, name?: string | null) {
  const normalizedPhone = normalizeIndianPhone(phone);
  const last10 = normalizedPhone.slice(-10);
  const existing = await prisma.lead.findFirst({
    where: {
      orgId,
      OR: [
        { phone: { contains: normalizedPhone } },
        { phone: { contains: last10 } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (existing) return existing;

  return prisma.lead.create({
    data: {
      name: name || `WhatsApp ${normalizedPhone.slice(-10)}`,
      phone: normalizedPhone,
      source: 'WHATSAPP',
      orgId,
      customerStatus: 'NEW_LEAD',
      customFields: { autoCreatedFrom: 'whatsapp', whatsappPhone: normalizedPhone },
    },
  });
}

function emitSession(orgId: string, sessionId: string, status: string, qrCode?: string | null) {
  ioServer?.to(`org:${orgId}`).emit('whatsapp:session', { id: sessionId, status, qrCode });
}

export async function initializeWhatsAppService(io: Server) {
  ioServer = io;

  const sessions = await prisma.whatsAppSession.findMany({
    where: { status: { in: ['CONNECTED', 'SCANNING', 'WARMING_UP'] } },
    select: { id: true, orgId: true },
  });

  for (const session of sessions) {
    initializeWhatsAppSession(session.id, session.orgId).catch(error => {
      console.error(`[WhatsApp] Failed to restore session ${session.id}:`, error.message);
    });
  }
}

export async function initializeWhatsAppSession(sessionId: string, orgId: string) {
  if (clients.has(sessionId)) return;

  const { Client, LocalAuth } = loadWhatsAppWeb();
  await new Promise(resolve => setTimeout(resolve, 3000));
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: sessionId,
      dataPath: process.env.WHATSAPP_SESSION_PATH || '/app/.wwebjs_auth',
    }),
    puppeteer: {
      executablePath: '/usr/bin/chromium',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    },
  }) as WhatsAppClient;

  clients.set(sessionId, client);

  client.on('qr', async (qrCode: string) => {
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { status: 'SCANNING', qrCode },
    });
    emitSession(orgId, sessionId, 'SCANNING', qrCode);
  });

  client.on('ready', async () => {
    readyClients.add(sessionId);
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: {
        status: 'CONNECTED',
        qrCode: null,
        phone: client.info?.wid?.user || null,
      },
    });
    emitSession(orgId, sessionId, 'CONNECTED', null);
  });

  client.on('message', async (message: any) => {
    try {
      if (!isInboxMessage(message)) return;

      const phone = await phoneFromMessage(message);
      if (!phone) return;
      const lead = await findOrCreateWhatsAppLead(orgId, phone, message._data?.notifyName || message.notifyName);
      const assignedToId = lead.assignedToId || await pickExecutive(orgId);
      const content = message.body || message.caption || `[${message.type || 'media'}]`;
      const mediaType = mediaTypeFromMessage(message);
      const messageId = message.id?._serialized || undefined;
      if (messageId) {
        const exists = await prisma.message.findFirst({ where: { messageId } });
        if (exists) return;
      }

      const inboundImage = await saveInboundImage(message);
      const saved = await prisma.message.create({
        data: {
          direction: 'INBOUND',
          content,
          status: 'REPLIED',
          mediaType: mediaType as any,
          mediaUrl: inboundImage?.mediaUrl || null,
          fileName: inboundImage?.fileName || null,
          mimeType: inboundImage?.mimeType || null,
          messageId,
          leadId: lead.id,
          metadata: {
            sessionId,
            from: message.from,
            type: message.type,
            hasMedia: Boolean(message.hasMedia),
          },
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
      data: {
        lastRepliedAt: new Date(),
          unreadCount: { increment: 1 },
          customerStatus: 'FOLLOW_UP_PENDING',
          stage: lead.stage === 'NEW' ? 'CONTACTED' : lead.stage,
          assignedToId,
          customFields: {
            ...((lead.customFields as any) || {}),
            replyState: 'Customer replied - follow-up pending',
            whatsappPhone: normalizeIndianPhone(phone),
            lastInboundSessionId: sessionId,
          },
        },
      });

      await prisma.activity.create({
        data: {
          type: 'MESSAGE_RECEIVED',
          description: 'Customer replied - follow-up pending',
          leadId: lead.id,
          metadata: { messageId: saved.id, sessionId },
        },
      });

      ioServer?.to(`org:${orgId}`).emit('whatsapp:message', { leadId: lead.id, message: saved });
      ioServer?.to(`org:${orgId}`).emit('lead:updated', { leadId: lead.id });
    } catch (error: any) {
      console.error(`[WhatsApp] Failed to persist inbound message for ${sessionId}:`, error.message);
    }
  });

  client.on('message_ack', async (message: any, ack: number) => {
    try {
      const status = ack >= 3 ? 'READ' : ack >= 2 ? 'DELIVERED' : ack >= 1 ? 'SENT' : undefined;
      if (!status) return;

      const updated = await prisma.message.updateMany({
        where: { messageId: message.id?._serialized },
        data: {
          status: status as any,
          deliveredAt: ack >= 2 ? new Date() : undefined,
          readAt: ack >= 3 ? new Date() : undefined,
        },
      });

      if (updated.count) {
        ioServer?.to(`org:${orgId}`).emit('whatsapp:ack', {
          messageId: message.id?._serialized,
          status,
        });
      }
    } catch (error: any) {
      console.error(`[WhatsApp] Failed to update message ack for ${sessionId}:`, error.message);
    }
  });

  client.on('authenticated', async () => {
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { status: 'WARMING_UP', qrCode: null },
    });
    emitSession(orgId, sessionId, 'WARMING_UP', null);
  });

  client.on('auth_failure', async (message: string) => {
    readyClients.delete(sessionId);
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { status: 'DISCONNECTED', qrCode: null },
    });
    emitSession(orgId, sessionId, 'DISCONNECTED', null);
    console.error(`[WhatsApp] Auth failed for ${sessionId}:`, message);
  });

  client.on('disconnected', async () => {
    clients.delete(sessionId);
    readyClients.delete(sessionId);
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { status: 'DISCONNECTED', qrCode: null },
    });
    emitSession(orgId, sessionId, 'DISCONNECTED', null);
  });

  await await new Promise(resolve => setTimeout(resolve, 3000));
    await client.initialize();
}

export async function destroyWhatsAppSession(sessionId: string) {
  const client = clients.get(sessionId);
  clients.delete(sessionId);
  readyClients.delete(sessionId);
  if (client) await client.destroy().catch(console.error);
}

export async function sendWhatsAppMessage(sessionId: string | null | undefined, phone: string, message: string): Promise<SendResult> {
  if (!sessionId) {
    return { success: false, error: 'No WhatsApp session selected for this campaign' };
  }

  const session = await prisma.whatsAppSession.findUnique({ where: { id: sessionId } });
  if (!session) return { success: false, error: 'WhatsApp session not found' };

  if (!clients.has(sessionId)) {
    await initializeWhatsAppSession(session.id, session.orgId);
  }

  const client = clients.get(sessionId);
  if (!client || !readyClients.has(sessionId)) {
    return { success: false, error: 'WhatsApp session is not connected. Scan the QR code in Settings first.' };
  }

  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) return { success: false, error: 'Lead phone number is invalid' };

  try {
    const chatId = await resolveChatId(client, normalizedPhone);
    if (!chatId) return { success: false, error: 'This phone number is not available on WhatsApp' };
    const result = await client.sendMessage(chatId, message);
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { messagesSent: { increment: 1 } },
    });

    return {
      success: true,
      messageId: result?.id?._serialized || `wa_${Date.now()}`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'WhatsApp send failed' };
  }
}

export async function sendWhatsAppMediaMessage(
  sessionId: string | null | undefined,
  phone: string,
  mediaUrl: string,
  caption?: string
): Promise<SendResult> {
  if (!sessionId) return { success: false, error: 'No WhatsApp session selected' };
  const session = await prisma.whatsAppSession.findUnique({ where: { id: sessionId } });
  if (!session) return { success: false, error: 'WhatsApp session not found' };

  if (!clients.has(sessionId)) {
    await initializeWhatsAppSession(session.id, session.orgId);
  }

  const client = clients.get(sessionId);
  if (!client || !readyClients.has(sessionId)) {
    return { success: false, error: 'WhatsApp session is not connected. Scan the QR code in Settings first.' };
  }

  try {
    const { MessageMedia } = loadWhatsAppWeb();
    const localPath = localUploadPathFromUrl(mediaUrl);
    const media = localPath && fs.existsSync(localPath)
      ? MessageMedia.fromFilePath(localPath)
      : await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true });
    const normalizedPhone = normalizeIndianPhone(phone);
    const chatId = await resolveChatId(client, normalizedPhone);
    if (!chatId) return { success: false, error: 'This phone number is not available on WhatsApp' };
    const result = await client.sendMessage(chatId, media, { caption });
    await prisma.whatsAppSession.update({
      where: { id: sessionId },
      data: { messagesSent: { increment: 1 } },
    });
    return { success: true, messageId: result?.id?._serialized || `wa_${Date.now()}` };
  } catch (error: any) {
    return { success: false, error: error.message || 'WhatsApp media send failed' };
  }
}
