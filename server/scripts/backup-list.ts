#!/usr/bin/env ts-node
// CLI: ts-node scripts/backup-list.ts
// Lists all backup files in Google Drive with name, size, date
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { google } from 'googleapis'
import { initDriveClient, ensureBackupFolder, listBackupFiles } from '../src/services/backup/drive'
import { isBackupConfigured } from '../src/services/backup/config'

async function main() {
  if (!isBackupConfigured()) {
    console.error('❌ Google Drive credentials are not configured. Run backup-auth.ts first.')
    process.exit(1)
  }

  console.log('\n📋 Listing Google Drive backup files...\n')

  const auth = initDriveClient()
  const drive = google.drive({ version: 'v3', auth })
  const folderId = await ensureBackupFolder(drive, auth)
  const files = await listBackupFiles(drive, folderId)

  if (files.length === 0) {
    console.log('No backup files found in Drive.')
    process.exit(0)
  }

  console.log(`Found ${files.length} file(s) in folder: ${folderId}\n`)
  console.log('  ID'.padEnd(35) + 'Name'.padEnd(55) + 'Size (bytes)'.padEnd(16) + 'Created At')
  console.log('  ' + '─'.repeat(130))

  for (const f of files) {
    const sizeStr = f.size ? parseInt(f.size).toLocaleString() : '—'
    const created = f.createdTime ? new Date(f.createdTime).toLocaleString('en-IN') : '—'
    console.log(`  ${f.id.padEnd(33)} ${f.name.padEnd(53)} ${sizeStr.padEnd(14)} ${created}`)
  }

  console.log()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})

