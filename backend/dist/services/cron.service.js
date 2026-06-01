"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../lib/prisma");
const setupCronJobs = () => {
    // Daily analytics aggregation - runs at midnight
    node_cron_1.default.schedule('0 0 * * *', async () => {
        console.log('[Cron] Aggregating daily analytics...');
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            yesterday.setHours(0, 0, 0, 0);
            const orgs = await prisma_1.prisma.organization.findMany({ select: { id: true } });
            for (const org of orgs) {
                const [newLeads, wonLeads, messagesSent, repliesReceived, campaigns] = await Promise.all([
                    prisma_1.prisma.lead.count({ where: { orgId: org.id, createdAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86400000) } } }),
                    prisma_1.prisma.lead.count({ where: { orgId: org.id, stage: 'WON', updatedAt: { gte: yesterday } } }),
                    prisma_1.prisma.message.count({ where: { lead: { orgId: org.id }, sentAt: { gte: yesterday }, direction: 'OUTBOUND' } }),
                    prisma_1.prisma.message.count({ where: { lead: { orgId: org.id }, createdAt: { gte: yesterday }, direction: 'INBOUND' } }),
                    prisma_1.prisma.campaign.count({ where: { orgId: org.id, startedAt: { gte: yesterday } } }),
                ]);
                await prisma_1.prisma.dailyAnalytics.upsert({
                    where: { date_orgId: { date: yesterday, orgId: org.id } },
                    create: { date: yesterday, orgId: org.id, newLeads, wonLeads, messagesSent, repliesReceived, campaignsRun: campaigns },
                    update: { newLeads, wonLeads, messagesSent, repliesReceived, campaignsRun: campaigns },
                });
            }
            console.log('[Cron] Daily analytics done');
        }
        catch (error) {
            console.error('[Cron] Analytics error:', error);
        }
    });
    // Clean expired refresh tokens - runs every hour
    node_cron_1.default.schedule('0 * * * *', async () => {
        await prisma_1.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(console.error);
    });
    // Send reminder notifications - every 15 minutes
    node_cron_1.default.schedule('*/15 * * * *', async () => {
        const now = new Date();
        const in15 = new Date(now.getTime() + 15 * 60 * 1000);
        const reminders = await prisma_1.prisma.reminder.findMany({
            where: { status: 'PENDING', dueAt: { gte: now, lte: in15 } },
            include: { lead: { select: { name: true } }, user: { select: { id: true } } },
        });
        for (const reminder of reminders) {
            console.log(`[Cron] Reminder due: ${reminder.title} for ${reminder.lead.name}`);
            // In production: send push notification / email
        }
    });
    // Mark contacted leads with no inbound reply after 24 hours.
    node_cron_1.default.schedule('15 * * * *', async () => {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await prisma_1.prisma.lead.updateMany({
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
exports.setupCronJobs = setupCronJobs;
//# sourceMappingURL=cron.service.js.map