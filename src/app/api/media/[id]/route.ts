import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getOrgContext } from '@/lib/org'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const org = await getOrgContext()
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const media = await prisma.mediaFile.findUnique({
      where: { id: params.id },
      include: {
        workOrder: { select: { organizationId: true } },
        vehicle: { select: { organizationId: true } },
        quote: { select: { organizationId: true } },
      },
    })
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify the media file belongs to this org
    const mediaOrgId = media.workOrder?.organizationId ?? media.vehicle?.organizationId ?? media.quote?.organizationId
    if (mediaOrgId !== org.orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
