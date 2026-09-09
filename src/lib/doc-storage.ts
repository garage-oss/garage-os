/**
 * Private document storage — files are NEVER publicly accessible.
 *
 * Providers:
 *   local    — on-disk (dev only; not persistent in serverless)
 *   s3       — AWS S3 private bucket, served via presigned URL
 *   supabase — Supabase Storage private bucket, served via signed URL
 *
 * Path structure: {orgId}/{customerId}/{vehicleId}/{docId}/{sanitizedFilename}
 * This ensures uniqueness per document and prevents path-traversal attacks.
 */

import { writeFile, mkdir, unlink, readFile } from 'fs/promises'
import { join, basename }                      from 'path'
import { randomUUID }                          from 'crypto'

// ─── Validation constants ─────────────────────────────────────────────────────

export const DOC_ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const
export type DocMimeType = (typeof DOC_ALLOWED_MIME)[number]
export const DOC_MAX_SIZE = 10 * 1024 * 1024 // 10 MB
export const DOC_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf']

export function validateDocUpload(mimeType: string, size: number): { valid: boolean; error?: string } {
  if (!DOC_ALLOWED_MIME.includes(mimeType as DocMimeType)) {
    return { valid: false, error: 'סוג קובץ לא נתמך. מותרים: JPG, PNG, PDF' }
  }
  if (size > DOC_MAX_SIZE) {
    return { valid: false, error: `הקובץ גדול מדי (${(size / 1024 / 1024).toFixed(1)} MB). מקסימום 10 MB` }
  }
  return { valid: true }
}

/**
 * Sanitize a filename: keep only the base name, strip path separators,
 * and replace any character that isn't alphanumeric, dot, dash, or underscore.
 */
function sanitizeFilename(name: string): string {
  const base = basename(name).replace(/[^a-zA-Z0-9._-]/g, '_')
  return base.slice(0, 100) || 'document'
}

/**
 * Build a private storage path for a new document.
 * Path: {orgId}/{customerId}/{vehicleId}/{docId}/{sanitizedFilename}
 * A fresh UUID is generated for docId so callers don't control any path segment.
 */
export function buildDocPath(
  orgId:      string,
  customerId: string,
  vehicleId:  string,
  mimeType:   string,
  originalName?: string,
): { path: string; docId: string } {
  const ext = mimeType === 'application/pdf' ? '.pdf'
    : mimeType === 'image/png' ? '.png'
    : '.jpg'
  const docId   = randomUUID()
  const safeName = originalName
    ? sanitizeFilename(originalName)
    : `document${ext}`
  // Ensure the extension matches the MIME type
  const nameWithExt = safeName.endsWith(ext) ? safeName : safeName.replace(/\.[^.]+$/, '') + ext
  return { path: `${orgId}/${customerId}/${vehicleId}/${docId}/${nameWithExt}`, docId }
}

// ─── Local provider ───────────────────────────────────────────────────────────

const LOCAL_ROOT = join(process.cwd(), 'doc-storage')

async function localWrite(path: string, buffer: Buffer): Promise<void> {
  const full = join(LOCAL_ROOT, path)
  const dir  = full.replace(/[/\\][^/\\]*$/, '')
  await mkdir(dir, { recursive: true })
  await writeFile(full, buffer)
}

async function localRead(path: string): Promise<Buffer> {
  return readFile(join(LOCAL_ROOT, path))
}

async function localDelete(path: string): Promise<void> {
  try { await unlink(join(LOCAL_ROOT, path)) } catch { /* already gone */ }
}

// ─── S3 provider ─────────────────────────────────────────────────────────────

let _s3: import('@aws-sdk/client-s3').S3Client | null = null

function getS3(): import('@aws-sdk/client-s3').S3Client {
  if (_s3) return _s3
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { S3Client } = require('@aws-sdk/client-s3')
  _s3 = new S3Client({
    region:   process.env.AWS_REGION ?? 'us-east-1',
    ...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT, forcePathStyle: true } : {}),
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  return _s3!
}

async function s3Write(path: string, buffer: Buffer, mimeType: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PutObjectCommand } = require('@aws-sdk/client-s3')
  await getS3().send(new PutObjectCommand({
    Bucket:      process.env.AWS_S3_BUCKET!,
    Key:         path,
    Body:        buffer,
    ContentType: mimeType,
  }))
}

async function s3Delete(path: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
  await getS3().send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: path }))
}

async function s3Presign(path: string, expiresInSeconds = 60): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GetObjectCommand }  = require('@aws-sdk/client-s3')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSignedUrl }      = require('@aws-sdk/s3-request-presigner')
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: path }), { expiresIn: expiresInSeconds })
}

// ─── Supabase Storage provider ────────────────────────────────────────────────

const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'vehicle-documents'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set when STORAGE_PROVIDER=supabase')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createClient } = require('@supabase/supabase-js')
  // Service role key — server-side only, never sent to browser
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function supabaseWrite(path: string, buffer: Buffer, mimeType: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert:      true, // replace on re-upload (document replacement)
    duplex:      'half',
  })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)
}

async function supabaseDelete(path: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.storage.from(SUPABASE_BUCKET).remove([path])
  if (error) throw new Error(`Supabase delete failed: ${error.message}`)
}

/**
 * Returns a short-lived signed URL for private Supabase Storage access.
 * Default: 120 seconds — enough for a download/preview, not cacheable long-term.
 */
async function supabaseSignedUrl(path: string, expiresInSeconds = 120): Promise<string> {
  const sb = getSupabase()
  const { data, error } = await sb.storage.from(SUPABASE_BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) throw new Error(`Supabase signed URL failed: ${error?.message}`)
  return data.signedUrl
}

// ─── Public interface ─────────────────────────────────────────────────────────

const provider = (process.env.STORAGE_PROVIDER ?? 'local') as 'local' | 's3' | 'supabase'

export async function docStorageWrite(path: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (provider === 's3')       return s3Write(path, buffer, mimeType)
  if (provider === 'supabase') return supabaseWrite(path, buffer, mimeType)
  return localWrite(path, buffer)
}

export async function docStorageRead(path: string): Promise<Buffer> {
  if (provider === 's3' || provider === 'supabase') {
    throw new Error('Use docStoragePresignUrl for remote storage downloads')
  }
  return localRead(path)
}

export async function docStorageDelete(path: string): Promise<void> {
  if (provider === 's3')       return s3Delete(path)
  if (provider === 'supabase') return supabaseDelete(path)
  return localDelete(path)
}

/**
 * Returns a signed URL for remote providers, or null for local (caller streams the file).
 * URLs are short-lived and must NOT be cached or sent to persistent storage.
 */
export async function docStoragePresignUrl(path: string, expiresInSeconds = 120): Promise<string | null> {
  if (provider === 's3')       return s3Presign(path, expiresInSeconds)
  if (provider === 'supabase') return supabaseSignedUrl(path, expiresInSeconds)
  return null
}

export const isRemoteStorage = provider === 's3' || provider === 'supabase'

/** @deprecated use isRemoteStorage */
export const isS3 = isRemoteStorage
