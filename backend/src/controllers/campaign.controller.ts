import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { campaignQueue } from '../queues';
import { initializeWhatsAppSession } from '../services/whatsapp.service';

const serializeCampaign = (campaign: any) => ({
  ...campaign,
  imageUrl: campaign.settings?.imageUrl,
  safety: campaign.settings?.safety,
  schedule: campaign.settings?.schedule,
});

function safetyConfig(recipientCount: number, session?: any, limits?: any) {
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

function describeCampaignSchedule(recipientCount: number, safety: any) {
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

function applyCampaignOverrides(safety: any, overrides: any = {}) {
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

async function resolveCampaignLeadIds(req: AuthRequest, leadIds?: string[], stageFilter?: string) {
  let leadsToAdd: string[] = leadIds || [];

  if (!leadsToAdd.length && stageFilter) {
    const filtered = await prisma.lead.findMany({
      where: { orgId: req.user!.orgId, stage: stageFilter as any, isBlocked: false },
      select: { id: true },
    });
    leadsToAdd = filtered.map(l => l.id);
  }

  if (!leadsToAdd.length) {
    const allLeads = await prisma.lead.findMany({
      where: { orgId: req.user!.orgId, isBlocked: false },
      select: { id: true },
    });
    leadsToAdd = allLeads.map(l => l.id);
  }

  return leadsToAdd;
}

export const getCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20', status } = req.query as any;
    const where: any = { orgId: req.user!.orgId };
    if (status) where.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where, include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { leads: true, messages: true } },
        },
        orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
      }),
      prisma.campaign.count({ where }),
    ]);
    res.json({ success: true, data: campaigns.map(serializeCampaign), pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: {
        createdBy: { select: { id: true, name: true } },
        leads: { include: { lead: { select: { id: true, name: true, phone: true } } }, take: 100 },
        _count: { select: { leads: true } },
      },
    });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, data: serializeCampaign(campaign) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, tags, stageFilter, imageUrl, minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch, autoStart, ...data } = req.body;
    if (!data.name) return res.status(400).json({ success: false, message: 'Campaign name required' });
    if (!data.messageTemplate) return res.status(400).json({ success: false, message: 'Message template required' });
    const orgForLimit = await prisma.organization.findUnique({ where: { id: req.user!.orgId }, select: { settings: true } });
    const maxCampaigns = Number((orgForLimit?.settings as any)?.limits?.maxCampaigns || 0);
    if (maxCampaigns > 0) {
      const campaignCount = await prisma.campaign.count({ where: { orgId: req.user!.orgId } });
      if (campaignCount >= maxCampaigns) {
        return res.status(403).json({ success: false, message: `Campaign limit reached (${maxCampaigns}). Contact super admin to increase it.` });
      }
    }

    const leadsToAdd = await resolveCampaignLeadIds(req, leadIds, stageFilter);

    const session = await prisma.whatsAppSession.findFirst({
      where: { orgId: req.user!.orgId, ...(autoStart ? { status: 'CONNECTED' as const } : {}) },
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
    const safety = applyCampaignOverrides(
      safetyConfig(leadsToAdd.length || 1, session, (org?.settings as any)?.limits),
      { minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch }
    );
    const schedule = describeCampaignSchedule(leadsToAdd.length || 1, safety);

    const campaign = await prisma.campaign.create({
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
        orgId: req.user!.orgId,
        createdById: req.user!.id,
      },
    });

    if (leadsToAdd.length) {
      await prisma.campaignLead.createMany({
        data: leadsToAdd.map((leadId: string) => ({ campaignId: campaign.id, leadId })),
        skipDuplicates: true,
      });
    }

    if (autoStart) {
      await campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user!.orgId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }

    const full = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { _count: { select: { leads: true } } },
    });

    res.status(201).json({ success: true, data: full ? serializeCampaign(full) : full });
  } catch (err: any) {
    console.error('createCampaign error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const estimateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, stageFilter, minDelay, maxDelay, dailyLimit, batchSize, pauseMinutesAfterBatch } = req.body;
    const [org, session, leadsToAdd] = await Promise.all([
      prisma.organization.findUnique({ where: { id: req.user!.orgId }, select: { settings: true } }),
      prisma.whatsAppSession.findFirst({ where: { orgId: req.user!.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } }),
      resolveCampaignLeadIds(req, leadIds, stageFilter),
    ]);
    const recommended = safetyConfig(leadsToAdd.length || 1, session, (org?.settings as any)?.limits);
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCampaignAvailableLeads = async (req: AuthRequest, res: Response) => {
  try {
    const { search = '', limit = '1000', source, stage, customerStatus } = req.query as any;
    const take = Math.max(parseInt(limit) || 1000, 1);
    const where: any = { orgId: req.user!.orgId, isBlocked: false };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { company: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (source) where.source = source;
    if (stage) where.stage = stage;
    if (customerStatus) where.customerStatus = customerStatus;

    const leads = await prisma.lead.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Campaign not found' });
    const { imageUrl, minDelay, maxDelay, dailyLimit, ...data } = req.body;
    const updated = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(imageUrl !== undefined
          ? { settings: { ...((existing.settings as any) || {}), imageUrl } }
          : {}),
      },
    });
    res.json({ success: true, data: serializeCampaign(updated) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    if (c.status === 'RUNNING') return res.status(400).json({ success: false, message: 'Stop campaign first' });
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, orgId: req.user!.orgId },
      include: { _count: { select: { leads: true } } },
    });
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ success: false, message: `Cannot start - status is ${campaign.status}` });
    }

    const session = campaign.sessionId
      ? await prisma.whatsAppSession.findFirst({ where: { id: campaign.sessionId, orgId: req.user!.orgId } })
      : await prisma.whatsAppSession.findFirst({ where: { orgId: req.user!.orgId, status: 'CONNECTED' }, orderBy: { updatedAt: 'desc' } });

    if (!session) {
      return res.status(400).json({ success: false, message: 'Connect WhatsApp Web in Settings before starting a campaign.', code: 'WHATSAPP_NOT_CONNECTED', needsWhatsApp: true });
    }
    if (session.status !== 'CONNECTED') {
      await initializeWhatsAppSession(session.id, session.orgId).catch(console.error);
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not connected yet. Open the QR window and scan it, then start again.',
        code: 'WHATSAPP_NOT_CONNECTED',
        needsWhatsApp: true,
        sessionId: session.id,
      });
    }

    const org = await prisma.organization.findUnique({ where: { id: req.user!.orgId }, select: { settings: true } });
    const safety = safetyConfig(campaign._count.leads, session, (org?.settings as any)?.limits);
    const schedule = describeCampaignSchedule(campaign._count.leads, safety);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        sessionId: session.id,
        minDelay: safety.minDelay,
        maxDelay: safety.maxDelay,
        dailyLimit: safety.dailyLimit,
        settings: {
          ...((campaign.settings as any) || {}),
          safety,
          schedule,
        },
      },
    });
    await campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user!.orgId }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    res.json({ success: true, message: 'Campaign started!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const pauseCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!c || c.status !== 'RUNNING') return res.status(400).json({ success: false, message: 'Campaign not running' });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'PAUSED' } });
    res.json({ success: true, message: 'Paused' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const resumeCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const c = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!c || c.status !== 'PAUSED') return res.status(400).json({ success: false, message: 'Campaign not paused' });
    await prisma.campaign.update({ where: { id: c.id }, data: { status: 'RUNNING' } });
    await campaignQueue.add('process-campaign', { campaignId: c.id, orgId: req.user!.orgId });
    res.json({ success: true, message: 'Resumed' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const sendUnsentCampaignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    if (campaign.status === 'RUNNING') return res.status(400).json({ success: false, message: 'Campaign is already running' });

    const pending = await prisma.campaignLead.count({ where: { campaignId: campaign.id, status: { in: ['PENDING', 'FAILED', 'QUEUED'] } } });
    if (!pending) return res.status(400).json({ success: false, message: 'No unsent campaign leads found' });

    await prisma.campaignLead.updateMany({
      where: { campaignId: campaign.id, status: { in: ['FAILED', 'QUEUED'] } },
      data: { status: 'PENDING', failReason: null },
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING', completedAt: null },
    });
    await campaignQueue.add('process-campaign', { campaignId: campaign.id, orgId: req.user!.orgId });

    res.json({ success: true, message: `Queued ${pending} unsent contact${pending === 1 ? '' : 's'}` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCampaignStats = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });
    const statusGroups = await prisma.campaignLead.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: true });
    const byStatus = Object.fromEntries(statusGroups.map(s => [s.status, s._count]));
    res.json({
      success: true, data: {
        total: Object.values(byStatus).reduce((a: number, b: number) => a + b, 0) as number,
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getCampaignLeads = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Not found' });

    const leads = await prisma.campaignLead.findMany({
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
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateCampaignLeadStatus = async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, orgId: req.user!.orgId } });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    const campaignLead = await prisma.campaignLead.findFirst({
      where: { campaignId: campaign.id, leadId: req.params.leadId },
      include: { lead: true },
    });
    if (!campaignLead) return res.status(404).json({ success: false, message: 'Campaign lead not found' });

    const updatedLead = await prisma.lead.update({
      where: { id: campaignLead.leadId },
      data: {
        customerStatus: req.body.customerStatus || campaignLead.lead.customerStatus,
        followUpAt: req.body.followUpAt ? new Date(req.body.followUpAt) : campaignLead.lead.followUpAt,
        stage: req.body.stage || campaignLead.lead.stage,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'LEAD_UPDATED',
        description: `Campaign response updated to ${updatedLead.customerStatus}`,
        leadId: updatedLead.id,
        userId: req.user!.id,
        metadata: { campaignId: campaign.id },
      },
    });

    res.json({ success: true, data: updatedLead });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
