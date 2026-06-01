import cron from 'node-cron';
import { prisma } from '../lib/prisma';

export const setupCronJobs = () => {
  // Daily analytics aggregation - runs at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Aggregating daily analytics...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const orgs = await prisma.organization.findMany({ select: { id: true } });

      for (const org of orgs) {
        const [newLeads, wonLeads, messagesSent, repliesReceived, campaigns] = await Promise.all([
          prisma.lead.count({ where: { orgId: org.id, createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } }),
          prisma.lead.count({ where: { orgId: org.id, stage: 'WON', updatedAt: { gte: yesterday } } }),
          prisma.message.count({ where: { lead: { orgId: org.id }, sentAt: { gte: yesterday }, direction: 'OUTBOUND' } }),
          prisma.message.count({ where: { lead: { orgId: org.id }, createdAt: { gte: yesterday }, direction: 'INBOUND' } }),
          prisma.campaign.count({ where: { orgId: org.id, startedAt: { gte: yesterday } } }),
        ]);

        await prisma.dailyAnalytics.upsert({
          where: { date_orgId: { date: yesterday, orgId: org.id } },
          create: { date: yesterday, orgId: org.id, newLeads, wonLeads, messagesSent, repliesReceived, campaignsRun: campaigns },
          update: { newLeads, wonLeads, messagesSent, repliesReceived, campaignsRun: campaigns },
        });
      }
      console.log('[Cron] Daily analytics done');
    } catch (error) {
      console.error('[Cron] Analytics error:', error);
    }
  });

  // Clean expired refresh tokens - runs every hour
  cron.schedule('0 * * * *', async () => {
    await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(console.error);
  });

  // Send reminder notifications - every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60 * 1000);

    const reminders = await prisma.reminder.findMany({
      where: { status: 'PENDING', dueAt: { gte: now, lte: in15 } },
      include: { lead: { select: { name: true } }, user: { select: { id: true } } },
    });

    for (const reminder of reminders) {
      console.log(`[Cron] Reminder due: ${reminder.title} for ${reminder.lead.name}`);
      // In production: send push notification / email
    }
  });

  // Mark contacted leads with no inbound reply after 24 hours.
  cron.schedule('15 * * * *', async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.lead.updateMany({
      where: {
        lastContactedAt: { lte: cutoff },
        lastRepliedAt: null,
        customerStatus: { in: ['NEW_LEAD', 'FOLLOW_UP_PENDING'] },
      },
      data: {
        customerStatus: 'NO_RESPONSE',
        customFields: { replyState: 'Lead was contacted but no reply received' },
      },
    }).catch(error => console.error('[Cron] No-reply tracking error:', error));
  });

  console.log('[Cron] Jobs scheduled: analytics(daily), token cleanup(hourly), reminders(15min), no-reply tracking(hourly)');
};
