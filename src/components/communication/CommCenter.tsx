'use client'

import { useState, useTransition } from 'react'
import {
  MessageCircle, Phone, Mail, Globe, Check, Send,
  ExternalLink, Copy, Clock, CreditCard, Smartphone,
  Link2, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  buildTemplate, buildWaLink, TEMPLATE_LABELS,
  type WaTemplate, type TemplateContext,
} from '@/lib/comm-log'
import { recordOutboundMessage } from '@/app/actions/comm-log'
import { WorkOrderStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommLogItem {
  id: string
  message: string
  templateType: string | null
  sentAt: string
  channel: string
}

export interface PayLinkItem {
  id: string
  token: string
  amount: number
  paidAt: string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  workOrderId: string
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  workOrderNumber: string
  vehiclePlate: string
  vehicleDesc: string
  garageName: string
  status: WorkOrderStatus
  initialLogs: CommLogItem[]
  payLinks: PayLinkItem[]
  quoteToken?: string
  paymentToken?: string
  baseUrl: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_HE: Record<WorkOrderStatus, string> = {
  PENDING: 'ממתין',
  IN_PROGRESS: 'בטיפול',
  WAITING_PARTS: 'ממתין לחלקים',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

const TEMPLATES: WaTemplate[] = [
  'status_update',
  'status_completed',
  'waiting_parts',
  'quote_approval',
  'payment_link',
  'appointment_reminder',
]

// ─── Timeline builder ─────────────────────────────────────────────────────────

type TLEntry = {
  id: string
  ts: string
  icon: React.ReactNode
  dot: string
  headline: string
  sub?: string
}

function buildTimeline(logs: CommLogItem[], links: PayLinkItem[]): TLEntry[] {
  const entries: TLEntry[] = []

  for (const log of logs) {
    const label = log.templateType
      ? (TEMPLATE_LABELS[log.templateType as WaTemplate] ?? log.templateType)
      : null

    const [icon, dot, ch] = ((): [React.ReactNode, string, string] => {
      switch (log.channel) {
        case 'EMAIL': return [<Mail size={9} key="e" />, 'bg-blue-500', 'אימייל']
        case 'SMS':   return [<Smartphone size={9} key="s" />, 'bg-violet-500', 'SMS']
        case 'PHONE': return [<Phone size={9} key="p" />, 'bg-amber-500', 'שיחה']
        default:      return [<MessageCircle size={9} key="w" />, 'bg-[#25d366]', 'WhatsApp']
      }
    })()

    entries.push({
      id:       log.id,
      ts:       log.sentAt,
      icon, dot,
      headline: label ? `${ch} — ${label}` : `${ch} נשלח`,
      sub:      log.message.length > 90
        ? log.message.slice(0, 90) + '…'
        : log.message,
    })
  }

  for (const lnk of links) {
    const amt = `₪${lnk.amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (lnk.paidAt) {
      entries.push({
        id: `${lnk.id}-paid`, ts: lnk.paidAt,
        icon: <Check size={9} key="ck" />, dot: 'bg-emerald-500',
        headline: 'תשלום הושלם', sub: amt,
      })
    }
    entries.push({
      id: `${lnk.id}-link`, ts: lnk.createdAt,
      icon: <CreditCard size={9} key="cc" />, dot: 'bg-amber-500',
      headline: 'קישור תשלום נשלח', sub: amt,
    })
  }

  return entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000)      return 'עכשיו'
  if (d < 3_600_000)   return `${Math.floor(d / 60_000)} דק׳`
  if (d < 86_400_000)  return `${Math.floor(d / 3_600_000)} שע׳`
  if (d < 172_800_000) return 'אתמול'
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
}

function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.startsWith('0') ? `972${d.slice(1)}` : d
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBtn({
  href, icon, label, color, disabled = false,
}: {
  href?: string
  icon: React.ReactNode
  label: string
  color: string
  disabled?: boolean
}) {
  const base =
    'group flex flex-col items-center gap-1.5 py-4 transition-all relative select-none'
  const active = `hover:${color} cursor-pointer`
  const muted  = 'opacity-30 cursor-not-allowed pointer-events-none'

  if (href && !disabled) {
    return (
      <a href={href} target={href.startsWith('http') ? '_blank' : undefined}
         rel="noopener noreferrer" className={`${base} ${active}`}>
        <span className="transition-transform group-hover:scale-110">{icon}</span>
        <span className="text-[10px] font-medium text-[#8892a4] group-hover:text-[#e2e8f0] transition-colors leading-none">
          {label}
        </span>
      </a>
    )
  }
  return (
    <div className={`${base} ${disabled ? muted : active}`}>
      <span>{icon}</span>
      <span className="text-[10px] font-medium text-[#8892a4] leading-none">{label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommCenter({
  workOrderId, customerId, customerName, customerPhone, customerEmail,
  workOrderNumber, vehiclePlate, vehicleDesc, garageName, status,
  initialLogs, payLinks, quoteToken, paymentToken, baseUrl,
}: Props) {
  const [logs,         setLogs]         = useState(initialLogs)
  const [selected,     setSelected]     = useState<WaTemplate | null>(null)
  const [preview,      setPreview]      = useState('')
  const [sent,         setSent]         = useState<WaTemplate | null>(null)
  const [portalCopied, setPortalCopied] = useState(false)
  const [tlExpanded,   setTlExpanded]   = useState(true)
  const [isPending,    start]           = useTransition()

  const portalUrl = `${baseUrl}/portal/${workOrderId}`
  const timeline  = buildTimeline(logs, payLinks)

  const ctx: TemplateContext = {
    customerName, workOrderNumber, garageName,
    status:     STATUS_HE[status],
    vehiclePlate, vehicleDesc,
    quoteUrl:   quoteToken   ? `${baseUrl}/pay/${quoteToken}`   : undefined,
    paymentUrl: paymentToken ? `${baseUrl}/pay/${paymentToken}` : undefined,
  }

  function selectTemplate(tpl: WaTemplate) {
    setSelected(tpl)
    setPreview(buildTemplate(tpl, ctx))
    setSent(null)
  }

  function handleSend() {
    if (!selected || !preview.trim()) return
    window.open(buildWaLink(customerPhone, preview), '_blank')
    start(async () => {
      await recordOutboundMessage({
        workOrderId, customerId,
        templateType:   selected,
        message:        preview,
        recipientPhone: customerPhone,
        channel:        'WHATSAPP',
      })
      setLogs((prev) => [{
        id:           crypto.randomUUID(),
        message:      preview,
        templateType: selected,
        sentAt:       new Date().toISOString(),
        channel:      'WHATSAPP',
      }, ...prev])
      setSent(selected)
    })
  }

  async function copyPortal() {
    await navigator.clipboard.writeText(portalUrl)
    setPortalCopied(true)
    setTimeout(() => setPortalCopied(false), 2000)
  }

  // ── Layout: two columns on desktop, stacked on mobile ──────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

      {/* ═══════════════════════════════════════════════════════
          Column A (wider, 2 cols): Contact card + Composer
          In RTL grid this renders on the RIGHT side — primary action area
      ═══════════════════════════════════════════════════════ */}
      <div className="lg:col-span-2 space-y-4">

        {/* ── Customer contact card ── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3.5 border-b border-[#2e3147]">
            {/* Avatar */}
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#8b5cf6]/20 border border-[#6366f1]/20 flex items-center justify-center text-[17px] font-bold text-[#6366f1] shrink-0 select-none">
              {customerName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[#e2e8f0] text-[15px] leading-snug truncate">
                {customerName}
              </div>
              <div className="text-[13px] text-[#8892a4] font-mono mt-0.5 tabular-nums" dir="ltr">
                {customerPhone}
              </div>
            </div>
            {customerEmail && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#8892a4] bg-[#252836] border border-[#2e3147] px-2.5 py-1 rounded-full max-w-[200px] overflow-hidden">
                <Mail size={10} className="shrink-0" />
                <span className="truncate">{customerEmail}</span>
              </div>
            )}
          </div>

          {/* 4 quick-action buttons */}
          <div className="grid grid-cols-4 divide-x divide-x-reverse divide-[#2e3147]">
            <ActionBtn
              href={`https://wa.me/${normalizePhone(customerPhone)}`}
              icon={<MessageCircle size={19} className="text-[#25d366]" />}
              label="WhatsApp"
              color="bg-[#25d366]/5"
            />
            <ActionBtn
              href={`tel:${customerPhone}`}
              icon={<Phone size={19} className="text-blue-400" />}
              label="התקשר"
              color="bg-blue-500/5"
            />
            <ActionBtn
              href={customerEmail ? `mailto:${customerEmail}` : undefined}
              icon={<Mail size={19} className={customerEmail ? 'text-violet-400' : 'text-[#4a5568]'} />}
              label="אימייל"
              color="bg-violet-500/5"
              disabled={!customerEmail}
            />
            <ActionBtn
              href={portalUrl}
              icon={<Globe size={19} className="text-[#6366f1]" />}
              label="פורטל"
              color="bg-[#6366f1]/5"
            />
          </div>

          {/* Portal URL copy strip */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#2e3147] bg-[#252836]/40">
            <Link2 size={11} className="text-[#4a5568] shrink-0" />
            <code
              className="flex-1 min-w-0 text-[11px] text-[#6366f1]/70 font-mono truncate"
              dir="ltr"
            >
              {portalUrl}
            </code>
            <button
              onClick={copyPortal}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] hover:border-[#6366f1]/30 transition-all shrink-0"
            >
              {portalCopied
                ? <><Check size={10} className="text-emerald-400" />הועתק</>
                : <><Copy size={10} />העתק</>
              }
            </button>
          </div>
        </div>

        {/* ── Message composer ── */}
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#2e3147] flex items-center gap-2">
            <Send size={13} className="text-[#6366f1]" />
            <span className="text-[13px] font-semibold text-[#e2e8f0]">שלח הודעה</span>
          </div>

          <div className="p-5 space-y-4">
            {/* Template chips */}
            <div>
              <p className="text-[10px] text-[#8892a4] uppercase tracking-widest font-semibold mb-2.5">
                בחר תבנית
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => selectTemplate(tpl)}
                    className={[
                      'text-[12px] px-3 py-1.5 rounded-full font-medium transition-all border',
                      selected === tpl
                        ? 'bg-[#6366f1]/15 border-[#6366f1]/40 text-[#6366f1] shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
                        : 'bg-[#252836] border-[#2e3147] text-[#8892a4] hover:border-[#4e5470] hover:text-[#e2e8f0]',
                    ].join(' ')}
                  >
                    {TEMPLATE_LABELS[tpl]}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview + Send */}
            {selected ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-[#8892a4] uppercase tracking-widest font-semibold mb-2">
                    תצוגה מקדימה
                  </p>
                  <textarea
                    value={preview}
                    onChange={(e) => setPreview(e.target.value)}
                    rows={5}
                    className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-4 py-3 text-[13px] text-[#e2e8f0] leading-relaxed resize-none focus:outline-none focus:border-[#6366f1]/50 transition-colors placeholder-[#4a5568]"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={isPending || !preview.trim()}
                  className={[
                    'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50',
                    sent === selected
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-[#25d366] hover:brightness-105 text-white shadow-lg shadow-[#25d366]/10',
                  ].join(' ')}
                >
                  {sent === selected ? (
                    <><Check size={14} />נשלח בהצלחה!</>
                  ) : (
                    <><MessageCircle size={14} />שלח ב-WhatsApp<ExternalLink size={11} className="opacity-50" /></>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 rounded-xl border border-dashed border-[#2e3147]">
                <p className="text-[12px] text-[#4a5568]">בחר תבנית כדי לכתוב ולשלוח הודעה</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Column B (1 col): Activity timeline
          In RTL grid this renders on the LEFT side — context/history area
      ═══════════════════════════════════════════════════════ */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setTlExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 border-b border-[#2e3147] hover:bg-[#252836]/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[#8892a4]" />
            <span className="text-[13px] font-semibold text-[#e2e8f0]">פעילות תקשורת</span>
          </div>
          <div className="flex items-center gap-2">
            {timeline.length > 0 && (
              <span className="text-[10px] font-medium text-[#8892a4] bg-[#252836] border border-[#2e3147] px-2 py-0.5 rounded-full tabular-nums">
                {timeline.length}
              </span>
            )}
            {tlExpanded
              ? <ChevronUp size={13} className="text-[#8892a4]" />
              : <ChevronDown size={13} className="text-[#8892a4]" />
            }
          </div>
        </button>

        {tlExpanded && (
          <div className="p-5">
            {timeline.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="h-12 w-12 rounded-2xl bg-[#252836] border border-[#2e3147] flex items-center justify-center">
                  <MessageCircle size={20} className="text-[#3e4357]" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium text-[#8892a4]">אין פעילות עדיין</p>
                  <p className="text-[11px] text-[#4a5568] mt-1">הודעות ותשלומים יופיעו כאן</p>
                </div>
              </div>
            ) : (
              /* Timeline */
              <div className="relative">
                {/* Connecting vertical line — centered on the 15px dot at start edge (right in RTL) */}
                {timeline.length > 1 && (
                  <div className="absolute start-[7px] top-[18px] bottom-3 w-px bg-[#2e3147]" />
                )}

                <div className="space-y-5">
                  {timeline.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 relative">
                      {/* Colored dot */}
                      <div
                        className={`h-[15px] w-[15px] rounded-full ${entry.dot} flex items-center justify-center text-white shrink-0 mt-[1px] z-10 relative ring-2 ring-[#1a1d27]`}
                      >
                        {entry.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-[0px]">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-[12px] font-medium text-[#e2e8f0] leading-snug">
                            {entry.headline}
                          </span>
                          <span className="text-[10px] text-[#8892a4] shrink-0 tabular-nums mt-[1px]">
                            {relTime(entry.ts)}
                          </span>
                        </div>
                        {entry.sub && (
                          <p className="text-[11px] text-[#8892a4] mt-0.5 leading-relaxed line-clamp-2 whitespace-pre-line">
                            {entry.sub}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
