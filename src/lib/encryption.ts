/**
 * Field-level encryption using AES-256-GCM.
 *
 * Use for PII that must not be plaintext in the database (e.g. phone numbers
 * if GDPR/PDPA requires it, payment tokens, etc.).
 *
 * Key: 32-byte hex string in ENCRYPTION_KEY env var.
 * Generate with: openssl rand -hex 32
 *
 * Ciphertext format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * All three are hex-encoded and joined with colons so the stored value is
 * a single opaque string that can round-trip through a TEXT column.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES   = 12   // 96-bit IV recommended for GCM
const TAG_BYTES  = 16   // 128-bit auth tag

// ─── Key helper ───────────────────────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string. ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  return Buffer.from(hex, 'hex')
}

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns a colon-separated iv:tag:ciphertext string.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_BYTES)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':')
}

/**
 * Decrypt a value produced by `encrypt`.
 * Returns null if the value is null/empty (not yet encrypted).
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null

  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    // Treat as already-plaintext (migration period — values not yet encrypted)
    return ciphertext
  }

  const [ivHex, tagHex, dataHex] = parts
  const key = getKey()

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    // Auth tag mismatch = tampered data or wrong key
    throw new Error('Decryption failed — ciphertext may be corrupted or the key has changed')
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Encrypt only when ENCRYPTION_KEY is present; otherwise return plaintext */
export function encryptIfEnabled(value: string): string {
  if (!process.env.ENCRYPTION_KEY) return value
  return encrypt(value)
}

/** Decrypt only when value looks encrypted; otherwise return as-is */
export function decryptIfEncrypted(value: string | null | undefined): string | null {
  if (!value) return null
  // A raw phone / email never contains colons flanking 24-char hex chunks
  if (!value.includes(':')) return value
  try {
    return decrypt(value)
  } catch {
    return value  // Return as-is if decryption fails during migration
  }
}

/** Deterministic HMAC-SHA256 hash for indexed lookups on encrypted fields */
import { createHmac } from 'crypto'

export function hashForLookup(value: string): string {
  const key = process.env.ENCRYPTION_KEY ?? 'no-key'
  return createHmac('sha256', Buffer.from(key, 'hex').slice(0, 32))
    .update(value.toLowerCase().trim())
    .digest('hex')
}
