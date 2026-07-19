const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding admin user...')

  const passwordHash = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      name: 'Admin',
      passwordHash,
      role: 'admin',
      email: 'admin@example.com',
      status: 'active',
    },
    create: {
      name: 'Admin',
      username: 'admin',
      passwordHash,
      role: 'admin',
      email: 'admin@example.com',
      status: 'active',
    },
  })

  console.log('Admin user seeded')
  console.log('Username: admin')
  console.log('Password: admin123')
}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
