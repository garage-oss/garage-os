import { NextRequest, NextResponse } from 'next/server'
import { prisma }                   from '@/lib/prisma'
import { getOrgContext }             from '@/lib/org'
import { storage, validateImageUpload, avatarKey } from '@/lib/storage'
import { LIMITS, applyRateLimitHeaders }           from '@/lib/ratelimit'
import { logger }                    from '@/lib/logger'

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const org = await getOrgContext()
    if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Rate limit (per uploader, not per org) ──────────────────────────────
    const rlResult = await LIMITS.upload(org.userId)
    if (!rlResult.success) {
      const headers = new Headers()
      applyRateLimitHeaders(headers, rlResult)
      return NextResponse.json(
        { error: 'יותר מדי העלאות. נסה שוב מאוחר יותר.' },
        { status: 429, headers }
      )
    }

    // ── Parse form data ─────────────────────────────────────────────────────
    const formData = await req.formData()
    const file     = formData.get('file')   as File | null
    const targetId = formData.get('userId') as string | null

    if (!file || !targetId) {
      return NextResponse.json({ error: 'חסרים פרמטרים: file ו-userId' }, { status: 400 })
    }

    // ── Validate upload ─────────────────────────────────────────────────────
    const validation = validateImageUpload(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // ── Authorization: target user must be in the same org ──────────────────
    // Non-admins can only update their own avatar
    const isOwnAvatar = targetId === org.userId
    const isMgr       = org.memberRole === 'OWNER' || org.memberRole === 'MANAGER'

    if (!isOwnAvatar && !isMgr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: targetId, organizationId: org.orgId },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Store file ──────────────────────────────────────────────────────────
    const key    = avatarKey(targetId, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await storage.upload({ key, buffer, mimeType: file.type })

    // ── Persist URL ─────────────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: targetId },
      data:  { avatarUrl: result.url },
    })

    logger.info('Avatar uploaded', {
      userId:     targetId,
      uploadedBy: org.userId,
      orgId:      org.orgId,
      key,
      sizeBytes:  file.size,
      ms:         Date.now() - t0,
    })

    return NextResponse.json({ avatarUrl: result.url })

  } catch (err) {
    logger.error('Avatar upload error', err)
    return NextResponse.json({ error: 'שגיאה בהעלאת התמונה' }, { status: 500 })
  }
}
