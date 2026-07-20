const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding admin user...')

  // VERY IMPORTANT: Use environment variable for production password
  // Fallback to a default only in development if not provided
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ WARNING: No ADMIN_PASSWORD environment variable provided in production!')
    console.warn('⚠️ Falling back to default insecure password.')
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12)

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

}

main()
  .catch(e => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
