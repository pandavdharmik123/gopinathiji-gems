#!/usr/bin/env ts-node
// CLI backup runner: ts-node scripts/backup.ts [--dry-run]
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { runBackup } from '../src/services/backup/runner'

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`\n🚀 Starting CLI backup${dryRun ? ' (DRY RUN)' : ''}...\n`)

  try {
    const run = await runBackup('CLI', { dryRun })

    console.log('\n✅ Backup completed successfully!')
    console.log('─────────────────────────────────────')
    console.log(`  Run ID       : ${run.id}`)
    console.log(`  Status       : ${run.status}`)
    console.log(`  Trigger      : ${run.trigger}`)
    console.log(`  Started At   : ${run.startedAt}`)
    console.log(`  Completed At : ${run.completedAt}`)
    console.log(`  Duration     : ${run.durationMs}ms`)
    console.log(`  File Size    : ${run.fileSizeBytes} bytes`)
    console.log(`  Checksum     : ${run.checksumSha256}`)
    console.log(`  Drive File   : ${run.driveFileName} (${run.driveFileId})`)
    console.log(`  Encrypted    : ${run.encryptionUsed}`)
    console.log('─────────────────────────────────────\n')

    process.exit(0)
  } catch (err) {
    console.error('\n❌ Backup failed:', err)
    process.exit(1)
  }
}

main()

