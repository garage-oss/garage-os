import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { prisma } from '@/lib/prisma'
import { getOrgContext } from '@/lib/org'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(req: NextRequest) {
  try {
    const org = await getOrgContext()
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file   = formData.get('file')   as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
    if (!ALLOWED.includes(file.type))  return NextResponse.json({ error: 'סוג קובץ לא נתמך' }, { status: 400 })
    if (file.size > MAX_SIZE)          return NextResponse.json({ error: 'קובץ גדול מדי (מקסימום 2MB)' }, { status: 400 })

    // Verify the target user is in the same org
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId: org.orgId },
    })
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const ext        = extname(file.name) || '.jpg'
    const filename   = `${userId}${ext}`
    const dirPath    = join(process.cwd(), 'public', 'uploads', 'avatars')
    const filePath   = join(dirPath, filename)
    const publicUrl  = `/uploads/avatars/${filename}`

    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()))

    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: publicUrl } })

    return NextResponse.json({ avatarUrl: publicUrl })
  } catch (err) {
    console.error('Avatar upload error:', err)
    return NextResponse.json({ error: 'שגיאה בהעלאת התמונה' }, { status: 500 })
  }
}
