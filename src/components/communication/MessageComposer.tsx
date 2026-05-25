'use client'

import { useState } from 'react'
import { Copy, Check, MessageCircle, Phone } from 'lucide-react'

type WorkOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'COMPLETED' | 'CANCELLED'

interface WorkOrderInfo {
  id: string
  workOrderNumber: string
  status: WorkOrderStatus
  totalPrice: number
  customer: { name: string; phone: string }
  vehicle: { make: string; model: string; plate: string }
}

const STATUS_HE: Record<WorkOrderStatus, string> = {
  PENDING: 'ממתין לטיפול',
  IN_PROGRESS: 'בטיפול',
  WAITING_PARTS: 'ממתין לחלקים',
  COMPLETED: 'הושלם',
  CANCELLED: 'בוטל',
}

interface Props {
  wo: WorkOrderInfo
  quoteId?: string
}

type Template = {
  id: string
  label: string
  icon: React.ReactNode
  generate: (wo: WorkOrderInfo, shareUrl: string) => string
}

export function MessageComposer({ wo, quoteId }: Props) {
  const [copied, setCopied] = useState<string | null>(null)
  const [customMsg, setCustomMsg] = useState('')

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/work-order/${wo.id}`
    : ''

  const templates: Template[] = [
    {
      id: 'status',
      label: 'עדכון סטטוס',
      icon: <MessageCircle size={14} />,
      generate: (w) =>
        `שלום ${w.customer.name}!\n\nרכבך *${w.vehicle.make} ${w.vehicle.model}* (${w.vehicle.plate}) נמצא כעת בסטטוס:\n✅ *${STATUS_HE[w.status]}*\n\nמספר פקודה: ${w.workOrderNumber}\n\nלשאלות אנחנו כאן 🔧`,
    },
    {
      id: 'ready',
      label: 'רכב מוכן לאיסוף',
      icon: <Check size={14} />,
      generate: (w) =>
        `שלום ${w.customer.name}!\n\nרכבך *${w.vehicle.make} ${w.vehicle.model}* (${w.vehicle.plate}) מוכן לאיסוף 🎉\n\nסכום לתשלום: *₪${w.totalPrice.toLocaleString('he-IL')}*\nפקודה: ${w.workOrderNumber}\n\nנשמח לראותך!`,
    },
    {
      id: 'waiting',
      label: 'ממתינים לחלקים',
      icon: <MessageCircle size={14} />,
      generate: (w) =>
        `שלום ${w.customer.name}!\n\nרצינו לעדכן אותך שרכבך *${w.vehicle.make} ${w.vehicle.model}* (${w.vehicle.plate}) ממתין לקבלת חלקים.\n\nברגע שיגיעו החלקים נמשיך בעבודה ונעדכן אותך.\n\nתודה על הסבלנות 🙏`,
    },
    {
      id: 'appointment',
      label: 'תזכורת תור',
      icon: <Phone size={14} />,
      generate: (w) =>
        `שלום ${w.customer.name}!\n\nזוהי תזכורת לתור שקבעת עבור רכבך *${w.vehicle.make} ${w.vehicle.model}* (${w.vehicle.plate}).\n\nלאישור או שינוי — אנא פנה אלינו.\n\nנשמח לראותך! 🔧`,
    },
  ]

  function buildWhatsApp(text: string) {
    const phone = wo.customer.phone.replace(/[^0-9]/g, '').replace(/^0/, '972')
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
  }

  function buildSMS(text: string) {
    return `sms:${wo.customer.phone}?body=${encodeURIComponent(text)}`
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#252836] rounded-xl p-4 border border-[#2e3147]">
        <div className="text-xs text-[#8892a4] mb-1">לקוח</div>
        <div className="font-semibold">{wo.customer.name}</div>
        <div className="text-sm text-[#8892a4]">{wo.customer.phone}</div>
      </div>

      {templates.map((t) => {
        const msg = t.generate(wo, shareUrl)
        return (
          <div key={t.id} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3147]">
              <div className="flex items-center gap-2 text-sm font-medium">
                {t.icon}{t.label}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(msg, t.id + '-copy')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-[#252836] border border-[#2e3147] hover:border-[#6366f1] text-[#8892a4] hover:text-[#e2e8f0] transition-all"
                >
                  {copied === t.id + '-copy' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  העתק
                </button>
                <a
                  href={buildWhatsApp(msg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                >
                  <MessageCircle size={11} />וואטסאפ
                </a>
                <a
                  href={buildSMS(msg)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
                >
                  <Phone size={11} />SMS
                </a>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-[#8892a4] whitespace-pre-wrap leading-relaxed">{msg}</p>
            </div>
          </div>
        )
      })}

      {/* Custom message */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">הודעה מותאמת אישית</h3>
        <textarea
          value={customMsg}
          onChange={(e) => setCustomMsg(e.target.value)}
          rows={4}
          placeholder={`שלום ${wo.customer.name},...`}
          className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
        />
        {customMsg.trim() && (
          <div className="flex gap-2">
            <button
              onClick={() => copyText(customMsg, 'custom-copy')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-[#252836] border border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] transition-all"
            >
              {copied === 'custom-copy' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              העתק
            </button>
            <a
              href={buildWhatsApp(customMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <MessageCircle size={11} />שלח בוואטסאפ
            </a>
            <a
              href={buildSMS(customMsg)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              <Phone size={11} />שלח SMS
            </a>
          </div>
        )}
      </div>

      {/* Share link */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4">
        <div className="text-xs text-[#8892a4] uppercase tracking-wide mb-2 font-semibold">קישור לשיתוף סטטוס</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-[#252836] rounded-lg px-3 py-2 text-[#6366f1] truncate">
            {shareUrl}
          </code>
          <button
            onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied('link') }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#252836] border border-[#2e3147] rounded-lg text-[#8892a4] hover:text-[#e2e8f0] transition-all flex-shrink-0"
          >
            {copied === 'link' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            העתק
          </button>
        </div>
      </div>
    </div>
  )
}
