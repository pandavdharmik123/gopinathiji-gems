/**
 * Apply the database invariants documented in prisma/sql/constraints.sql.
 *
 * Prisma's schema language cannot express CHECK constraints, partial unique
 * indexes or exclusion constraints, so they live in plain SQL and are applied
 * by this idempotent script.
 *
 * Usage (from server/):
 *   DATABASE_URL=... npm run db:constraints
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { readFileSync } from 'node:fs'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const sqlPath = path.resolve(__dirname, '../prisma/sql/constraints.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  console.log('Applying database constraints from prisma/sql/constraints.sql…')
  // Prisma's raw executor only accepts one statement per call, so the SQL file
  // separates statements with a `--;;` marker (plain `;` appears inside
  // PL/pgSQL DO blocks and string literals).
  const statements = sql
    .split('--;;')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }

  console.log(`✅ Applied ${statements.length} constraint statements.`)
}

main()
  .catch((err) => {
    console.error('❌ Failed to apply database constraints:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
