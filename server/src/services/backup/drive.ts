import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import * as fs from 'fs'
import * as path from 'path'
import { backupConfig } from './config'

export function initDriveClient(): OAuth2Client {
  const auth = new google.auth.OAuth2(
    backupConfig.GOOGLE_DRIVE_CLIENT_ID,
    backupConfig.GOOGLE_DRIVE_CLIENT_SECRET,
    backupConfig.GOOGLE_DRIVE_REDIRECT_URI
  )

  auth.setCredentials({
    refresh_token: backupConfig.GOOGLE_DRIVE_REFRESH_TOKEN,
  })

  return auth
}

export async function verifyDriveAccount(auth: OAuth2Client): Promise<string> {
  const oauth2 = google.oauth2({ version: 'v2', auth })
  const { data } = await oauth2.userinfo.get()

  const email = data.email
  if (!email) {
    throw new Error('Could not retrieve Google account email')
  }

  const expectedEmail = backupConfig.GOOGLE_DRIVE_ACCOUNT_EMAIL
  if (expectedEmail && email.toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new Error(
      `Drive account mismatch: expected ${expectedEmail}, got ${email}`
    )
  }

  return email
}

export async function ensureBackupFolder(
  drive: ReturnType<typeof google.drive>,
  auth: OAuth2Client
): Promise<string> {
  const projectName = backupConfig.PROJECT_NAME

  // Cached folder ID shortcut
  if (backupConfig.GOOGLE_DRIVE_BACKUP_FOLDER_ID) {
    return backupConfig.GOOGLE_DRIVE_BACKUP_FOLDER_ID
  }

  // 1. Find or create parent "DB Backups" folder
  const parentRes = await drive.files.list({
    q: `name = 'DB Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  let parentId: string
  if (parentRes.data.files && parentRes.data.files.length > 0) {
    parentId = parentRes.data.files[0].id!
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: 'DB Backups',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    })
    parentId = created.data.id!
  }

  // 2. Find or create "DB Backups/<PROJECT_NAME>" subfolder
  const subRes = await drive.files.list({
    q: `name = '${projectName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  if (subRes.data.files && subRes.data.files.length > 0) {
    return subRes.data.files[0].id!
  }

  const subCreated = await drive.files.create({
    requestBody: {
      name: projectName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  })

  return subCreated.data.id!
}

export async function uploadBackup(
  drive: ReturnType<typeof google.drive>,
  filePath: string,
  fileName: string,
  folderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const fileSize = fs.statSync(filePath).size
  const fileStream = fs.createReadStream(filePath)

  const response = await drive.files.create(
    {
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'application/octet-stream',
        body: fileStream,
      },
      fields: 'id, webViewLink',
    },
    {
      // Resumable upload for large files
      onUploadProgress: (evt: { bytesRead: number }) => {
        const pct = Math.round((evt.bytesRead / fileSize) * 100)
        process.stdout.write(`\r   Upload progress: ${pct}%`)
      },
    }
  )

  console.log() // newline after progress

  return {
    fileId: response.data.id!,
    webViewLink: response.data.webViewLink || '',
  }
}

export async function listBackupFiles(
  drive: ReturnType<typeof google.drive>,
  folderId: string
): Promise<Array<{ id: string; name: string; size: string; createdTime: string }>> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, size, createdTime)',
    orderBy: 'createdTime desc',
    spaces: 'drive',
    pageSize: 1000,
  })

  return (res.data.files || []).map((f) => ({
    id: f.id || '',
    name: f.name || '',
    size: f.size || '0',
    createdTime: f.createdTime || '',
  }))
}

export async function deleteFile(
  drive: ReturnType<typeof google.drive>,
  fileId: string
): Promise<void> {
  await drive.files.delete({ fileId })
}

