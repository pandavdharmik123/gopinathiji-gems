#!/usr/bin/env ts-node
// CLI: ts-node scripts/backup-restore.ts --file=<driveFileId|latest>
// 1. Download from Drive
// 2. Decrypt if needed
// 3. Prompt "Are you sure? This will restore the database. (yes/no)"
// 4. Run pg_restore --clean --if-exists
// 5. Print result
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import * as readline from 'readline'
import { spawn } from 'child_process'
import * as stream from 'stream'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { google } from 'googleapis'
import { initDriveClient, ensureBackupFolder, listBackupFiles } from '../src/services/backup/drive'
import { decryptFile } from '../src/services/backup/encrypt'
import { isBackupConfigured, backupConfig } from '../src/services/backup/config'

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function downloadFile(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
  destPath: string
): Promise<void> {
  const dest = fs.createWriteStream(destPath)
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  )

  await new Promise<void>((resolve, reject) => {
    const readable = res.data as unknown as stream.Readable
    readable.pipe(dest)
    readable.on('end', resolve)
    readable.on('error', reject)
  })
}

async function main() {
  if (!isBackupConfigured()) {
    console.error('❌ Google Drive credentials are not configured.')
    process.exit(1)
  }

  const fileArg = getArg('file')
  if (!fileArg) {
    console.error('❌ Usage: ts-node scripts/backup-restore.ts --file=<driveFileId|latest>')
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set')
    process.exit(1)
  }

  const auth = initDriveClient()
  const drive = google.drive({ version: 'v3', auth })

  let targetFileId = fileArg

  // Resolve "latest"
  if (fileArg === 'latest') {
    console.log('🔍 Finding latest backup in Drive...')
    const folderId = await ensureBackupFolder(drive, auth)
    const files = await listBackupFiles(drive, folderId)
    if (files.length === 0) {
      console.error('❌ No backup files found in Drive.')
      process.exit(1)
    }
    const latest = files[0]
    targetFileId = latest.id
    console.log(`   Latest: ${latest.name} (${latest.createdTime})`)
  }

  const tmpDir = path.resolve(__dirname, '../backups/tmp')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

  const downloadPath = path.join(tmpDir, `restore-${Date.now()}.download`)
  const dumpPath = path.join(tmpDir, `restore-${Date.now()}.dump`)

  try {
    // 1. Download from Drive
    console.log(`\n☁️  Downloading file ${targetFileId} from Drive...`)
    await downloadFile(drive, targetFileId, downloadPath)
    console.log('✅ Download complete')

    // 2. Decrypt if needed
    const isEncrypted = downloadPath.endsWith('.enc') || (
      (() => {
        const buf = Buffer.alloc(7)
        const fd = fs.openSync(downloadPath, 'r')
        fs.readSync(fd, buf, 0, 7, 0)
        fs.closeSync(fd)
        return buf.toString('utf8') === 'GGJENC1'
      })()
    )

    let restorePath = downloadPath

    if (isEncrypted) {
      const encKey = backupConfig.DB_BACKUP_ENCRYPTION_KEY
      if (!encKey) {
        console.error('❌ File appears encrypted but DB_BACKUP_ENCRYPTION_KEY is not set')
        process.exit(1)
      }
      console.log('🔐 Decrypting backup...')
      await decryptFile(downloadPath, dumpPath, encKey)
      restorePath = dumpPath
      console.log('✅ Decryption complete')
    } else {
      fs.copyFileSync(downloadPath, dumpPath)
      restorePath = dumpPath
    }

    // 3. Confirm
    const confirm = await prompt(
      '\n⚠️  Are you sure? This will restore the database (pg_restore --clean --if-exists). (yes/no): '
    )
    if (confirm.trim().toLowerCase() !== 'yes') {
      console.log('❌ Restore cancelled.')
      process.exit(0)
    }

    // 4. pg_restore
    const dbUrl = new URL(databaseUrl)
    const host = dbUrl.hostname
    const port = dbUrl.port || '5432'
    const dbname = dbUrl.pathname.replace(/^\//, '')
    const user = dbUrl.username
    const password = decodeURIComponent(dbUrl.password)

    console.log(`\n♻️  Running pg_restore on ${dbname}@${host}:${port}...`)

    await new Promise<void>((resolve, reject) => {
      const pgRestore = spawn(
        'pg_restore',
        ['--clean', '--if-exists', '-h', host, '-p', port, '-U', user, '-d', dbname, restorePath],
        {
          env: { ...process.env, PGPASSWORD: password },
          stdio: ['ignore', 'inherit', 'inherit'],
        }
      )

      pgRestore.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pg_restore exited with code ${code}`))
        } else {
          resolve()
        }
      })

      pgRestore.on('error', reject)
    })

    console.log('\n✅ Database restored successfully!')
  } finally {
    // Cleanup
    for (const p of [downloadPath, dumpPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Restore failed:', err)
  process.exit(1)
})

