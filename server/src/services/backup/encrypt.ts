import * as crypto from 'crypto'
import * as fs from 'fs'
import { pipeline } from 'stream/promises'
import { createReadStream, createWriteStream } from 'fs'

const MAGIC_HEADER = Buffer.from('GGJENC1') // 7 bytes
const MAGIC_LENGTH = MAGIC_HEADER.length    // 7
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SCRYPT_SALT = 'gopinathji-gems-salt'

function deriveKey(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, SCRYPT_SALT, 32)
}

export async function encryptFile(
  inputPath: string,
  outputPath: string,
  key: string
): Promise<void> {
  const derivedKey = deriveKey(key)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv)

  const writeStream = createWriteStream(outputPath)

  // Write magic header + IV first
  await new Promise<void>((resolve, reject) => {
    writeStream.write(MAGIC_HEADER, (err) => {
      if (err) return reject(err)
      writeStream.write(iv, (err2) => {
        if (err2) return reject(err2)
        resolve()
      })
    })
  })

  // Pipe ciphertext
  const readStream = createReadStream(inputPath)
  await pipeline(readStream, cipher, writeStream, { end: false })

  // Append auth tag
  const authTag = cipher.getAuthTag()
  await new Promise<void>((resolve, reject) => {
    writeStream.write(authTag, (err) => {
      if (err) return reject(err)
      writeStream.end()
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })
  })
}

export async function decryptFile(
  inputPath: string,
  outputPath: string,
  key: string
): Promise<void> {
  const derivedKey = deriveKey(key)

  const fileBuffer = fs.readFileSync(inputPath)

  // Verify magic header
  const magic = fileBuffer.subarray(0, MAGIC_LENGTH)
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Invalid encrypted file: magic header mismatch')
  }

  const iv = fileBuffer.subarray(MAGIC_LENGTH, MAGIC_LENGTH + IV_LENGTH)
  const authTag = fileBuffer.subarray(fileBuffer.length - AUTH_TAG_LENGTH)
  const ciphertext = fileBuffer.subarray(MAGIC_LENGTH + IV_LENGTH, fileBuffer.length - AUTH_TAG_LENGTH)

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  fs.writeFileSync(outputPath, decrypted)
}

