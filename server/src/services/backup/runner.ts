import * as fs from 'fs'
import { google } from 'googleapis'
import { prisma } from '../../lib/prisma'
import { backupConfig, isBackupConfigured } from './config'
import { dumpDatabase } from './dump'
import { encryptFile } from './encrypt'
import { initDriveClient, verifyDriveAccount, ensureBackupFolder, uploadBackup, listBackupFiles, deleteFile } from './drive'
import { applyRetention } from './retention'
import type { BackupRun } from '@prisma/client'

export type RunTrigger = 'SCHEDULED' | 'MANUAL' | 'CLI'

export interface RunOptions {
  dryRun?: boolean
}

export async function runBackup(
  trigger: RunTrigger,
  options: RunOptions = {}
): Promise<BackupRun> {
  const { dryRun = false } = options
  const startedAt = new Date()

  if (dryRun) {
    console.log('🔵 [DryRun] Starting backup (dry-run mode — no uploads or DB writes)')
  }

  // 1. Create BackupRun record
  let run: BackupRun | null = null
  if (!dryRun) {
    run = await prisma.backupRun.create({
      data: {
        status: 'RUNNING' as const,
        trigger: trigger as 'SCHEDULED' | 'MANUAL' | 'CLI',
      },
    })
    console.log(`📝 BackupRun created: ${run.id}`)
  }

  let dumpFilePath: string | null = null
  let finalFilePath: string | null = null

  try {
    // 2. pg_dump
    console.log('📦 Running pg_dump...')
    const dump = await dumpDatabase()
    dumpFilePath = dump.filePath
    finalFilePath = dump.filePath
    console.log(`✅ pg_dump complete: ${dump.fileName} (${dump.fileSizeBytes} bytes)`)

    let encryptionUsed = false
    let fileName = dump.fileName

    // 3. Encrypt if key is set
    if (backupConfig.DB_BACKUP_ENCRYPTION_KEY) {
      console.log('🔐 Encrypting backup...')
      const encryptedPath = dump.filePath + '.enc'
      await encryptFile(dump.filePath, encryptedPath, backupConfig.DB_BACKUP_ENCRYPTION_KEY)
      finalFilePath = encryptedPath
      fileName = dump.fileName + '.enc'
      encryptionUsed = true
      console.log('✅ Encryption complete')
    }

    if (dryRun) {
      console.log(`🔵 [DryRun] Would upload: ${fileName}`)
      console.log(`🔵 [DryRun] Encryption used: ${encryptionUsed}`)
      console.log(`🔵 [DryRun] Checksum: ${dump.checksumSha256}`)
      // Clean up temp files
      cleanupFiles([dumpFilePath, finalFilePath])
      // Return a fake run object for dry-run
      return {
        id: 'dry-run',
        startedAt,
        completedAt: new Date(),
        status: 'SUCCESS' as const,
        trigger: trigger as 'SCHEDULED' | 'MANUAL' | 'CLI',
        fileSizeBytes: dump.fileSizeBytes,
        checksumSha256: dump.checksumSha256,
        driveFileId: null,
        driveFileName: null,
        driveFolderId: null,
        accountEmail: null,
        encryptionUsed,
        errorMessage: null,
        durationMs: Date.now() - startedAt.getTime(),
      } as BackupRun
    }

    // 4. Upload to Google Drive
    if (!isBackupConfigured()) {
      throw new Error('Google Drive credentials are not configured')
    }

    const auth = initDriveClient()
    const accountEmail = await verifyDriveAccount(auth)
    console.log(`✅ Drive account verified: ${accountEmail}`)

    const drive = google.drive({ version: 'v3', auth })
    const folderId = await ensureBackupFolder(drive, auth)
    console.log(`📁 Drive folder: ${folderId}`)

    console.log(`☁️  Uploading ${fileName} to Drive...`)
    const { fileId } = await uploadBackup(drive, finalFilePath!, fileName, folderId)
    console.log(`✅ Upload complete, fileId: ${fileId}`)

    // 5. Apply retention
    console.log('🗑️  Applying retention policy...')
    const allFiles = await listBackupFiles(drive, folderId)
    const { prune } = applyRetention(allFiles)

    for (const fileIdToPrune of prune) {
      console.log(`   Pruning: ${fileIdToPrune}`)
      await deleteFile(drive, fileIdToPrune)
    }
    console.log(`✅ Retention: kept ${allFiles.length - prune.length}, pruned ${prune.length}`)

    // 6. Update BackupRun as SUCCESS
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    const updatedRun = await prisma.backupRun.update({
      where: { id: run!.id },
      data: {
        status: 'SUCCESS' as const,
        completedAt,
        fileSizeBytes: dump.fileSizeBytes,
        checksumSha256: dump.checksumSha256,
        driveFileId: fileId,
        driveFileName: fileName,
        driveFolderId: folderId,
        accountEmail,
        encryptionUsed,
        durationMs,
      },
    })

    console.log(`✅ Backup completed in ${durationMs}ms`)

    // Clean up local temp files
    cleanupFiles([dumpFilePath, finalFilePath])

    return updatedRun
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('❌ Backup failed:', errorMessage)

    // 7. Update BackupRun as FAILED
    if (!dryRun && run) {
      await prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED' as const,
          completedAt: new Date(),
          errorMessage,
          durationMs: Date.now() - startedAt.getTime(),
        },
      }).catch((_updateErr: unknown) => {
        console.error('Failed to update BackupRun as FAILED:', _updateErr)
      })
    }

    // Clean up temp files
    cleanupFiles([dumpFilePath, finalFilePath])

    throw err
  }
}

function cleanupFiles(paths: (string | null)[]): void {
  const unique = [...new Set(paths.filter(Boolean))]
  for (const p of unique) {
    try {
      if (p && fs.existsSync(p)) {
        fs.unlinkSync(p)
      }
    } catch {
      // best-effort
    }
  }
}
