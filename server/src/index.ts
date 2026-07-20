import './config/env' // Must be first — validates env vars
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { env } from './config/env'
import { prisma } from './lib/prisma'
import { errorHandler } from './middleware/errorHandler'

// ─── Routes ───────────────────────────────────────────────────────────────────
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import partyRoutes from './routes/parties'
import transactionRoutes from './routes/transactions'
import accountingYearsRoutes from './routes/accountingYears'
import auditLogRoutes from './routes/auditLogs'
import notificationRoutes from './routes/notifications'
import settingsRoutes from './routes/settings'
import reportRoutes from './routes/reports'
import expenseCategoryRoutes from './routes/expenseCategories'

const app = express()
app.set('trust proxy', 1) // Trust Render's reverse proxy for rate limiting
// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for login endpoint
  message: { success: false, message: 'Too many login attempts, please try again later' },
})
app.use('/api/', limiter)
app.use('/api/auth/login', authLimiter)

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ─── Logging ──────────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'))
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: env.NODE_ENV })
})

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/parties', partyRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/accounting-years', accountingYearsRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/expense-categories', expenseCategoryRoutes)

// ─── Transliteration Proxy ───────────────────────────────────────────────────
app.get('/api/transliterate/:lang/:text', async (req, res, next) => {
  const { lang, text } = req.params
  try {
    const googleUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&ime=transliteration_en_${lang}&num=5`
    const response = await fetch(googleUrl)
    const data = (await response.json()) as any
    if (data && data[0] === 'SUCCESS') {
      const suggestions = data[1][0][1] || []
      return res.json({
        result: suggestions,
        output: [{ target: suggestions }]
      })
    }
    return res.json({
      result: [text],
      output: [{ target: [text] }]
    })
  } catch (err) {
    console.error('Transliteration proxy failed:', err)
    return res.json({
      result: [text],
      output: [{ target: [text] }]
    })
  }
})

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler)

// ─── Start Server ─────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')

    app.listen(env.PORT, () => {
      console.log(`\n🚀 Jikadara ERP Server running`)
      console.log(`   → http://localhost:${env.PORT}`)
      console.log(`   → http://localhost:${env.PORT}/health`)
      console.log(`   → Environment: ${env.NODE_ENV}\n`)
    })
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

bootstrap()

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await prisma.$disconnect()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

export default app
