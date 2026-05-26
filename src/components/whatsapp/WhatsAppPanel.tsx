'use client'

import { useState, useTransition } from 'react'
import { MessageCircle, Send, Check, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { buildTemplate, buildWaLink, TEMPLATE_LABELS, type WaTemplate, type TemplateContext } from '@/lib/comm-log'
import { recordOutboundMessage } from '@/app/actions/comm-log'

interface CommLogItem {
  id:           string
  message:      string
  templateType: string | null
  sentAt:       string
  channel:      string
}

interface Props {
  workOrderId:     string
  customerId:      string
  customerName:    string
  customerPhone:   string
  workOrderNumber: string
  vehiclePlate:    string
  vehicleDesc:     string
  garageName:      string
  status:          string
  initialLogs:     CommLogItem[]
  quoteToken?:     string
  paymentToken?:   string
  baseUrl:         string
}

const TEMPLATE_LIST: WaTemplate[] = [
  'status_update',
  'status_completed',
  'waiting_parts',
  'quote_approval',
  'ready_pickup',
  'payment_link',
]

const CHANNEL_EMOJI: Record<string, string> = { WHATSAPP: '💬', SMS: '📱', EMAIL: '📧', PHONE: '📞' }

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'עכשיו'
  if (diff < 3600000)  return `לפני ${Math.floor(diff / 60000)} דק׳`
  if (diff < 86400000) return `לפני ${Math.floor(diff / 3600000)} שע׳`
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
}

export function WhatsAppPanel({
  workOrderId, customerId, customerName, customerPhone,
  workOrderNumber, vehiclePlate, vehicleDesc, garageName,
  status, initialLogs, quoteToken, paymentToken, baseUrl,
}: Props) {
  const [logs,      setLogs]      = useState(initialLogs)
  const [selected,  setSelected]  = useState<WaTemplate | null>(null)
  const [preview,   setPreview]   = useState('')
  const [expanded,  setExpanded]  = useState(false)
  const [sent,      setSent]      = useState<string | null>(null)
  const [isPending, start]        = useTransition()

  const ctx: TemplateContext = {
    customerName,
    workOrderNumber,
    garageName,
    status:        statusLabel(status),
    vehiclePlate,
    vehicleDesc,
    quoteUrl:      quoteToken ? `${baseUrl}/pay/${quoteToken}` : undefined,
    paymentUrl:    paymentToken ? `${baseUrl}/pay/${paymentToken}` : undefined,
  }

  function handleSelect(tpl: WaTemplate) {
    setSelected(tpl)
    setPreview(buildTemplate(tpl, ctx))
    setSent(null)
  }

  function handleSend() {
    if (!selected || !preview) return
    // Open WhatsApp
    const link = buildWaLink(customerPhone, preview)
    window.open(link, '_blank')

    // Log it
    start(async () => {
      await recordOutboundMessage({
        workOrderId,
        customerId,
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

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
        <div className="flex items-center gap-2 font-semibold text-[15px]">
          <MessageCircle size={15} className="text-emerald-400" />
          WhatsApp לקוח
        </div>
        <span className="text-xs text-[#8892a4]">{customerPhone}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Template buttons */}
        <div>
          <div className="text-xs text-[#8892a4] mb-2 font-semibold">בחר תבנית הודעה:</div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_LIST.map((tpl) => (
              <button
                key={tpl}
                onClick={() => handleSelect(tpl)}
                className={[
                  'text-xs border px-2.5 py-1.5 rounded-lg font-medium transition-all',
                  selected === tpl
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'border-[#2e3147] text-[#8892a4] hover:border-[#3e4157] hover:text-white',
                ].join(' ')}
              >
                {TEMPLATE_LABELS[tpl]}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="bg-[#252836] border border-[#2e3147] rounded-xl p-3">
              <div className="text-xs text-[#8892a4] mb-1.5 font-semibold">תצוגה מקדימה:</div>
              <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-line">{preview}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSend}
                disabled={isPending}
                className={[
                  'flex-1 flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl text-sm transition-all',
                  sent === selected
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-[#25d366] hover:bg-[#20ba58] text-white',
                ].join(' ')}
              >
                {sent === selected ? (
                  <><Check size={15} />נשלח</>
                ) : (
                  <><Send size={15} />פתח WhatsApp<ExternalLink size={12} /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {logs.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[#8892a4] hover:text-white transition-colors"
            >
              <Clock size={11} />
              היסטוריה ({logs.length})
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {logs.map((log) => (
                  <div key={log.id} className="bg-[#252836] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px]">{CHANNEL_EMOJI[log.channel] ?? '💬'}</span>
                      {log.templateType && (
                        <span className="text-[10px] text-[#6366f1] font-semibold">
                          {TEMPLATE_LABELS[log.templateType as WaTemplate] ?? log.templateType}
                        </span>
                      )}
                      <span className="text-[10px] text-[#8892a4] ms-auto">{relTime(log.sentAt)}</span>
                    </div>
                    <p className="text-xs text-[#a8b4c8] line-clamp-2">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function statusLabel(s: string) {
  const MAP: Record<string, string> = {
    PENDING: 'ממתין', IN_PROGRESS: 'בטיפול', WAITING_PARTS: 'ממתין לחלקים',
    COMPLETED: 'הושלם', CANCELLED: 'בוטל',
  }
  return MAP[s] ?? s
}
