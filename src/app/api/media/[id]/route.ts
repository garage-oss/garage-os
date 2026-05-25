import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const media = await prisma.mediaFile.findUnique({ where: { id: params.id } })
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete from filesystem
    const fsPath = join(process.cwd(), 'public', media.url)
    try {
      await unlink(fsPath)
    } catch {
      // File might already be gone — continue with DB delete
    }

    await prisma.mediaFile.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete media error:', err)
    return NextResponse.json({ error: 'שגיאה במחיקת הקובץ' }, { status: 500 })
  }
}
