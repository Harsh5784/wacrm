import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendWhatsAppMessage } from './whatsapp.service';

export const setupCronJobs = () => {
  // Automated WhatsApp follow-up dispatcher — runs every 1 minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const dueReminders = await prisma.reminder.findMany({
        where: { status: 'PENDING', dueAt: { lte: now } },
        include: { lead: true },
        take: 20,
      });

      for (const reminder of dueReminders) {
        if (!reminder.lead?.phone) continue;

        const session = await prisma.whatsAppSession.findFirst({
          where: { orgId: reminder.lead.orgId, status: 'CONNECTED' },
          orderBy: { updatedAt: 'desc' },
        });

        if (session) {
          const content = reminder.description || `Hi ${reminder.lead.name || 'there'}, this is an automated follow-up regarding your account.`;
          const sendRes = await sendWhatsAppMessage(session.id, reminder.lead.phone, content);

          if (sendRes.success) {
            await prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: 'COMPLETED' },
            });

            await prisma.lead.update({
              where: { id: reminder.leadId },
              data: {
                stage: 'CONTACTED',
                customerStatus: 'FOLLOW_UP_PENDING',
                lastContactedAt: new Date(),
                customFields: {
                  ...((reminder.lead.customFields as any) || {}),
                  autoFollowUpSentAt: new Date().toISOString(),
                  lastAutoMessage: content,
                },
              },
            });

            await prisma.message.create({
              data: {
                direction: 'OUTBOUND',
                content,
                status: 'SENT',
                messageId: sendRes.messageId,
                leadId: reminder.leadId,
                sentAt: new Date(),
                metadata: { sessionId: session.id, autoCron: true, reminderId: reminder.id },
              },
            });

            console.log(`[Cron Auto-Followup] WhatsApp sent to ${reminder.lead.name} (${reminder.lead.phone})`);
          }
        }
      }
    } catch (error: any) {
      console.error('[Cron Auto-Followup Error]', error.message);
    }
  });
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
