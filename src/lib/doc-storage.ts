/**
 * Private document storage — files are NEVER publicly accessible.
 * Local: stored outside public/ in doc-storage/ directory
 * S3: stored private, served via presigned URL
 */

import { writeFile, mkdir, unlink, readFile } from 'fs/promises'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'

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

/** Build a storage path for a new document */
export function buildDocPath(orgId: string, vehicleId: string, mimeType: string): string {
  const ext = mimeType === 'application/pdf' ? '.pdf'
    : mimeType === 'image/png' ? '.png'
    : '.jpg'
  const uuid = randomUUID()
  return `docs/${orgId}/${vehicleId}/${uuid}${ext}`
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
  try {
    await unlink(join(LOCAL_ROOT, path))
  } catch { /* already gone */ }
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
  const { GetObjectCommand } = require('@aws-sdk/client-s3')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
  return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: path }), { expiresIn: expiresInSeconds })
}

// ─── Public interface ─────────────────────────────────────────────────────────

const provider = process.env.STORAGE_PROVIDER ?? 'local'

export async function docStorageWrite(path: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (provider === 's3') return s3Write(path, buffer, mimeType)
  return localWrite(path, buffer)
}

export async function docStorageRead(path: string): Promise<Buffer> {
  if (provider === 's3') {
    throw new Error('Use docStoragePresignUrl for S3 downloads')
  }
  return localRead(path)
}

export async function docStorageDelete(path: string): Promise<void> {
  if (provider === 's3') return s3Delete(path)
  return localDelete(path)
}

/** Returns a signed URL (S3) or null (local — caller streams the file) */
export async function docStoragePresignUrl(path: string, expiresInSeconds = 60): Promise<string | null> {
  if (provider === 's3') return s3Presign(path, expiresInSeconds)
  return null
}

export const isS3 = provider === 's3'
