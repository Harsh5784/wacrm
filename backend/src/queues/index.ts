import { Queue, Worker, QueueEvents } from 'bullmq';
import { Server } from 'socket.io';
import { createRedisConnection } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { sendWhatsAppMediaMessage, sendWhatsAppMessage } from '../services/whatsapp.service';

const connection = createRedisConnection();

// Queues
export const campaignQueue = new Queue('campaigns', { connection: createRedisConnection() });
export const messageQueue = new Queue('messages', { connection: createRedisConnection() });
export const scraperQueue = new Queue('scraper', { connection: createRedisConnection() });

// Helper: random delay between min/max seconds
const randomDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, (Math.random() * (max - min) + min) * 1000));

const minutesDelay = (minutes: number) =>
  new Promise(r => setTimeout(r, minutes * 60 * 1000));

// Helper: personalize message
const personalizeMessage = (template: string, lead: any): string => {
  return template
    .replace(/\{\{name\}\}/gi, lead.name || '')
    .replace(/\{\{phone\}\}/gi, lead.phone || '')
    .replace(/\{\{city\}\}/gi, lead.city || '')
    .replace(/\{\{company\}\}/gi, lead.company || '')
    .replace(/\{\{category\}\}/gi, lead.category || '');
};

export const setupQueues = async (io: Server) => {
  // ─── Campaign Worker ───────────────────────────────────────────────────────
  const campaignWorker = new Worker('campaigns', async (job) => {
    const { campaignId, orgId } = job.data;
    console.log(`[Queue] Processing campaign ${campaignId}`);

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: {
          where: { status: 'PENDING' },
          include: { lead: true },
          take: 1000,
        },
      },
    });

    if (!campaign || campaign.status !== 'RUNNING') {
      console.log(`[Queue] Campaign ${campaignId} not running, skipping`);
      return;
    }

    let processed = 0;
    const dailyLimit = Math.max(campaign.dailyLimit || campaign.leads.length, 1);
    const safety = ((campaign.settings as any)?.safety || {}) as any;
    const imageUrl = String((campaign.settings as any)?.imageUrl || '');
    const batchSize = Math.max(Number(safety.batchSize || 20), 1);
    const pauseMinutesAfterBatch = Math.max(Number(safety.pauseMinutesAfterBatch || 10), 1);

    for (const campaignLead of campaign.leads) {
      // Re-check campaign status on each iteration
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true, totalSent: true },
      });

      if (currentCampaign?.status !== 'RUNNING') {
        console.log(`[Queue] Campaign paused/stopped, halting`);
        break;
      }

      if (processed >= dailyLimit) {
        console.log(`[Queue] Daily limit ${dailyLimit} reached`);
        break;
      }

      const { lead } = campaignLead;
      const personalizedMessage = personalizeMessage(campaign.messageTemplate, lead);

      // Update to queued
      await prisma.campaignLead.update({
        where: { id: campaignLead.id },
        data: { status: 'QUEUED', personalizedMessage },
      });

      // Human-like typing delay
      const typingDelay = Math.floor(personalizedMessage.length * 0.05 * 1000); // ~50ms per char
      await new Promise(r => setTimeout(r, Math.min(typingDelay, 3000)));

      // Send message
      const result = imageUrl
        ? await sendWhatsAppMediaMessage(campaign.sessionId, lead.phone, imageUrl, personalizedMessage)
        : await sendWhatsAppMessage(campaign.sessionId, lead.phone, personalizedMessage);

      if (result.success) {
        await prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        await prisma.message.create({
          data: {
            direction: 'OUTBOUND',
            content: personalizedMessage,
            status: 'SENT',
            mediaType: imageUrl ? 'IMAGE' : 'TEXT',
            mediaUrl: imageUrl || null,
            messageId: result.messageId,
            campaignId: campaign.id,
            leadId: lead.id,
            sentAt: new Date(),
          },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { totalSent: { increment: 1 }, totalDelivered: { increment: 1 } },
        });

        // Emit real-time update
        io.to(`org:${orgId}`).emit('campaign:progress', {
          campaignId,
          sent: processed + 1,
          lead: { id: lead.id, name: lead.name, phone: lead.phone },
          status: 'sent',
        });
      } else {
        await prisma.campaignLead.update({
          where: { id: campaignLead.id },
          data: { status: 'FAILED', failReason: result.error, retryCount: { increment: 1 } },
        });

        await prisma.campaign.update({
          where: { id: campaignId },
          data: { totalFailed: { increment: 1 } },
        });
      }

      processed++;
      job.updateProgress(Math.floor((processed / campaign.leads.length) * 100));

      if (processed > 0 && processed % batchSize === 0 && processed < dailyLimit) {
        console.log(`[Queue] Safety pause for ${pauseMinutesAfterBatch} minutes after ${processed} messages`);
        await minutesDelay(pauseMinutesAfterBatch);
      }

      // Random human-like delay between messages
      await randomDelay(campaign.minDelay, campaign.maxDelay);
    }

    // Check if all leads processed
    const remainingLeads = await prisma.campaignLead.count({
      where: { campaignId, status: 'PENDING' },
    });

    if (remainingLeads === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      io.to(`org:${orgId}`).emit('campaign:completed', { campaignId });
      console.log(`[Queue] Campaign ${campaignId} completed`);
    } else if (processed >= dailyLimit) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'PAUSED' },
      });
      io.to(`org:${orgId}`).emit('campaign:paused', { campaignId, remaining: remainingLeads });
      console.log(`[Queue] Campaign ${campaignId} paused with ${remainingLeads} unsent contacts`);
    }

    console.log(`[Queue] Campaign ${campaignId}: processed ${processed} messages`);
  }, {
    connection: createRedisConnection(),
    concurrency: 2,
  });

  campaignWorker.on('failed', async (job, err) => {
    console.error(`[Queue] Campaign job failed:`, err);
    if (job?.data?.campaignId) {
      await prisma.campaign.update({
        where: { id: job.data.campaignId },
        data: { status: 'FAILED' },
      }).catch(console.error);
    }
  });

  // ─── Scraper Worker ────────────────────────────────────────────────────────
  const scraperWorker = new Worker('scraper', async (job) => {
    const { jobId, source, query, location } = job.data;
    console.log(`[Scraper] Processing ${source} job ${jobId}`);

    // Simulated scraper (real implementation needs puppeteer/playwright)
    const mockResults = Array.from({ length: 10 }, (_, i) => ({
      name: `${query} Business ${i + 1}`,
      phone: `+91${Math.floor(9000000000 + Math.random() * 1000000000)}`,
      city: location || 'Mumbai',
      category: query,
      address: `${i + 1}, Main Street, ${location || 'Mumbai'}`,
      rating: (3 + Math.random() * 2).toFixed(1),
      source,
    }));

    await prisma.scraperJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        totalFound: mockResults.length,
        results: mockResults,
      },
    });

    io.to(`job:${jobId}`).emit('scraper:complete', { jobId, results: mockResults });
  }, {
    connection: createRedisConnection(),
    concurrency: 3,
  });

  console.log('[Queue] Workers initialized');
};
