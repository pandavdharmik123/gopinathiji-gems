import * as dotenv from 'dotenv'
import * as path from 'path'
import { z } from 'zod'

// Load .env from server/ directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:8443'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof parsed.data
