/**
 * Notification polling API
 *
 * GET  /api/notifications         — recent notifications + unread count
 * PATCH /api/notifications        — mark all notifications as read
 *
 * Polled every 30 s by NotificationBell. Replace with Server-Sent Events or
 * WebSockets if you need sub-second delivery in a future iteration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }              from '@/lib/org'
import { getUserNotifications, countUnread, markAllRead } from '@/lib/notifications'
import { LIMITS, applyRateLimitHeaders } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Light rate-limit: 120 requests/min per user (2/sec — covers 30s polling)
  const rl = await LIMITS.api(org.userId)
  if (!rl.success) {
    const headers = new Headers()
    applyRateLimitHeaders(headers, rl)
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers })
  }

  const url        = new URL(req.url)
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true'
  const take       = Math.min(parseInt(url.searchParams.get('take') ?? '20'), 50)

  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(org.userId, org.orgId, { take, unreadOnly }),
    countUnread(org.userId, org.orgId),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH() {
  const org = await getOrgContext()
  if (!org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markAllRead(org.userId, org.orgId)
  return NextResponse.json({ ok: true })
}
