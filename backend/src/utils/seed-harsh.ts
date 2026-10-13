import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Registering/Upserting Harsh Operator account...');

  const org = await prisma.organization.upsert({
    where: { slug: 'bharat-milk-ops' },
    update: {},
    create: {
      name: 'Bharat Milk Ops',
      slug: 'bharat-milk-ops',
      plan: 'ENTERPRISE',
    },
  });

  const hashedPassword = await bcrypt.hash(process.env.SEED_OPERATOR_PASSWORD || (() => { throw new Error('Set SEED_OPERATOR_PASSWORD'); })(), 12);

  const user = await prisma.user.upsert({
    where: { email: 'harshbha30@gmail.com' },
    update: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      orgId: org.id,
    },
    create: {
      name: 'Harsh Superadmin',
      email: 'harshbha30@gmail.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
      orgId: org.id,
    },
  });

  console.log('✅ Harsh Operator account set up successfully:');
  console.log(`📧 Email: ${user.email}`);
  console.log(`🔑 Password: Hars@30933`);
  console.log(`👑 Role: ${user.role}`);
}

main()
  .catch((e) => {
    console.error('Error seeding Harsh account:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
