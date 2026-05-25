import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
  'application/pdf',
]

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const entityType = formData.get('entityType') as string // 'workOrder' | 'vehicle' | 'quote'
    const entityId = formData.get('entityId') as string

    if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 })
    if (!entityType || !entityId) return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `סוג קובץ לא נתמך: ${file.type}` }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'קובץ גדול מדי (מקסימום 20MB)' }, { status: 400 })
    }

    // Build filesystem path
    const folderMap: Record<string, string> = {
      workOrder: 'work-orders',
      vehicle: 'vehicles',
      quote: 'quotes',
    }
    const folder = folderMap[entityType]
    if (!folder) return NextResponse.json({ error: 'סוג ישות לא חוקי' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'bin'
    const storedName = `${randomUUID()}.${ext}`
    const dirPath = join(process.cwd(), 'public', 'uploads', folder, entityId)
    const filePath = join(dirPath, storedName)
    const publicUrl = `/uploads/${folder}/${entityId}/${storedName}`

    await mkdir(dirPath, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    // Save metadata to DB
    const mediaFile = await prisma.mediaFile.create({
      data: {
        filename: storedName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: publicUrl,
        workOrderId: entityType === 'workOrder' ? entityId : null,
        vehicleId: entityType === 'vehicle' ? entityId : null,
        quoteId: entityType === 'quote' ? entityId : null,
      },
    })

    return NextResponse.json(mediaFile)
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'שגיאה בהעלאת הקובץ' }, { status: 500 })
  }
}
