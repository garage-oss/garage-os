/**
 * POST /api/upload/ai-photo
 *
 * Lightweight photo upload endpoint for the AI Quote wizard.
 * Unlike /api/upload (which tracks files against a DB entity),
 * this endpoint just saves the image and returns a public URL so
 * it can be passed to /api/ai-quote → Claude vision.
 *
 * Body: multipart/form-data  { file: File }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir }          from 'fs/promises'
import { join }                      from 'path'
import { randomUUID }                from 'crypto'
import { getOrgContext }             from '@/lib/org'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif',
]
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB

export async function POST(req: NextRequest) {
  // Auth — must be logged-in org member
  const org = await getOrgContext()
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let file: File | null = null
  try {
    const fd = await req.formData()
    file = fd.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'לא נבחרה תמונה' }, { status: 400 })
  }

  const mime = file.type.toLowerCase()
  if (!ALLOWED_TYPES.includes(mime)) {
    return NextResponse.json(
      { error: `סוג קובץ לא נתמך: ${mime}. השתמש ב-JPG, PNG או WEBP` },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'תמונה גדולה מדי — מקסימום 10MB' },
      { status: 400 },
    )
  }

  const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const filename = `${randomUUID()}.${ext}`
  const dir      = join(process.cwd(), 'public', 'uploads', 'ai-photos')

  try {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    console.error('[ai-photo upload]', err)
    return NextResponse.json({ error: 'שגיאה בשמירת הקובץ' }, { status: 500 })
  }

  return NextResponse.json({ url: `/uploads/ai-photos/${filename}` })
}
