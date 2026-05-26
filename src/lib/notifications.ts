/**
 * Notification utilities — fire-and-forget, never blocks the caller.
 *
 * Notification delivery is asynchronous; failures are logged but not re-thrown.
 * For high-reliability delivery (e.g. billing alerts), wire in a queue such as
 * Upstash QStash or a Postgres-backed job runner.
 */

import { NotificationType } from '@prisma/client'
import { prisma }           from '@/lib/prisma'
import { logger }           from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotificationInput {
  orgId:      string
  userId:     string          // recipient user ID
  type:       NotificationType
  title:      string
  message:    string
  entityType?: string
  entityId?:   string
  actionUrl?:  string
}

// ─── Create ───────────────────────────────────────────────────────────────────

/** Create one notification. Fire-and-forget — never throws. */
export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId: input.orgId,
        userId:         input.userId,
        type:           input.type,
        title:          input.title,
        message:        input.message,
        entityType:     input.entityType,
        entityId:       input.entityId,
        actionUrl:      input.actionUrl,
      },
    })
  } catch (err) {
    logger.error('[notifications] create failed', err, { input })
  }
}

/** Create many notifications in one DB round-trip. Fire-and-forget. */
export async function notifyMany(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return
  try {
    await prisma.notification.createMany({
      data: inputs.map((i) => ({
        organizationId: i.orgId,
        userId:         i.userId,
        type:           i.type,
        title:          i.title,
        message:        i.message,
        entityType:     i.entityType,
        entityId:       i.entityId,
        actionUrl:      i.actionUrl,
      })),
    })
  } catch (err) {
    logger.error('[notifications] createMany failed', err, { count: inputs.length })
  }
}

/**
 * Notify all OWNER + MANAGER members of an org.
 * Used for system-level events (low stock, work order completed, etc.)
 */
export async function notifyAdmins(
  orgId: string,
  input: Omit<NotificationInput, 'orgId' | 'userId'>,
): Promise<void> {
  try {
    const admins = await prisma.membership.findMany({
      where: { organizationId: orgId, isActive: true, role: { in: ['OWNER', 'MANAGER'] } },
      select: { userId: true },
    })
    if (admins.length === 0) return
    await notifyMany(admins.map((a) => ({ ...input, orgId, userId: a.userId })))
  } catch (err) {
    logger.error('[notifications] notifyAdmins failed', err, { orgId })
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export interface GetNotificationsOpts {
  take?:       number
  unreadOnly?: boolean
}

export async function getUserNotifications(
  userId: string,
  orgId:  string,
  opts:   GetNotificationsOpts = {},
) {
  const { take = 20, unreadOnly = false } = opts
  return prisma.notification.findMany({
    where: {
      userId,
      organizationId: orgId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

export async function countUnread(userId: string, orgId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, organizationId: orgId, read: false },
  })
}

// ─── Mark read ────────────────────────────────────────────────────────────────

export async function markRead(notificationId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data:  { read: true, readAt: new Date() },
  })
}

export async function markAllRead(userId: string, orgId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, organizationId: orgId, read: false },
    data:  { read: true, readAt: new Date() },
  })
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  QUOTE_APPROVED:            'הצעת מחיר אושרה',
  QUOTE_REJECTED:            'הצעת מחיר נדחתה',
  LOW_STOCK:                 'מלאי נמוך',
  WORK_ORDER_ASSIGNED:       'פקודת עבודה הוקצתה',
  WORK_ORDER_STATUS_CHANGED: 'סטטוס פקודת עבודה שונה',
  WORK_ORDER_COMPLETED:      'פקודת עבודה הושלמה',
  MEMBER_INVITED:            'הזמנת חבר צוות',
  MEMBER_JOINED:             'חבר צוות הצטרף',
  SYSTEM:                    'הודעת מערכת',
}

export const NOTIFICATION_EMOJIS: Record<NotificationType, string> = {
  QUOTE_APPROVED:            '✅',
  QUOTE_REJECTED:            '❌',
  LOW_STOCK:                 '📦',
  WORK_ORDER_ASSIGNED:       '🔧',
  WORK_ORDER_STATUS_CHANGED: '🔄',
  WORK_ORDER_COMPLETED:      '🎉',
  MEMBER_INVITED:            '📧',
  MEMBER_JOINED:             '👋',
  SYSTEM:                    'ℹ️',
}
