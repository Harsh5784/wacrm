import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const superAdminOrg = await prisma.organization.upsert({
    where: { slug: 'wacrm-platform' },
    update: {},
    create: {
      name: 'WACrm Platform',
      slug: 'wacrm-platform',
      plan: 'ENTERPRISE',
    },
  });

  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12);

  await prisma.user.upsert({
    where: { email: 'owner@wacrm.pro' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'owner@wacrm.pro',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      orgId: superAdminOrg.id,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'wacrm-demo' },
    update: {},
    create: {
      name: 'WACrm Demo Business',
      slug: 'wacrm-demo',
      plan: 'PROFESSIONAL',
    },
  });

  const adminPassword = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@wacrm.pro' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@wacrm.pro',
      password: adminPassword,
      role: 'ADMIN',
      orgId: org.id,
    },
  });

  const leadData = [
    { name: 'Rahul Sharma', phone: '+919876543210', company: 'Sharma Traders', city: 'Mumbai', category: 'Retail', stage: 'QUALIFIED', score: 85 },
    { name: 'Priya Patel', phone: '+919876543211', company: 'Patel Enterprises', city: 'Ahmedabad', category: 'Manufacturing', stage: 'PROPOSAL', score: 72 },
    { name: 'Amit Kumar', phone: '+919876543212', company: 'Kumar Tech', city: 'Bangalore', category: 'IT Services', stage: 'NEW', score: 45 },
    { name: 'Sunita Devi', phone: '+919876543213', company: 'Devi Jewellers', city: 'Jaipur', category: 'Jewellery', stage: 'CONTACTED', score: 60 },
    { name: 'Vikram Singh', phone: '+919876543214', company: 'Singh Logistics', city: 'Delhi', category: 'Logistics', stage: 'WON', score: 95 },
    { name: 'Meera Nair', phone: '+919876543215', company: 'Nair Consultants', city: 'Kochi', category: 'Consulting', stage: 'NEGOTIATION', score: 78 },
    { name: 'Rajesh Gupta', phone: '+919876543216', company: 'Gupta Chemicals', city: 'Pune', category: 'Chemicals', stage: 'QUALIFIED', score: 65 },
    { name: 'Anita Reddy', phone: '+919876543217', company: 'Reddy Pharma', city: 'Hyderabad', category: 'Pharma', stage: 'NEW', score: 40 },
  ];

  const leads = [];

  for (const ld of leadData) {
    const existing = await prisma.lead.findFirst({
      where: { phone: ld.phone, orgId: org.id },
    });

    if (!existing) {
      const lead = await prisma.lead.create({
        data: {
          ...ld,
          orgId: org.id,
          ownerId: admin.id,
          source: 'MANUAL',
        } as any,
      });

      leads.push(lead);
    }
  }

  if (leads.length > 0) {
    await prisma.campaign.create({
      data: {
        name: 'Welcome Campaign Q1',
        description: 'Initial outreach to new leads',
        messageTemplate:
          'Hi {{name}}! We are reaching out from WACrm. We noticed your business in {{city}} and would love to connect. Can we schedule a quick call?',
        status: 'COMPLETED',
        totalSent: 45,
        totalDelivered: 42,
        totalFailed: 3,
        totalReplied: 12,
        orgId: org.id,
        createdById: admin.id,
      },
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 SUPER ADMIN LOGIN');
  console.log('📧 owner@wacrm.pro');
  console.log('🔑 SuperAdmin@123');

  console.log('\n📧 ADMIN LOGIN');
  console.log('📧 admin@wacrm.pro');
  console.log('🔑 Admin@123');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());