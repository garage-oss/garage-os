'use client'

import { AuditAction } from '@prisma/client'
import { ACTION_LABELS, ACTION_COLORS, ENTITY_TYPE_LABELS } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  Plus, Pencil, Trash2, LogIn, LogOut, Mail, CheckCircle2,
  XCircle, Shield, UserMinus, UserCheck, UserX, Key, Upload,
  FileX, Settings, User, FileText, Eye, Download,
} from 'lucide-react'

interface AuditEntry {
  id:          string
  action:      AuditAction
  entityType:  string
  entityId:    string | null
  entityLabel: string | null
  userId:      string | null
  userName:    string | null
  userEmail:   string | null
  createdAt:   Date | string
}

const ACTION_ICONS: Record<AuditAction, LucideIcon> = {
  CREATE:                   Plus,
  UPDATE:                   Pencil,
  DELETE:                   Trash2,
  LOGIN:                    LogIn,
  LOGOUT:                   LogOut,
  INVITE_SENT:              Mail,
  INVITE_ACCEPTED:          CheckCircle2,
  INVITE_REVOKED:           XCircle,
  ROLE_CHANGED:             Shield,
  MEMBER_REMOVED:           UserMinus,
  MEMBER_ACTIVATED:         UserCheck,
  MEMBER_DEACTIVATED:       UserX,
  PASSWORD_RESET_REQUESTED: Key,
  FILE_UPLOADED:            Upload,
  FILE_DELETED:             FileX,
  SETTINGS_UPDATED:         Settings,
  DOCUMENT_UPLOADED:        FileText,
  DOCUMENT_VIEWED:          Eye,
  DOCUMENT_DOWNLOADED:      Download,
  DOCUMENT_DELETED:         FileX,
  DOCUMENT_VERIFIED:        CheckCircle2,
  DOCUMENT_REPLACED:        Upload,
}

interface AuditTimelineProps {
  entries: AuditEntry[]
  compact?: boolean
}

export function AuditTimeline({ entries, compact = false }: AuditTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-[#8892a4] text-center py-6">אין פעולות לתצוגה</p>
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      {!compact && <div className="absolute start-[19px] top-0 bottom-0 w-px bg-[#2e3147]" />}

      <div className="space-y-3">
        {entries.map((entry) => {
          const Icon        = ACTION_ICONS[entry.action] ?? User
          const colorClass  = ACTION_COLORS[entry.action] ?? 'text-[#8892a4] bg-[#8892a4]/10'
          const actionLabel = ACTION_LABELS[entry.action] ?? entry.action
          const entityLabel = ENTITY_TYPE_LABELS[entry.entityType] ?? entry.entityType
          const createdAt   = typeof entry.createdAt === 'string' ? new Date(entry.createdAt) : entry.createdAt

          return (
            <div key={entry.id} className={`flex items-start gap-3 ${compact ? '' : 'relative'}`}>
              {/* Icon */}
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                <Icon size={14} />
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${compact ? '' : 'bg-[#252836] rounded-xl px-4 py-3'}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-sm font-medium">{entry.userName ?? entry.userEmail ?? 'מערכת'}</span>
                    {' '}
                    <span className="text-sm text-[#8892a4]">{actionLabel}</span>
                    {' '}
                    {entry.entityLabel && (
                      <span className="text-sm font-medium text-[#e2e8f0]">{entry.entityLabel}</span>
                    )}
                    {!entry.entityLabel && entry.entityType && (
                      <span className="text-sm text-[#8892a4]">({entityLabel})</span>
                    )}
                  </div>
                  <span className="text-xs text-[#8892a4] flex-shrink-0">{formatDate(createdAt)}</span>
                </div>
                {!compact && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${colorClass}`}>{actionLabel}</span>
                    <span className="text-[10px] text-[#8892a4]">{entityLabel}</span>
                    {entry.entityId && (
                      <span className="text-[10px] font-mono text-[#8892a4] truncate max-w-[120px]">{entry.entityId.slice(0, 8)}…</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
