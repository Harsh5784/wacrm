"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappRouter = exports.settingsRouter = exports.teamRouter = exports.tagRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const whatsapp_service_1 = require("../services/whatsapp.service");
const mail_service_1 = require("../services/mail.service");
const gemini_1 = require("../lib/gemini");
const uploadDir = path_1.default.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
fs_1.default.mkdirSync(uploadDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
            cb(null, `${Date.now()}-${safeName}`);
        },
    }),
    limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024) },
});
function canViewAllOrgChats(req) {
    return ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(String(req.user?.role || ''));
}
function scopedLeadWhere(req, extra = {}) {
    return {
        ...extra,
        orgId: req.user.orgId,
        ...(canViewAllOrgChats(req) ? {} : { OR: [{ assignedToId: req.user.id }, { ownerId: req.user.id }] }),
    };
}
// ─── Tags ─────────────────────────────────────────────────────────────────────
exports.tagRouter = (0, express_1.Router)();
exports.tagRouter.use(auth_middleware_1.authenticate);
exports.tagRouter.get('/', async (req, res) => {
    const tags = await prisma_1.prisma.tag.findMany({
        where: { orgId: req.user.orgId },
        include: { _count: { select: { leads: true } } },
    });
    res.json({ success: true, data: tags });
});
exports.tagRouter.post('/', async (req, res) => {
    try {
        const tag = await prisma_1.prisma.tag.create({
            data: { ...req.body, orgId: req.user.orgId },
        });
        res.status(201).json({ success: true, data: tag });
    }
    catch (error) {
        if (error.code === 'P2002')
            return res.status(400).json({ success: false, message: 'Tag name already exists' });
        res.status(500).json({ success: false, message: 'Failed to create tag' });
    }
});
exports.tagRouter.delete('/:id', async (req, res) => {
    await prisma_1.prisma.tag.deleteMany({ where: { id: req.params.id, orgId: req.user.orgId } });
    res.json({ success: true, message: 'Tag deleted' });
});
// ─── Team ─────────────────────────────────────────────────────────────────────
exports.teamRouter = (0, express_1.Router)();
exports.teamRouter.use(auth_middleware_1.authenticate);
async function getTeamPerformanceData(req, days, includeInactive) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const members = await prisma_1.prisma.user.findMany({
        where: { orgId: req.user.orgId, ...(includeInactive ? {} : { isActive: true }) },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            _count: { select: { assignedLeads: true, leads: true } },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    const metrics = await Promise.all(members.map(async (member) => {
        const [closedDealLeads, followUps, sentMessages, receivedMessages, activities] = await Promise.all([
            prisma_1.prisma.lead.findMany({
                where: {
                    orgId: req.user.orgId,
                    assignedToId: member.id,
                    updatedAt: { gte: from },
                    OR: [{ stage: 'WON' }, { customerStatus: 'CONVERTED' }],
                },
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    company: true,
                    city: true,
                    category: true,
                    stage: true,
                    customerStatus: true,
                    score: true,
                    updatedAt: true,
                    customFields: true,
                },
                orderBy: { updatedAt: 'desc' },
                take: 50,
            }),
            prisma_1.prisma.lead.count({
                where: { orgId: req.user.orgId, assignedToId: member.id, followUpAt: { gte: from } },
            }),
            prisma_1.prisma.message.count({
                where: { direction: 'OUTBOUND', createdAt: { gte: from }, metadata: { path: ['sentById'], equals: member.id } },
            }),
            prisma_1.prisma.message.count({
                where: { direction: 'INBOUND', createdAt: { gte: from }, lead: { orgId: req.user.orgId, assignedToId: member.id } },
            }),
            prisma_1.prisma.activity.count({ where: { userId: member.id, createdAt: { gte: from } } }),
        ]);
        return {
            ...member,
            metrics: {
                closedDeals: closedDealLeads.length,
                closedDealDetails: closedDealLeads.map((lead) => ({
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    company: lead.company,
                    city: lead.city,
                    category: lead.category,
                    stage: lead.stage,
                    customerStatus: lead.customerStatus,
                    score: lead.score,
                    closedAt: lead.updatedAt,
                    package: lead.customFields?.package || lead.customFields?.plan || lead.customFields?.dealPackage || null,
                    dealValue: lead.customFields?.dealValue || lead.customFields?.amount || null,
                })),
                followUps,
                sentMessages,
                receivedMessages,
                activities,
                assignedLeads: member._count.assignedLeads,
                ownedLeads: member._count.leads,
            },
        };
    }));
    return { days, from, members: metrics };
}
function pdfEscape(value) {
    return value.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7E]/g, '');
}
function makePerformancePdf(report, orgName) {
    const lines = [
        `${orgName} - Team Performance Report`,
        `Period: Last ${report.days} days, from ${new Date(report.from).toLocaleDateString('en-IN')}`,
        `Generated: ${new Date().toLocaleString('en-IN')}`,
        '',
        ...report.members.flatMap((member) => {
            const deals = member.metrics.closedDealDetails || [];
            return [
                `${member.name} (${member.role})`,
                `Assigned: ${member.metrics.assignedLeads} | Closed deals: ${member.metrics.closedDeals} | Sent: ${member.metrics.sentMessages} | Replies: ${member.metrics.receivedMessages} | Follow-ups: ${member.metrics.followUps} | Activity: ${member.metrics.activities}`,
                ...deals.slice(0, 20).map((deal) => `  - ${deal.name}${deal.company ? `, ${deal.company}` : ''}${deal.package ? `, Package: ${deal.package}` : ''}${deal.dealValue ? `, Value: INR ${deal.dealValue}` : ''}, Closed: ${new Date(deal.closedAt).toLocaleDateString('en-IN')}`),
                deals.length > 20 ? `  + ${deals.length - 20} more closed deals` : '',
                '',
            ].filter(Boolean);
        }),
    ];
    const pages = [];
    for (let i = 0; i < lines.length; i += 42)
        pages.push(lines.slice(i, i + 42));
    const objects = [''];
    const pageObjectIds = [];
    const contentObjectIds = [];
    pages.forEach((pageLines) => {
        const content = `BT /F1 11 Tf 50 780 Td 14 TL ${pageLines.map(line => `(${pdfEscape(line).slice(0, 110)}) Tj T*`).join(' ')} ET`;
        const contentId = objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`) - 1;
        const pageId = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`) - 1;
        contentObjectIds.push(contentId);
        pageObjectIds.push(pageId);
    });
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
        offsets[i] = Buffer.byteLength(pdf);
        pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++)
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
}
exports.teamRouter.get('/', async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const members = await prisma_1.prisma.user.findMany({
        where: { orgId: req.user.orgId, ...(includeInactive ? {} : { isActive: true }) },
        select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, lastLoginAt: true, createdAt: true },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: members });
});
exports.teamRouter.post('/invite', async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const exists = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (exists)
            return res.status(400).json({ success: false, message: 'Email already registered' });
        const password = Math.random().toString(36).slice(-8) + 'A1!';
        const hashed = await bcryptjs_1.default.hash(password, 12);
        const user = await prisma_1.prisma.user.create({
            data: { name, email, password: hashed, role, orgId: req.user.orgId },
            select: { id: true, name: true, email: true, role: true, organization: { select: { name: true } } },
        });
        const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/login`;
        const emailBody = (0, mail_service_1.invitationEmail)({
            name,
            email,
            password,
            loginUrl,
            orgName: user.organization.name,
        });
        const mail = await (0, mail_service_1.sendMail)({
            to: email,
            subject: `You're invited to ${user.organization.name}`,
            ...emailBody,
        });
        const { organization, ...member } = user;
        res.status(201).json({ success: true, data: { ...member, tempPassword: password, emailSent: mail.sent } });
    }
    catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ success: false, message: 'Failed to invite member' });
    }
});
exports.teamRouter.get('/performance', async (req, res) => {
    const days = Math.max(parseInt(String(req.query.days || '30')) || 30, 1);
    const includeInactive = req.query.includeInactive === 'true';
    res.json({ success: true, data: await getTeamPerformanceData(req, days, includeInactive) });
});
exports.teamRouter.get('/performance/report', async (req, res) => {
    const days = Math.max(parseInt(String(req.query.days || '30')) || 30, 1);
    const includeInactive = req.query.includeInactive === 'true';
    const [report, org] = await Promise.all([
        getTeamPerformanceData(req, days, includeInactive),
        prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { name: true } }),
    ]);
    const pdf = makePerformancePdf(report, org?.name || 'Organization');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="team-performance-${days}-days.pdf"`);
    res.send(pdf);
});
exports.teamRouter.put('/:id', async (req, res) => {
    const user = await prisma_1.prisma.user.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
    if (!user)
        return res.status(404).json({ success: false, message: 'User not found' });
    const updated = await prisma_1.prisma.user.update({
        where: { id: req.params.id },
        data: { role: req.body.role, isActive: req.body.isActive },
        select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ success: true, data: updated });
});
exports.teamRouter.delete('/:id', async (req, res) => {
    if (req.params.id === req.user.id) {
        return res.status(400).json({ success: false, message: 'Cannot remove yourself' });
    }
    const removed = await prisma_1.prisma.user.updateMany({ where: { id: req.params.id, orgId: req.user.orgId }, data: { isActive: false } });
    if (!removed.count)
        return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'Member removed' });
});
// ─── Settings ─────────────────────────────────────────────────────────────────
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.use(auth_middleware_1.authenticate);
exports.settingsRouter.get('/', async (req, res) => {
    const org = await prisma_1.prisma.organization.findUnique({
        where: { id: req.user.orgId },
        select: { name: true, logo: true, plan: true, settings: true },
    });
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true, email: true, phone: true, avatar: true },
    });
    res.json({ success: true, data: { organization: org, user } });
});
exports.settingsRouter.put('/profile', async (req, res) => {
    const user = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: req.body,
        select: { name: true, email: true, phone: true, avatar: true },
    });
    res.json({ success: true, data: user });
});
exports.settingsRouter.put('/organization', async (req, res) => {
    const existing = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
    const org = await prisma_1.prisma.organization.update({
        where: { id: req.user.orgId },
        data: {
            name: req.body.name,
            logo: req.body.logo,
            settings: {
                ...((existing?.settings || {})),
                ...(req.body.settings || {}),
            },
        },
    });
    res.json({ success: true, data: org });
});
const handleUpload = async (req, res) => {
    if (!req.file)
        return res.status(400).json({ success: false, message: 'File required' });
    const baseUrl = process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
        success: true,
        data: {
            url: `${baseUrl}/uploads/${req.file.filename}`,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
        },
    });
};
exports.settingsRouter.post('/upload-file', upload.single('file'), handleUpload);
exports.settingsRouter.post('/upload-image', upload.single('image'), handleUpload);
exports.settingsRouter.put('/password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        return res.status(404).json({ success: false, message: 'User not found' });
    const valid = await bcryptjs_1.default.compare(currentPassword, user.password);
    if (!valid)
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    const hashed = await bcryptjs_1.default.hash(newPassword, 12);
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ success: true, message: 'Password updated' });
});
exports.settingsRouter.post('/ai/validate-key', async (req, res) => {
    try {
        const apiKey = String(req.body.apiKey || '').trim();
        const valid = await (0, gemini_1.validateGeminiApiKey)(apiKey);
        if (!valid)
            return res.status(400).json({ success: false, message: 'Gemini API key validation failed' });
        res.json({ success: true, message: 'Gemini API key is valid' });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message || 'Gemini API key validation failed' });
    }
});
// ─── WhatsApp Sessions ─────────────────────────────────────────────────────────
exports.whatsappRouter = (0, express_1.Router)();
exports.whatsappRouter.use(auth_middleware_1.authenticate);
exports.whatsappRouter.get('/sessions', async (req, res) => {
    const sessions = await prisma_1.prisma.whatsAppSession.findMany({
        where: { orgId: req.user.orgId },
        orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: sessions });
});
exports.whatsappRouter.get('/sessions/:id/qr', async (req, res) => {
    const session = await prisma_1.prisma.whatsAppSession.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
    if (!session)
        return res.status(404).json({ success: false, message: 'Session not found' });
    if (!session.qrCode)
        return res.status(404).json({ success: false, message: 'QR code not ready. Reconnect the session first.' });
    const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(session.qrCode)}`;
    res.type('html').send(`<!doctype html><html><head><title>WhatsApp QR</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="font-family:system-ui;margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9"><main style="text-align:center;background:white;border:1px solid #ddd;border-radius:14px;padding:24px"><h2>Scan WhatsApp QR</h2><img src="${qrImage}" alt="WhatsApp QR" style="width:320px;height:320px"/><p>Open WhatsApp, tap Linked devices, then scan this code.</p></main></body></html>`);
});
exports.whatsappRouter.post('/sessions', async (req, res) => {
    const session = await prisma_1.prisma.whatsAppSession.create({
        data: { name: req.body.name || 'WhatsApp Web', orgId: req.user.orgId, status: 'SCANNING' },
    });
    (0, whatsapp_service_1.initializeWhatsAppSession)(session.id, req.user.orgId).catch(async (error) => {
        console.error('initializeWhatsAppSession error:', error);
        await prisma_1.prisma.whatsAppSession.update({
            where: { id: session.id },
            data: { status: 'DISCONNECTED', qrCode: null },
        }).catch(console.error);
    });
    res.status(201).json({ success: true, data: session });
});
exports.whatsappRouter.post('/sessions/:id/reconnect', async (req, res) => {
    const session = await prisma_1.prisma.whatsAppSession.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
    if (!session)
        return res.status(404).json({ success: false, message: 'Session not found' });
    await prisma_1.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { status: 'SCANNING', qrCode: null },
    });
    (0, whatsapp_service_1.initializeWhatsAppSession)(session.id, req.user.orgId).catch(console.error);
    res.json({ success: true, message: 'Reconnect started' });
});
exports.whatsappRouter.delete('/sessions/:id', async (req, res) => {
    await (0, whatsapp_service_1.destroyWhatsAppSession)(req.params.id);
    await prisma_1.prisma.whatsAppSession.deleteMany({ where: { id: req.params.id, orgId: req.user.orgId } });
    res.json({ success: true, message: 'Session deleted' });
});
exports.whatsappRouter.get('/chats', async (req, res) => {
    const { search = '', status, assignedTo, includeAll } = req.query;
    const where = scopedLeadWhere(req);
    if (includeAll !== 'true')
        where.messages = { some: {} };
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { company: { contains: search, mode: 'insensitive' } },
            { messages: { some: { content: { contains: search, mode: 'insensitive' } } } },
        ];
    }
    if (status)
        where.customerStatus = status;
    if (assignedTo === 'me')
        where.assignedToId = req.user.id;
    else if (assignedTo)
        where.assignedToId = assignedTo;
    const leads = await prisma_1.prisma.lead.findMany({
        where,
        include: {
            assignedTo: { select: { id: true, name: true, avatar: true } },
            owner: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            campaignLeads: {
                orderBy: { createdAt: 'desc' },
                take: 3,
                include: { campaign: { select: { id: true, name: true, status: true } } },
            },
            _count: { select: { messages: true } },
        },
        orderBy: [
            { lastRepliedAt: 'desc' },
            { lastContactedAt: 'desc' },
            { updatedAt: 'desc' },
        ],
        take: 100,
    });
    res.json({ success: true, data: leads });
});
exports.whatsappRouter.get('/chats/summary', async (req, res) => {
    const unread = await prisma_1.prisma.lead.aggregate({
        where: scopedLeadWhere(req, { unreadCount: { gt: 0 } }),
        _sum: { unreadCount: true },
        _count: { id: true },
    });
    res.json({
        success: true,
        data: {
            unreadMessages: unread._sum.unreadCount || 0,
            unreadChats: unread._count.id || 0,
        },
    });
});
exports.whatsappRouter.post('/chats/auto-assign', async (req, res) => {
    const executives = await prisma_1.prisma.user.findMany({
        where: { orgId: req.user.orgId, isActive: true, role: { in: ['MANAGER', 'MEMBER', 'ADMIN'] } },
        select: { id: true, name: true, _count: { select: { assignedLeads: true } } },
        orderBy: { assignedLeads: { _count: 'asc' } },
    });
    if (!executives.length)
        return res.status(400).json({ success: false, message: 'No active support executives found' });
    const unassigned = await prisma_1.prisma.lead.findMany({
        where: { orgId: req.user.orgId, assignedToId: null, messages: { some: {} } },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
        take: 500,
    });
    let assigned = 0;
    for (const [index, lead] of unassigned.entries()) {
        const executive = executives[index % executives.length];
        await prisma_1.prisma.lead.update({ where: { id: lead.id }, data: { assignedToId: executive.id } });
        assigned++;
    }
    const existing = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
    await prisma_1.prisma.organization.update({
        where: { id: req.user.orgId },
        data: {
            settings: {
                ...((existing?.settings || {})),
                support: {
                    ...((existing?.settings?.support || {})),
                    autoAssign: true,
                },
            },
        },
    });
    res.json({ success: true, data: { assigned, executives: executives.length } });
});
exports.whatsappRouter.get('/chats/:leadId/messages', async (req, res) => {
    const lead = await prisma_1.prisma.lead.findFirst({
        where: scopedLeadWhere(req, { id: req.params.leadId }),
        include: {
            assignedTo: { select: { id: true, name: true, avatar: true } },
            campaignLeads: {
                include: { campaign: { select: { id: true, name: true, status: true } } },
                orderBy: { createdAt: 'desc' },
            },
        },
    });
    if (!lead)
        return res.status(404).json({ success: false, message: 'Chat not found' });
    const messages = await prisma_1.prisma.message.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'asc' },
        take: 300,
    });
    await prisma_1.prisma.lead.update({
        where: { id: lead.id },
        data: { unreadCount: 0 },
    });
    res.json({ success: true, data: { lead, messages } });
});
exports.whatsappRouter.post('/chats/:leadId/send', async (req, res) => {
    const lead = await prisma_1.prisma.lead.findFirst({ where: scopedLeadWhere(req, { id: req.params.leadId }) });
    if (!lead)
        return res.status(404).json({ success: false, message: 'Lead not found' });
    const session = req.body.sessionId
        ? await prisma_1.prisma.whatsAppSession.findFirst({ where: { id: req.body.sessionId, orgId: req.user.orgId } })
        : await prisma_1.prisma.whatsAppSession.findFirst({ where: { orgId: req.user.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });
    if (!session)
        return res.status(400).json({ success: false, message: 'Add and scan a WhatsApp Web session in Settings before replying.' });
    const content = String(req.body.content || '').trim();
    const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl) : '';
    if (!content && !mediaUrl)
        return res.status(400).json({ success: false, message: 'Message or media is required' });
    const result = mediaUrl
        ? await (0, whatsapp_service_1.sendWhatsAppMediaMessage)(session.id, lead.phone, mediaUrl, content)
        : await (0, whatsapp_service_1.sendWhatsAppMessage)(session.id, lead.phone, content);
    if (!result.success)
        return res.status(400).json({ success: false, message: result.error || 'WhatsApp send failed' });
    const mediaType = req.body.mediaType || (mediaUrl ? 'DOCUMENT' : 'TEXT');
    const message = await prisma_1.prisma.message.create({
        data: {
            direction: 'OUTBOUND',
            content: content || req.body.fileName || '[media]',
            status: 'SENT',
            messageId: result.messageId,
            mediaType,
            mediaUrl: mediaUrl || null,
            fileName: req.body.fileName || null,
            mimeType: req.body.mimeType || null,
            leadId: lead.id,
            sentAt: new Date(),
            metadata: { sessionId: session.id, sentById: req.user.id },
        },
    });
    await prisma_1.prisma.lead.update({
        where: { id: lead.id },
        data: {
            lastContactedAt: new Date(),
            customerStatus: lead.customerStatus === 'NEW_LEAD' ? 'NO_RESPONSE' : lead.customerStatus,
            stage: lead.stage === 'NEW' ? 'CONTACTED' : lead.stage,
            customFields: {
                ...(lead.customFields || {}),
                replyState: 'Lead was contacted but no reply received',
            },
        },
    });
    await prisma_1.prisma.activity.create({
        data: {
            type: 'MESSAGE_SENT',
            description: 'WhatsApp message sent from CRM',
            leadId: lead.id,
            userId: req.user.id,
            metadata: { messageId: message.id, sessionId: session.id },
        },
    });
    req.app.get('io')?.to(`org:${req.user.orgId}`).emit('whatsapp:message', { leadId: lead.id, message });
    res.status(201).json({ success: true, data: message });
});
exports.whatsappRouter.post('/direct/send', async (req, res) => {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const name = String(req.body.name || '').trim() || phone;
    const content = String(req.body.content || '').trim();
    if (!phone || phone.length < 10)
        return res.status(400).json({ success: false, message: 'Valid phone number is required' });
    if (!content)
        return res.status(400).json({ success: false, message: 'Message is required' });
    const session = req.body.sessionId
        ? await prisma_1.prisma.whatsAppSession.findFirst({ where: { id: req.body.sessionId, orgId: req.user.orgId } })
        : await prisma_1.prisma.whatsAppSession.findFirst({ where: { orgId: req.user.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });
    if (!session)
        return res.status(400).json({ success: false, message: 'Add and scan a WhatsApp Web session in Settings before sending.' });
    const normalizedPhone = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
    const result = await (0, whatsapp_service_1.sendWhatsAppMessage)(session.id, normalizedPhone, content);
    if (!result.success)
        return res.status(400).json({ success: false, message: result.error || 'WhatsApp send failed' });
    let lead = await prisma_1.prisma.lead.findFirst({ where: { orgId: req.user.orgId, phone: normalizedPhone } });
    if (!lead) {
        lead = await prisma_1.prisma.lead.create({
            data: {
                name,
                phone: normalizedPhone,
                source: 'WHATSAPP',
                stage: 'CONTACTED',
                customerStatus: 'NO_RESPONSE',
                orgId: req.user.orgId,
                ownerId: req.user.id,
                assignedToId: req.user.id,
                lastContactedAt: new Date(),
                customFields: { createdFromDirectMessage: true, replyState: 'Lead was contacted but no reply received' },
            },
        });
    }
    const message = await prisma_1.prisma.message.create({
        data: {
            direction: 'OUTBOUND',
            content,
            status: 'SENT',
            messageId: result.messageId,
            leadId: lead.id,
            sentAt: new Date(),
            metadata: { sessionId: session.id, sentById: req.user.id, directSend: true },
        },
    });
    await prisma_1.prisma.lead.update({
        where: { id: lead.id },
        data: {
            lastContactedAt: new Date(),
            stage: lead.stage === 'NEW' ? 'CONTACTED' : lead.stage,
            customerStatus: lead.customerStatus === 'NEW_LEAD' ? 'NO_RESPONSE' : lead.customerStatus,
        },
    });
    await prisma_1.prisma.activity.create({
        data: {
            type: 'MESSAGE_SENT',
            description: 'Direct WhatsApp message sent from CRM',
            leadId: lead.id,
            userId: req.user.id,
            metadata: { messageId: message.id, sessionId: session.id },
        },
    });
    req.app.get('io')?.to(`org:${req.user.orgId}`).emit('whatsapp:message', { leadId: lead.id, message });
    res.status(201).json({ success: true, data: { lead, message } });
});
exports.whatsappRouter.put('/chats/:leadId/status', async (req, res) => {
    const lead = await prisma_1.prisma.lead.findFirst({ where: scopedLeadWhere(req, { id: req.params.leadId }) });
    if (!lead)
        return res.status(404).json({ success: false, message: 'Lead not found' });
    const data = {};
    if (req.body.customerStatus)
        data.customerStatus = req.body.customerStatus;
    if (req.body.followUpAt !== undefined)
        data.followUpAt = req.body.followUpAt ? new Date(req.body.followUpAt) : null;
    if (req.body.assignedToId !== undefined && canViewAllOrgChats(req))
        data.assignedToId = req.body.assignedToId || null;
    if (req.body.stage)
        data.stage = req.body.stage;
    data.customFields = {
        ...(lead.customFields || {}),
        ...(req.body.note ? { latestDispositionNote: req.body.note } : {}),
    };
    const updated = await prisma_1.prisma.lead.update({
        where: { id: lead.id },
        data,
        include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    });
    await prisma_1.prisma.activity.create({
        data: {
            type: 'LEAD_UPDATED',
            description: `Customer status updated to ${updated.customerStatus}`,
            leadId: lead.id,
            userId: req.user.id,
            metadata: { followUpAt: updated.followUpAt },
        },
    });
    req.app.get('io')?.to(`org:${req.user.orgId}`).emit('lead:updated', { leadId: lead.id });
    res.json({ success: true, data: updated });
});
//# sourceMappingURL=_combined.routes.js.map