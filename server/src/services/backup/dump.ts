import { spawn } from 'child_process'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { backupConfig } from './config'

export interface DumpResult {
  filePath: string
  fileName: string
  fileSizeBytes: bigint
  checksumSha256: string
  timestamp: string
}

function parseDatabaseUrl(databaseUrl: string): {
  host: string
  port: string
  dbname: string
  user: string
  password: string
} {
  const url = new URL(databaseUrl)
  return {
    host: url.hostname,
    port: url.port || '5432',
    dbname: url.pathname.replace(/^\//, ''),
    user: url.username,
    password: decodeURIComponent(url.password),
  }
}

function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export async function dumpDatabase(): Promise<DumpResult> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  const { host, port, dbname, user, password } = parseDatabaseUrl(databaseUrl)

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const projectName = backupConfig.PROJECT_NAME
  const fileName = `${projectName}-${timestamp}.dump`

  // Resolve backups/tmp relative to the server root (two levels up from src/services/backup)
  const tmpDir = path.resolve(__dirname, '../../../backups/tmp')
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true })
  }

  const filePath = path.join(tmpDir, fileName)

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn(
      'pg_dump',
      ['-Fc', '-Z', '9', '-h', host, '-p', port, '-U', user, '-d', dbname],
      {
        env: {
          ...process.env,
          PGPASSWORD: password,
        },
      }
    )

    const writeStream = fs.createWriteStream(filePath)
    pgDump.stdout.pipe(writeStream)

    const stderrChunks: Buffer[] = []
    pgDump.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    pgDump.on('close', (code) => {
      writeStream.close()
      if (code !== 0) {
        const stderrMsg = Buffer.concat(stderrChunks).toString('utf8')
        // Clean up partial file
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        reject(new Error(`pg_dump exited with code ${code}: ${stderrMsg}`))
      } else {
        resolve()
      }
    })

    pgDump.on('error', (err) => {
      writeStream.close()
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      reject(new Error(`Failed to spawn pg_dump: ${err.message}`))
    })
  })

  const stat = fs.statSync(filePath)
  const checksumSha256 = await computeSha256(filePath)

  return {
    filePath,
    fileName,
    fileSizeBytes: BigInt(stat.size),
    checksumSha256,
    timestamp,
  }
}

