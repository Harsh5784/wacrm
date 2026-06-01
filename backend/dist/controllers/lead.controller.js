"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeadStats = exports.addNote = exports.exportLeads = exports.importLeads = exports.bulkDeleteLeads = exports.deleteLead = exports.updateLead = exports.createLead = exports.getLead = exports.getLeads = void 0;
const prisma_1 = require("../lib/prisma");
const sync_1 = require("csv-parse/sync");
const cleanupAndDeleteLeads = async (leadIds, orgId) => {
    const uniqueLeadIds = Array.from(new Set(leadIds.filter(Boolean)));
    if (!uniqueLeadIds.length)
        return { deletedCount: 0 };
    return prisma_1.prisma.$transaction(async (tx) => {
        const leads = await tx.lead.findMany({
            where: { id: { in: uniqueLeadIds }, orgId },
            select: { id: true },
        });
        const allowedIds = leads.map((lead) => lead.id);
        if (!allowedIds.length)
            return { deletedCount: 0 };
        await tx.campaignLead.deleteMany({ where: { leadId: { in: allowedIds } } });
        await tx.message.deleteMany({ where: { leadId: { in: allowedIds } } });
        await tx.reminder.deleteMany({ where: { leadId: { in: allowedIds } } });
        await tx.note.deleteMany({ where: { leadId: { in: allowedIds } } });
        await tx.activity.deleteMany({ where: { leadId: { in: allowedIds } } });
        await tx.leadTag.deleteMany({ where: { leadId: { in: allowedIds } } });
        const deleted = await tx.lead.deleteMany({
            where: { id: { in: allowedIds }, orgId },
        });
        return { deletedCount: deleted.count };
    });
};
const getLeads = async (req, res) => {
    try {
        const { page = '1', limit = '20', search, stage, tag, ownerId, sortBy = 'createdAt', sortOrder = 'desc', source, } = req.query;
        const where = { orgId: req.user.orgId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { company: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (stage)
            where.stage = stage;
        if (source)
            where.source = source;
        if (ownerId)
            where.ownerId = ownerId;
        if (tag)
            where.tags = { some: { tag: { name: tag } } };
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [leads, total] = await Promise.all([
            prisma_1.prisma.lead.findMany({
                where,
                include: {
                    tags: { include: { tag: true } },
                    owner: { select: { id: true, name: true, avatar: true } },
                    _count: { select: { notes: true, activities: true, messages: true } },
                },
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: parseInt(limit),
            }),
            prisma_1.prisma.lead.count({ where }),
        ]);
        res.json({
            success: true,
            data: leads,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error('getLeads error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch leads' });
    }
};
exports.getLeads = getLeads;
const getLead = async (req, res) => {
    try {
        const lead = await prisma_1.prisma.lead.findFirst({
            where: { id: req.params.id, orgId: req.user.orgId },
            include: {
                tags: { include: { tag: true } },
                owner: { select: { id: true, name: true, avatar: true } },
                notes: { include: { author: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'desc' } },
                activities: { orderBy: { createdAt: 'desc' }, take: 50 },
                reminders: { where: { status: 'PENDING' }, orderBy: { dueAt: 'asc' } },
                messages: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!lead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        res.json({ success: true, data: lead });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch lead' });
    }
};
exports.getLead = getLead;
const createLead = async (req, res) => {
    try {
        const { tags, ...data } = req.body;
        const lead = await prisma_1.prisma.lead.create({
            data: {
                ...data,
                orgId: req.user.orgId,
                ownerId: data.ownerId || req.user.id,
            },
        });
        if (tags?.length) {
            await prisma_1.prisma.leadTag.createMany({
                data: tags.map((tagId) => ({ leadId: lead.id, tagId })),
                skipDuplicates: true,
            });
        }
        // Log activity
        await prisma_1.prisma.activity.create({
            data: {
                type: 'LEAD_CREATED',
                description: `Lead created`,
                leadId: lead.id,
                userId: req.user.id,
            },
        });
        const fullLead = await prisma_1.prisma.lead.findUnique({
            where: { id: lead.id },
            include: { tags: { include: { tag: true } }, owner: { select: { id: true, name: true } } },
        });
        res.status(201).json({ success: true, data: fullLead });
    }
    catch (error) {
        console.error('createLead error:', error);
        res.status(500).json({ success: false, message: 'Failed to create lead' });
    }
};
exports.createLead = createLead;
const updateLead = async (req, res) => {
    try {
        const { tags, ...data } = req.body;
        const existingLead = await prisma_1.prisma.lead.findFirst({
            where: { id: req.params.id, orgId: req.user.orgId },
        });
        if (!existingLead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        const lead = await prisma_1.prisma.lead.update({
            where: { id: req.params.id },
            data,
        });
        // Track stage changes
        if (data.stage && data.stage !== existingLead.stage) {
            await prisma_1.prisma.activity.create({
                data: {
                    type: 'STAGE_CHANGED',
                    description: `Stage changed from ${existingLead.stage} to ${data.stage}`,
                    metadata: { from: existingLead.stage, to: data.stage },
                    leadId: lead.id,
                    userId: req.user.id,
                },
            });
        }
        // Update tags
        if (tags !== undefined) {
            await prisma_1.prisma.leadTag.deleteMany({ where: { leadId: lead.id } });
            if (tags.length) {
                await prisma_1.prisma.leadTag.createMany({
                    data: tags.map((tagId) => ({ leadId: lead.id, tagId })),
                    skipDuplicates: true,
                });
            }
        }
        const fullLead = await prisma_1.prisma.lead.findUnique({
            where: { id: lead.id },
            include: { tags: { include: { tag: true } }, owner: { select: { id: true, name: true } } },
        });
        res.json({ success: true, data: fullLead });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update lead' });
    }
};
exports.updateLead = updateLead;
const deleteLead = async (req, res) => {
    try {
        const lead = await prisma_1.prisma.lead.findFirst({
            where: { id: req.params.id, orgId: req.user.orgId },
        });
        if (!lead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        await cleanupAndDeleteLeads([req.params.id], req.user.orgId);
        res.json({ success: true, message: 'Lead deleted' });
    }
    catch (error) {
        console.error('deleteLead error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete lead' });
    }
};
exports.deleteLead = deleteLead;
const bulkDeleteLeads = async (req, res) => {
    try {
        if (req.body?.all === true) {
            if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
                return res.status(403).json({ success: false, message: 'Admin access required to delete all leads' });
            }
            const leads = await prisma_1.prisma.lead.findMany({
                where: { orgId: req.user.orgId },
                select: { id: true },
                take: 10000,
            });
            const result = await cleanupAndDeleteLeads(leads.map((lead) => lead.id), req.user.orgId);
            return res.json({
                success: true,
                message: `${result.deletedCount} lead${result.deletedCount === 1 ? '' : 's'} deleted`,
                data: result,
            });
        }
        const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds : [];
        if (!leadIds.length) {
            return res.status(400).json({ success: false, message: 'Select at least one lead to delete' });
        }
        if (leadIds.length > 500) {
            return res.status(400).json({ success: false, message: 'You can delete up to 500 leads at once' });
        }
        const result = await cleanupAndDeleteLeads(leadIds, req.user.orgId);
        if (!result.deletedCount) {
            return res.status(404).json({ success: false, message: 'No matching leads found' });
        }
        res.json({
            success: true,
            message: `${result.deletedCount} lead${result.deletedCount === 1 ? '' : 's'} deleted`,
            data: result,
        });
    }
    catch (error) {
        console.error('bulkDeleteLeads error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete selected leads' });
    }
};
exports.bulkDeleteLeads = bulkDeleteLeads;
const importLeads = async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'CSV file required' });
        const records = (0, sync_1.parse)(req.file.buffer, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        let imported = 0, skipped = 0, errors = [];
        for (const record of records) {
            try {
                const phone = record.phone || record.Phone || record.mobile || record.Mobile;
                const name = record.name || record.Name || record.business_name || 'Unknown';
                if (!phone) {
                    skipped++;
                    continue;
                }
                // Check if exists
                const exists = await prisma_1.prisma.lead.findFirst({
                    where: { phone: phone.trim(), orgId: req.user.orgId },
                });
                if (exists) {
                    skipped++;
                    continue;
                }
                await prisma_1.prisma.lead.create({
                    data: {
                        name: name.trim(),
                        phone: phone.trim(),
                        email: record.email || record.Email || null,
                        company: record.company || record.Company || null,
                        city: record.city || record.City || null,
                        category: record.category || record.Category || null,
                        address: record.address || record.Address || null,
                        source: 'CSV_IMPORT',
                        orgId: req.user.orgId,
                        ownerId: req.user.id,
                    },
                });
                imported++;
            }
            catch (e) {
                errors.push(`Row ${imported + skipped + 1}: ${String(e)}`);
            }
        }
        res.json({
            success: true,
            data: { total: records.length, imported, skipped, errors: errors.slice(0, 10) },
        });
    }
    catch (error) {
        console.error('importLeads error:', error);
        res.status(500).json({ success: false, message: 'Failed to import leads' });
    }
};
exports.importLeads = importLeads;
const exportLeads = async (req, res) => {
    try {
        const org = await prisma_1.prisma.organization.findUnique({ where: { id: req.user.orgId }, select: { settings: true } });
        if (org?.settings?.features?.allowLeadExport === false) {
            return res.status(403).json({ success: false, message: 'Lead export is disabled by super admin' });
        }
        const leads = await prisma_1.prisma.lead.findMany({
            where: { orgId: req.user.orgId },
            include: { tags: { include: { tag: true } } },
        });
        const headers = ['Name', 'Phone', 'Email', 'Company', 'City', 'Category', 'Stage', 'Source', 'Score', 'Tags', 'Created At'];
        const rows = leads.map(l => [
            l.name, l.phone, l.email || '', l.company || '', l.city || '',
            l.category || '', l.stage, l.source, l.score,
            l.tags.map((t) => t.tag.name).join('; '),
            l.createdAt.toISOString(),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
        res.send(csv);
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to export leads' });
    }
};
exports.exportLeads = exportLeads;
const addNote = async (req, res) => {
    try {
        const { content } = req.body;
        const lead = await prisma_1.prisma.lead.findFirst({ where: { id: req.params.id, orgId: req.user.orgId } });
        if (!lead)
            return res.status(404).json({ success: false, message: 'Lead not found' });
        const note = await prisma_1.prisma.note.create({
            data: { content, leadId: lead.id, authorId: req.user.id },
            include: { author: { select: { id: true, name: true, avatar: true } } },
        });
        await prisma_1.prisma.activity.create({
            data: { type: 'NOTE_ADDED', description: 'Note added', leadId: lead.id, userId: req.user.id },
        });
        res.status(201).json({ success: true, data: note });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add note' });
    }
};
exports.addNote = addNote;
const getLeadStats = async (req, res) => {
    try {
        const orgId = req.user.orgId;
        const [byStage, bySource, total, recentActivity] = await Promise.all([
            prisma_1.prisma.lead.groupBy({ by: ['stage'], where: { orgId }, _count: true }),
            prisma_1.prisma.lead.groupBy({ by: ['source'], where: { orgId }, _count: true }),
            prisma_1.prisma.lead.count({ where: { orgId } }),
            prisma_1.prisma.lead.count({ where: { orgId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        ]);
        res.json({
            success: true,
            data: {
                total,
                recentActivity,
                byStage: byStage.map(s => ({ stage: s.stage, count: s._count })),
                bySource: bySource.map(s => ({ source: s.source, count: s._count })),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
};
exports.getLeadStats = getLeadStats;
//# sourceMappingURL=lead.controller.js.map