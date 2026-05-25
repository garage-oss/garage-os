import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { email: 'admin@garage.com' },
    update: {},
    create: {
      email: 'admin@garage.com',
      password,
      name: 'מנהל מערכת',
      role: 'ADMIN',
    },
  })

  console.log('✓ Seed complete — admin@garage.com / admin123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
