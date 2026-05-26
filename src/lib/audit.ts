import { AuditAction, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditEntityType =
  | 'customer'
  | 'vehicle'
  | 'workOrder'
  | 'part'
  | 'supplier'
  | 'quote'
  | 'diagnosticSession'
  | 'mediaFile'
  | 'member'
  | 'invitation'
  | 'organization'
  | 'user'
  | 'paymentLink'
  | 'clockEntry'
  | string  // allow future entity types without TS errors

export interface AuditLogEntry {
  orgId: string
  userId?: string
  userEmail?: string
  userName?: string
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string
  entityLabel?: string
  beforeData?: Record<string, unknown>
  afterData?: Record<string, unknown>
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Fire-and-forget audit logger. Never throws — audit must never block the main operation.
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.orgId,
        userId:         entry.userId,
        userEmail:      entry.userEmail,
        userName:       entry.userName,
        action:         entry.action,
        entityType:     entry.entityType,
        entityId:       entry.entityId,
        entityLabel:    entry.entityLabel,
        beforeData:     entry.beforeData !== undefined ? (entry.beforeData as Prisma.InputJsonValue) : undefined,
        afterData:      entry.afterData  !== undefined ? (entry.afterData  as Prisma.InputJsonValue) : undefined,
      },
    })
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err)
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export type AuditFilter = {
  entityType?: string
  action?: AuditAction
  userId?: string
  take?: number
  skip?: number
}

export async function getAuditLogs(orgId: string, filter: AuditFilter = {}) {
  const { entityType, action, userId, take = 50, skip = 0 } = filter

  return prisma.auditLog.findMany({
    where: {
      organizationId: orgId,
      ...(entityType ? { entityType } : {}),
      ...(action      ? { action }      : {}),
      ...(userId      ? { userId }      : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
  })
}

export async function countAuditLogs(orgId: string, filter: Omit<AuditFilter, 'take' | 'skip'> = {}) {
  const { entityType, action, userId } = filter
  return prisma.auditLog.count({
    where: {
      organizationId: orgId,
      ...(entityType ? { entityType } : {}),
      ...(action      ? { action }      : {}),
      ...(userId      ? { userId }      : {}),
    },
  })
}

export async function getRecentAuditLogs(orgId: string, take = 10) {
  return prisma.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take,
  })
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:                   'יצר',
  UPDATE:                   'עדכן',
  DELETE:                   'מחק',
  LOGIN:                    'התחבר',
  LOGOUT:                   'התנתק',
  INVITE_SENT:              'שלח הזמנה',
  INVITE_ACCEPTED:          'קיבל הזמנה',
  INVITE_REVOKED:           'בטל הזמנה',
  ROLE_CHANGED:             'שינה תפקיד',
  MEMBER_REMOVED:           'הסיר חבר',
  MEMBER_ACTIVATED:         'הפעיל חבר',
  MEMBER_DEACTIVATED:       'השבית חבר',
  PASSWORD_RESET_REQUESTED: 'ביקש איפוס סיסמה',
  FILE_UPLOADED:            'העלה קובץ',
  FILE_DELETED:             'מחק קובץ',
  SETTINGS_UPDATED:         'עדכן הגדרות',
}

export const ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:                   'text-emerald-400 bg-emerald-500/10',
  UPDATE:                   'text-[#6366f1] bg-[#6366f1]/10',
  DELETE:                   'text-red-400 bg-red-500/10',
  LOGIN:                    'text-sky-400 bg-sky-500/10',
  LOGOUT:                   'text-[#8892a4] bg-[#8892a4]/10',
  INVITE_SENT:              'text-amber-400 bg-amber-500/10',
  INVITE_ACCEPTED:          'text-emerald-400 bg-emerald-500/10',
  INVITE_REVOKED:           'text-orange-400 bg-orange-500/10',
  ROLE_CHANGED:             'text-[#6366f1] bg-[#6366f1]/10',
  MEMBER_REMOVED:           'text-red-400 bg-red-500/10',
  MEMBER_ACTIVATED:         'text-emerald-400 bg-emerald-500/10',
  MEMBER_DEACTIVATED:       'text-orange-400 bg-orange-500/10',
  PASSWORD_RESET_REQUESTED: 'text-amber-400 bg-amber-500/10',
  FILE_UPLOADED:            'text-sky-400 bg-sky-500/10',
  FILE_DELETED:             'text-red-400 bg-red-500/10',
  SETTINGS_UPDATED:         'text-[#6366f1] bg-[#6366f1]/10',
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  customer:          'לקוח',
  vehicle:           'רכב',
  workOrder:         'פקודת עבודה',
  part:              'חלק',
  supplier:          'ספק',
  quote:             'הצעת מחיר',
  diagnosticSession: 'אבחון AI',
  mediaFile:         'קובץ',
  member:            'חבר צוות',
  invitation:        'הזמנה',
  organization:      'ארגון',
  user:              'משתמש',
}
