import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const KEY_LENGTH = 32
const IV_LENGTH = 16

/**
 * Derives a proper encryption key from the secret using scrypt
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.CANVAS_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error('CANVAS_ENCRYPTION_SECRET environment variable is not set')
  }

  // Derive a 32-byte key from the secret using scryptSync
  const salt = 'canvas-token-encryption' // Fixed salt for consistent key derivation
  return crypto.scryptSync(secret, salt, KEY_LENGTH)
}

/**
 * Encrypts a Canvas token using AES-256-CBC
 * @param token - The Canvas API token to encrypt
 * @returns Object containing the encrypted token and initialization vector
 */
export function encryptToken(token: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return {
    encrypted,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypts a Canvas token using AES-256-CBC
 * @param encrypted - The encrypted token (hex string)
 * @param iv - The initialization vector (hex string)
 * @returns The decrypted Canvas API token
 */
export function decryptToken(encrypted: string, iv: string): string {
  const key = getEncryptionKey()
  const ivBuffer = Buffer.from(iv, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
