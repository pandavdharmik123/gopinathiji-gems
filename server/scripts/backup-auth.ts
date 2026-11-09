#!/usr/bin/env ts-node
// Interactive OAuth2 setup wizard for Google Drive backup
// Usage: ts-node scripts/backup-auth.ts --email=user@gmail.com
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as http from 'http'
import * as url from 'url'
import * as readline from 'readline'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
]

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

async function main() {
  // 1. Validate --email arg
  const email = getArg('email')
  if (!email) {
    console.error('❌ Usage: ts-node scripts/backup-auth.ts --email=user@gmail.com')
    process.exit(1)
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:5555/oauth2callback'

  if (!clientId || !clientSecret) {
    console.error('❌ GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET must be set in .env')
    process.exit(1)
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

  // 2. Generate consent URL
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    login_hint: email,
  })

  // 3. Spawn local HTTP server on the callback URL
  const redirectUrlObj = new URL(redirectUri)
  const port = parseInt(redirectUrlObj.port || '5555', 10)

  let resolveCode!: (code: string) => void
  const codePromise = new Promise<string>((resolve) => {
    resolveCode = resolve
  })

  const server = http.createServer((req, res) => {
    const reqUrl = url.parse(req.url || '', true)
    if (reqUrl.pathname === redirectUrlObj.pathname) {
      const code = reqUrl.query.code as string
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<h1>✅ Authorization successful! You can close this tab.</h1>')
        resolveCode(code)
      } else {
        res.writeHead(400)
        res.end('No code received.')
      }
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  server.listen(port, () => {
    console.log(`\n🔐 Google Drive OAuth2 Setup Wizard`)
    console.log(`   Account: ${email}\n`)
    console.log('   Open this URL in your browser to authorize:')
    console.log(`\n   ${authUrl}\n`)
    console.log(`   Waiting for OAuth callback on port ${port}...`)
  })

  // 4. Wait for callback with code
  const code = await codePromise

  // 5. Exchange code for tokens
  console.log('\n   Exchanging code for tokens...')
  const { tokens } = await auth.getToken(code)
  auth.setCredentials(tokens)

  if (!tokens.refresh_token) {
    console.error('❌ No refresh_token received. Make sure you used prompt: consent.')
    server.close()
    process.exit(1)
  }

  // 6. Create folder structure in Drive
  console.log('   Creating Drive folder structure...')
  const drive = google.drive({ version: 'v3', auth })

  // Create parent "DB Backups"
  let parentId: string
  const parentRes = await drive.files.list({
    q: `name = 'DB Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  if (parentRes.data.files && parentRes.data.files.length > 0) {
    parentId = parentRes.data.files[0].id!
    console.log(`   Found existing "DB Backups" folder: ${parentId}`)
  } else {
    const created = await drive.files.create({
      requestBody: { name: 'DB Backups', mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    })
    parentId = created.data.id!
    console.log(`   Created "DB Backups" folder: ${parentId}`)
  }

  const projectName = process.env.PROJECT_NAME || 'gopinathji-gems'
  const subRes = await drive.files.list({
    q: `name = '${projectName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  })

  let folderId: string
  if (subRes.data.files && subRes.data.files.length > 0) {
    folderId = subRes.data.files[0].id!
    console.log(`   Found existing subfolder: ${folderId}`)
  } else {
    const subCreated = await drive.files.create({
      requestBody: { name: projectName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    })
    folderId = subCreated.data.id!
    console.log(`   Created subfolder "DB Backups/${projectName}": ${folderId}`)
  }

  // 7. Print env vars
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Copy these variables into your .env file:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`GOOGLE_DRIVE_BACKUP_ENABLED=true`)
  console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`)
  console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`)
  console.log(`GOOGLE_DRIVE_REDIRECT_URI=${redirectUri}`)
  console.log(`GOOGLE_DRIVE_ACCOUNT_EMAIL=${email}`)
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`)
  console.log(`GOOGLE_DRIVE_BACKUP_FOLDER_ID=${folderId}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 9. Shut down
  server.close()
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ OAuth setup failed:', err)
  process.exit(1)
})

