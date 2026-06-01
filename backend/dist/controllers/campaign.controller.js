"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCampaignLeadStatus = exports.getCampaignLeads = exports.getCampaignStats = exports.sendUnsentCampaignLeads = exports.resumeCampaign = exports.pauseCampaign = exports.startCampaign = exports.deleteCampaign = exports.updateCampaign = exports.getCampaignAvailableLeads = exports.estimateCampaign = exports.createCampaign = exports.getCampaign = exports.getCampaigns = void 0;
const prisma_1 = require("../lib/prisma");
const queues_1 = require("../queues");
const whatsapp_service_1 = require("../services/whatsapp.service");
const serializeCampaign = (campaign) => ({
    ...campaign,
    imageUrl: campaign.settings?.imageUrl,
    safety: campaign.settings?.safety,
    schedule: campaign.settings?.schedule,
});
function safetyConfig(recipientCount, session, limits) {
    const warmupLevel = Math.max(Number(session?.warmupLevel || 0), 0);
    const sent = Math.max(Number(session?.messagesSent || 0), 0);
    const baseLimit = warmupLevel < 2 || sent < 100
        ? 35
        : recipientCount > 1000
            ? 120
            : recipientCount > 300
                ? 80
                : 50;
    return {
        minDelay: Math.max(Number(limits?.campaignMinDelay || (recipientCount > 500 ? 28 : 22)), 10),
        maxDelay: Math.max(Number(limits?.campaignMaxDelay || (recipientCount > 500 ? 75 : 55)), 15),
        dailyLimit: Math.min(Number(limits?.campaignDailyLimit || baseLimit), Math.max(recipientCount, 1)),
        batchSize: Math.max(Number(limits?.campaignBatchSize || 20), 1),
        pauseMinutesAfterBatch: Math.max(Number(limits?.campaignBatchPauseMinutes || 12), 1),
        locked: true,
    };
}
function describeCampaignSchedule(recipientCount, safety) {
    const sendableToday = Math.min(recipientCount, safety.dailyLimit);
    const avgDelay = (safety.minDelay + safety.maxDelay) / 2;
    const batchPauses = Math.floor(Math.max(sendableToday - 1, 0) / safety.batchSize) * safety.pauseMinutesAfterBatch * 60;
    const totalSeconds = Math.round(Math.max(sendableToday - 1, 0) * avgDelay + batchPauses);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round((totalSeconds % 3600) / 60);
    const eta = new Date(Date.now() + totalSeconds * 1000);
    return {
        recipients: recipientCount,
        sendableToday,
        estimatedDurationMinutes: Math.max(Math.round(totalSeconds / 60), 1),
        humanDuration: `${hours ? `${hours}h ` : ''}${minutes}m`,
        firstMessageAt: new Date().toISOString(),
        estimatedLastMessageAt: eta.toISOString(),
        summary: `${sendableToday} messages will go today over about ${hours ? `${hours}h ` : ''}${minutes}m. Delay ${safety.minDelay}-${safety.maxDelay}s, pause ${safety.pauseMinutesAfterBatch}m after every ${safety.batchSize} messages.`,
    };
}
function applyCampaignOverrides(safety, overrides = {}) {
    const dailyLimit = Number(overrides.dailyLimit || safety.dailyLimit);
    const minDelay = Number(overrides.minDelay || safety.minDelay);
    const maxDelay = Number(overrides.maxDelay || safety.maxDelay);
    const batchSize = Number(overrides.batchSize || safety.batchSize);
    const pauseMinutesAfterBatch = Number(overrides.pauseMinutesAfterBatch || safety.pauseMinutesAfterBatch);
    return {
        ...safety,
        dailyLimit: Math.max(1, Math.min(dailyLimit, safety.dailyLimit)),
        minDelay: Math.max(minDelay, safety.minDelay),
        maxDelay: Math.max(maxDelay, safety.maxDelay, minDelay),
        batchSize: Math.max(1, Math.min(batchSize, safety.batchSize)),
        pauseMinutesAfterBatch: Math.max(pauseMinutesAfterBatch, safety.pauseMinutesAfterBatch),
        recommended: safety,
    };
}
async function resolveCampaignLeadIds(req, leadIds, stageFilter) {
    let leadsToAdd = leadIds || [];
    if (!leadsToAdd.length && stageFilter) {
        const filtered = await prisma_1.prisma.lead.findMany({
            where: { orgId: req.user.orgId, stage: stageFilter, isBlocked: false },
            select: { id: true },
        });
        leadsToAdd = filtered.map(l => l.id);
    }
    if (!leadsToAdd.length) {
        const allLeads = await prisma_1.prisma.lead.findMany({
            where: { orgId: req.user.orgId, isBlocked: false },
            select: { id: true },
        });
        leadsToAdd = allLeads.map(l => l.id);
    }
    return leadsToAdd;
}
const getCampaigns = async (req, res) => {
    try {
        const { page = '1', limit = '20', status } = req.query;
        const where = { orgId: req.user.orgId };
        if (status)
            where.status = status;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [campaigns, total] = await Promise.all([
            prisma_1.prisma.campaign.findMany({
                where, include: {
                    createdBy: { select: { id: true, name: true } },
                    _count: { select: { leads: true, messages: true } },
                },
                orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
            }),
            prisma_1.prisma.campaign.count({ where }),
        ]);
        res.json({ success: true, data: campaigns.map(serializeCampaign), pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCampaigns = getCampaigns;
const getCampaign = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({
            where: { id: req.params.id, orgId: req.user.orgId },
            include: {
                createdBy: { select: { id: true, name: true } },
                leads: { include: { lead: { select: { id: true, name: true, phone: true } } }, take: 100 },
                _count: { select: { leads: true } },
            },
        });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        res.json({ success: true, data: serializeCampaign(campaign) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCampaign = getCampaign;
const createCampaign = async (req, res) => {
    try {
        const { leadIds, tags, stageFilter, imageUrl, minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch, autoStart, ...data } = req.body;
        if (!data.name)
            return res.status(400).json({ success: false, message: 'Campaign name required' });
        if (!data.messageTemplate)
            return res.status(400).json({ success: false, message: 'Message template required' });
        const orgForLimit = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
        const maxCampaigns = Number(orgForLimit?.settings?.limits?.maxCampaigns || 0);
        if (maxCampaigns > 0) {
            const campaignCount = await prisma_1.prisma.campaign.count({ where: { orgId: req.user.orgId } });
            if (campaignCount >= maxCampaigns) {
                return res.status(403).json({ success: false, message: `Campaign limit reached (${maxCampaigns}). Contact super admin to increase it.` });
            }
        }
        const leadsToAdd = await resolveCampaignLeadIds(req, leadIds, stageFilter);
        const session = await prisma_1.prisma.whatsAppSession.findFirst({
            where: { orgId: req.user.orgId, ...(autoStart ? { status: 'CONNECTED' } : {}) },
            orderBy: { updatedAt: 'desc' },
        });
        if (autoStart && session?.status !== 'CONNECTED') {
            return res.status(400).json({
                success: false,
                message: session
                    ? 'WhatsApp is not connected yet. Scan the QR code in Settings before auto-starting a campaign.'
                    : 'Connect WhatsApp Web in Settings before auto-starting a campaign.',
                code: 'WHATSAPP_NOT_CONNECTED',
                needsWhatsApp: true,
            });
        }
        const org = orgForLimit;
        const safety = applyCampaignOverrides(safetyConfig(leadsToAdd.length || 1, session, org?.settings?.limits), { minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch });
        const schedule = describeCampaignSchedule(leadsToAdd.length || 1, safety);
        const campaign = await prisma_1.prisma.campaign.create({
            data: {
                ...data,
                status: autoStart ? 'RUNNING' : 'DRAFT',
                startedAt: autoStart ? new Date() : undefined,
                minDelay: safety.minDelay,
                maxDelay: safety.maxDelay,
                dailyLimit: safety.dailyLimit,
                sessionId: session?.id || null,
                settings: {
                    ...(data.settings || {}),
                    safety,
                    schedule,
                    ...(imageUrl ? { imageUrl } : {}),
                },
                orgId: req.user.orgId,
                createdById: req.user.id,
            },
        });
        if (leadsToAdd.length) {
            await prisma_1.prisma.campaignLead.createMany({
                data: leadsToAdd.map((leadId) => ({ campaignId: campaign.id, leadId })),
                skipDuplicates: true,
            });
        }
        if (autoStart) {
            await queues_1.campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user.orgId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
        }
        const full = await prisma_1.prisma.campaign.findUnique({
            where: { id: campaign.id },
            include: { _count: { select: { leads: true } } },
        });
        res.status(201).json({ success: true, data: full ? serializeCampaign(full) : full });
    }
    catch (err) {
        console.error('createCampaign error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createCampaign = createCampaign;
const estimateCampaign = async (req, res) => {
    try {
        const { leadIds, stageFilter, minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch } = req.body;
        const [org, session, leadsToAdd] = await Promise.all([
            prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } }),
            prisma_1.prisma.whatsAppSession.findFirst({ where: { orgId: req.user.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } }),
            resolveCampaignLeadIds(req, leadIds, stageFilter),
        ]);
        const recommended = safetyConfig(leadsToAdd.length || 1, session, org?.settings?.limits);
        const safety = applyCampaignOverrides(recommended, { minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch });
        res.json({
            success: true,
            data: {
                recipients: leadsToAdd.length,
                safety,
                recommended,
                schedule: describeCampaignSchedule(leadsToAdd.length || 1, safety),
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.estimateCampaign = estimateCampaign;
const getCampaignAvailableLeads = async (req, res) => {
    try {
        const { search = '', limit = '1000', source, stage, customerStatus } = req.query;
        const take = Math.max(parseInt(limit) || 1000, 1);
        const where = { orgId: req.user.orgId, isBlocked: false };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { company: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (source)
            where.source = source;
        if (stage)
            where.stage = stage;
        if (customerStatus)
            where.customerStatus = customerStatus;
        const leads = await prisma_1.prisma.lead.findMany({
            where,
            select: {
                id: true,
                name: true,
                phone: true,
                company: true,
                city: true,
                category: true,
                source: true,
                stage: true,
                customerStatus: true,
                lastContactedAt: true,
                campaignLeads: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    select: {
                        status: true,
                        sentAt: true,
                        campaign: { select: { id: true, name: true, status: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take,
        });
        res.json({ success: true, data: leads });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCampaignAvailableLeads = getCampaignAvailableLeads;
const updateCampaign = async (req, res) => {
    try {
        const existing = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!existing)
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        const { imageUrl, minDelay, maxDelay, dailyLimit, ...data } = req.body;
        const updated = await prisma_1.prisma.campaign.update({
            where: { id: req.params.id },
            data: {
                ...data,
                ...(imageUrl !== undefined
                    ? { settings: { ...(existing.settings || {}), imageUrl } }
                    : {}),
            },
        });
        res.json({ success: true, data: serializeCampaign(updated) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateCampaign = updateCampaign;
const deleteCampaign = async (req, res) => {
    try {
        const c = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!c)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (c.status === 'RUNNING')
            return res.status(400).json({ success: false, message: 'Stop campaign first' });
        await prisma_1.prisma.campaign.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Deleted' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteCampaign = deleteCampaign;
const startCampaign = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({
            where: { id: req.params.id, orgId: req.user.orgId },
            include: { _count: { select: { leads: true } } },
        });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Not found' });
        if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
            return res.status(400).json({ success: false, message: `Cannot start - status is ${campaign.status}` });
        }
        const session = campaign.sessionId
            ? await prisma_1.prisma.whatsAppSession.findFirst({ where: { id: campaign.sessionId, orgId: req.user.orgId } })
            : await prisma_1.prisma.whatsAppSession.findFirst({ where: { orgId: req.user.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });
        if (!session) {
            return res.status(400).json({ success: false, message: 'Connect WhatsApp Web in Settings before starting a campaign.', code: 'WHATSAPP_NOT_CONNECTED', needsWhatsApp: true });
        }
        if (session.status !== 'CONNECTED') {
            await (0, whatsapp_service_1.initializeWhatsAppSession)(session.id, session.orgId).catch(console.error);
            return res.status(400).json({
                success: false,
                message: 'WhatsApp is not connected yet. Open the QR window and scan it, then start again.',
                code: 'WHATSAPP_NOT_CONNECTED',
                needsWhatsApp: true,
                sessionId: session.id,
            });
        }
        const org = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
        const safety = safetyConfig(campaign._count.leads, session, org?.settings?.limits);
        const schedule = describeCampaignSchedule(campaign._count.leads, safety);
        await prisma_1.prisma.campaign.update({
            where: { id: campaign.id },
            data: {
                status: 'RUNNING',
                startedAt: new Date(),
                sessionId: session.id,
                minDelay: safety.minDelay,
                maxDelay: safety.maxDelay,
                dailyLimit: safety.dailyLimit,
                settings: {
                    ...(campaign.settings || {}),
                    safety,
                    schedule,
                },
            },
        });
        await queues_1.campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user.orgId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
        res.json({ success: true, message: 'Campaign started!' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.startCampaign = startCampaign;
const pauseCampaign = async (req, res) => {
    try {
        const c = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!c || c.status !== 'RUNNING')
            return res.status(400).json({ success: false, message: 'Campaign not running' });
        await prisma_1.prisma.campaign.update({ where: { id: c.id }, data: { status: 'PAUSED' } });
        res.json({ success: true, message: 'Paused' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.pauseCampaign = pauseCampaign;
const resumeCampaign = async (req, res) => {
    try {
        const c = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!c || c.status !== 'PAUSED')
            return res.status(400).json({ success: false, message: 'Campaign not paused' });
        await prisma_1.prisma.campaign.update({ where: { id: c.id }, data: { status: 'RUNNING' } });
        await queues_1.campaignQueue.add('process-campaign', { campaignId: c.id, orgId: req.user.orgId });
        res.json({ success: true, message: 'Resumed' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.resumeCampaign = resumeCampaign;
const sendUnsentCampaignLeads = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        if (campaign.status === 'RUNNING')
            return res.status(400).json({ success: false, message: 'Campaign is already running' });
        const pending = await prisma_1.prisma.campaignLead.count({ where: { campaignId: campaign.id, status: { in: ['PENDING', 'FAILED', 'QUEUED'] } } });
        if (!pending)
            return res.status(400).json({ success: false, message: 'No unsent campaign leads found' });
        await prisma_1.prisma.campaignLead.updateMany({
            where: { campaignId: campaign.id, status: { in: ['FAILED', 'QUEUED'] } },
            data: { status: 'PENDING', failReason: null },
        });
        await prisma_1.prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'RUNNING', completedAt: null },
        });
        await queues_1.campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user.orgId });
        res.json({ success: true, message: `Queued ${pending} unsent contact${pending === 1 ? '' : 's'}` });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.sendUnsentCampaignLeads = sendUnsentCampaignLeads;
const getCampaignStats = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Not found' });
        const statusGroups = await prisma_1.prisma.campaignLead.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: true });
        const byStatus = Object.fromEntries(statusGroups.map(s => [s.status, s._count]));
        res.json({
            success: true, data: {
                total: Object.values(byStatus).reduce((a, b) => a + b, 0),
                pending: byStatus.PENDING || 0,
                queued: byStatus.QUEUED || 0,
                unsent: (byStatus.PENDING || 0) + (byStatus.QUEUED || 0) + (byStatus.FAILED || 0),
                sent: campaign.totalSent, delivered: campaign.totalDelivered,
                failed: campaign.totalFailed, replied: campaign.totalReplied,
                byStatus,
                deliveryRate: campaign.totalSent > 0 ? ((campaign.totalDelivered / campaign.totalSent) * 100).toFixed(1) : '0',
                replyRate: campaign.totalDelivered > 0 ? ((campaign.totalReplied / campaign.totalDelivered) * 100).toFixed(1) : '0',
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCampaignStats = getCampaignStats;
const getCampaignLeads = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Not found' });
        const leads = await prisma_1.prisma.campaignLead.findMany({
            where: { campaignId: campaign.id },
            include: {
                lead: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        company: true,
                        city: true,
                        stage: true,
                        customerStatus: true,
                        followUpAt: true,
                        lastRepliedAt: true,
                        unreadCount: true,
                    },
                },
            },
            orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
            take: 500,
        });
        res.json({ success: true, data: leads });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCampaignLeads = getCampaignLeads;
const updateCampaignLeadStatus = async (req, res) => {
    try {
        const campaign = await prisma_1.prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!campaign)
            return res.status(404).json({ success: false, message: 'Campaign not found' });
        const campaignLead = await prisma_1.prisma.campaignLead.findFirst({
            where: { campaignId: campaign.id, leadId: req.params.leadId },
            include: { lead: true },
        });
        if (!campaignLead)
            return res.status(404).json({ success: false, message: 'Campaign lead not found' });
        const updatedLead = await prisma_1.prisma.lead.update({
            where: { id: campaignLead.leadId },
            data: {
                customerStatus: req.body.customerStatus || campaignLead.lead.customerStatus,
                followUpAt: req.body.followUpAt ? new Date(req.body.followUpAt) : campaignLead.lead.followUpAt,
                stage: req.body.stage || campaignLead.lead.stage,
            },
        });
        await prisma_1.prisma.activity.create({
            data: {
                type: 'LEAD_UPDATED',
                description: `Campaign response updated to ${updatedLead.customerStatus}`,
                leadId: updatedLead.id,
                userId: req.user.id,
                metadata: { campaignId: campaign.id },
            },
        });
        res.json({ success: true, data: updatedLead });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateCampaignLeadStatus = updateCampaignLeadStatus;
//# sourceMappingURL=campaign.controller.js.map