'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { Bell, BellDot, Check, ExternalLink, Loader2 } from 'lucide-react'
import type { NotificationType } from '@prisma/client'
import { markAllNotificationsRead }  from '@/app/actions/notifications'
import { NOTIFICATION_EMOJIS } from '@/lib/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationItem {
  id:         string
  type:       NotificationType
  title:      string
  message:    string
  actionUrl:  string | null
  read:       boolean
  createdAt:  string
}

interface Props {
  initialCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)   return 'עכשיו'
  if (diff < 3_600_000) return `לפני ${Math.floor(diff / 60_000)} דק'`
  if (diff < 86_400_000) return `לפני ${Math.floor(diff / 3_600_000)} ש'`
  return new Date(iso).toLocaleDateString('he-IL')
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell({ initialCount = 0 }: Props) {
  const [open,    setOpen]    = useState(false)
  const [count,   setCount]   = useState(initialCount)
  const [items,   setItems]   = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Poll unread count every 30 s ──────────────────────────────────────────
  useEffect(() => {
    pollCount()
    const id = setInterval(pollCount, 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  async function pollCount() {
    try {
      const res = await fetch('/api/notifications?take=1', { cache: 'no-store' })
      if (!res.ok) return
      const { unreadCount } = await res.json()
      setCount(unreadCount)
    } catch { /* silent — notification count is non-critical */ }
  }

  async function openDropdown() {
    const willOpen = !open
    setOpen(willOpen)
    if (!willOpen) return

    setLoading(true)
    try {
      const res = await fetch('/api/notifications?take=15', { cache: 'no-store' })
      if (!res.ok) return
      const { notifications, unreadCount } = await res.json()
      setItems(notifications)
      setCount(unreadCount)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsRead()
      setCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    })
  }

  function handleItemClick(item: NotificationItem) {
    // Mark as read locally
    if (!item.read) {
      setItems((prev) => prev.map((n) => n.id === item.id ? { ...n, read: true } : n))
      setCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (item.actionUrl) window.location.href = item.actionUrl
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button
        onClick={openDropdown}
        className="relative p-2 rounded-lg text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#252836] transition-all"
        aria-label={count > 0 ? `${count} התראות חדשות` : 'התראות'}
      >
        {count > 0
          ? <BellDot size={18} className="text-[#6366f1]" />
          : <Bell    size={18} />
        }
        {count > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 bg-red-500 text-white
                           text-[10px] font-bold rounded-full flex items-center justify-center px-0.5
                           leading-none pointer-events-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute end-0 top-10 z-50 w-[340px] bg-[#1a1d27] border border-[#2e3147]
                          rounded-xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3147]">
              <span className="text-sm font-semibold">התראות</span>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#4f46e5]
                             disabled:opacity-50 transition-colors"
                >
                  {isPending
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Check   size={11} />
                  }
                  סמן הכל כנקרא
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#2e3147]">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#8892a4]">
                  <Loader2 size={16} className="animate-spin" />
                  טוען...
                </div>
              )}

              {!loading && items.length === 0 && (
                <div className="py-10 text-center">
                  <Bell size={24} className="mx-auto mb-2 text-[#2e3147]" />
                  <p className="text-sm text-[#8892a4]">אין התראות</p>
                </div>
              )}

              {!loading && items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={[
                    'w-full flex items-start gap-3 px-4 py-3 text-start transition-colors',
                    item.read
                      ? 'hover:bg-[#252836]/60'
                      : 'bg-[#6366f1]/5 hover:bg-[#6366f1]/10',
                  ].join(' ')}
                >
                  {/* Icon */}
                  <span className="text-base flex-shrink-0 mt-0.5 leading-none" aria-hidden>
                    {NOTIFICATION_EMOJIS[item.type] ?? '🔔'}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${item.read ? 'text-[#8892a4]' : 'font-medium text-[#e2e8f0]'}`}>
                        {item.title}
                      </p>
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-[#8892a4] mt-0.5 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-[#8892a4]/70 mt-1">
                      {relativeTime(item.createdAt)}
                    </p>
                  </div>

                  {item.actionUrl && (
                    <ExternalLink size={12} className="text-[#8892a4]/50 flex-shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-[#2e3147] px-4 py-2.5 text-center">
                <span className="text-xs text-[#8892a4]">
                  מציג {items.length} התראות אחרונות
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
