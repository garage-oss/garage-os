/**
 * Storage abstraction — swap providers via STORAGE_PROVIDER env var.
 *
 *  local     → writes to public/uploads/  (development only — Vercel FS is ephemeral)
 *  s3        → AWS S3 / compatible (R2, MinIO)
 *  supabase  → Supabase Storage
 *
 * To add S3: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * To add Supabase: npm install @supabase/supabase-js
 */

import { writeFile, mkdir, unlink } from 'fs/promises'
import { join, extname } from 'path'

// ─── Interface ────────────────────────────────────────────────────────────────

export interface UploadOptions {
  /** Storage key / path within the bucket, e.g. "avatars/abc123.jpg" */
  key:      string
  buffer:   Buffer
  mimeType: string
}

export interface UploadResult {
  /** Public URL to serve to clients */
  url: string
  /** Key for later deletion */
  key: string
}

interface StorageProvider {
  upload(opts: UploadOptions): Promise<UploadResult>
  delete(key: string): Promise<void>
}

// ─── Local provider (development) ────────────────────────────────────────────
//
// ⚠️  Vercel and most PaaS deployments have an ephemeral filesystem.
//     Files written here will be lost on the next deploy/restart.
//     Use STORAGE_PROVIDER=s3 or supabase in production.

class LocalProvider implements StorageProvider {
  async upload({ key, buffer }: UploadOptions): Promise<UploadResult> {
    const dest = join(process.cwd(), 'public', key)
    await mkdir(join(process.cwd(), 'public', key, '..').replace(/[^/\\]*$/, ''), {
      recursive: true,
    })
    await writeFile(dest, buffer)
    return { url: `/${key}`, key }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(process.cwd(), 'public', key))
    } catch {
      // File may already be gone — not an error
    }
  }
}

// ─── S3 provider ─────────────────────────────────────────────────────────────
//
// Works with: AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2.
// Set endpoint via AWS_S3_ENDPOINT for non-AWS providers.

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

class S3Provider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private cdn:    string | undefined

  constructor() {
    const region   = process.env.AWS_REGION ?? 'us-east-1'
    const endpoint = process.env.AWS_S3_ENDPOINT  // for R2/MinIO/etc.

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
    this.bucket = process.env.AWS_S3_BUCKET!
    this.cdn    = process.env.AWS_S3_PUBLIC_URL
  }

  async upload({ key, buffer, mimeType }: UploadOptions): Promise<UploadResult> {
    await this.client.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    }))
    const base = this.cdn
      ? this.cdn.replace(/\/$/, '')
      : `https://${this.bucket}.s3.${process.env.AWS_REGION ?? 'us-east-1'}.amazonaws.com`
    return { url: `${base}/${key}`, key }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
  }
}

// ─── Supabase provider ────────────────────────────────────────────────────────
//
// Uncomment after: npm install @supabase/supabase-js
//
// import { createClient } from '@supabase/supabase-js'
//
// class SupabaseProvider implements StorageProvider {
//   private supabase = createClient(
//     process.env.SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_KEY!,
//   )
//   private bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'avatars'
//
//   async upload({ key, buffer, mimeType }: UploadOptions): Promise<UploadResult> {
//     const { error } = await this.supabase.storage
//       .from(this.bucket)
//       .upload(key, buffer, { contentType: mimeType, upsert: true })
//     if (error) throw error
//
//     const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(key)
//     return { url: data.publicUrl, key }
//   }
//
//   async delete(key: string): Promise<void> {
//     await this.supabase.storage.from(this.bucket).remove([key])
//   }
// }

// ─── Factory ──────────────────────────────────────────────────────────────────

function createProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? 'local'

  switch (provider) {
    case 's3':
      return new S3Provider()
    case 'supabase':
      throw new Error(
        'Supabase provider is not yet wired up. Install @supabase/supabase-js first.'
      )
    default:
      return new LocalProvider()
  }
}

/** Singleton storage provider — swap at runtime via STORAGE_PROVIDER */
export const storage = createProvider()

// ─── Upload validation ────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024   // 5 MB
export const MAX_PHOTO_SIZE  = 20 * 1024 * 1024  // 20 MB (work-order photos)
export const MAX_VOICE_SIZE  = 25 * 1024 * 1024  // 25 MB (voice recordings)

export interface ValidationResult {
  valid:   boolean
  error?:  string
}

export function validateImageUpload(file: File): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    return { valid: false, error: 'סוג קובץ לא נתמך. מותרים: JPEG, PNG, WebP, GIF' }
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      valid: false,
      error: `הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)} MB). מקסימום ${MAX_AVATAR_SIZE / 1024 / 1024} MB`,
    }
  }
  return { valid: true }
}

/** Sanitize a storage key to prevent path traversal */
export function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._\-/]/g, '').slice(0, 512)
}

/** Build a deterministic avatar key from userId + file extension */
export function avatarKey(userId: string, filename: string): string {
  const ext = extname(filename).toLowerCase() || '.jpg'
  return sanitizeKey(`uploads/avatars/${userId}${ext}`)
}
