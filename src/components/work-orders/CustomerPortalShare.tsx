'use client'

import { useState } from 'react'
import { Link2, Check, MessageCircle } from 'lucide-react'

interface CustomerPortalShareProps {
  workOrderId: string
  customerName: string
  customerPhone: string
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  return digits
}

export function CustomerPortalShare({ workOrderId, customerName, customerPhone }: CustomerPortalShareProps) {
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = `${origin}/portal/${workOrderId}`

  const waMessage = encodeURIComponent(
    `שלום ${customerName},\nהנה קישור לצפייה בסטטוס הרכב שלך:\n${portalUrl}`
  )
  const waUrl = `https://wa.me/${normalizePhone(customerPhone)}?text=${waMessage}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(portalUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for browsers that block clipboard
      const el = document.createElement('textarea')
      el.value = portalUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-surface border border-[#2e3147] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-muted" />
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">שלח ללקוח</span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <code className="flex-1 min-w-0 text-xs bg-[#1a1d27] border border-[#2e3147] rounded-lg px-3 py-2 text-[#8892a4] truncate font-mono" dir="ltr">
          {portalUrl}
        </code>
        <button
          onClick={handleCopy}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-all ${
            copied
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'border-[#2e3147] text-muted hover:text-[#e2e8f0] hover:border-[#6366f1]/40'
          }`}
        >
          {copied ? <Check size={13} /> : <Link2 size={13} />}
          {copied ? 'הועתק!' : 'העתק קישור'}
        </button>
      </div>

      {customerPhone && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition-all"
        >
          <MessageCircle size={13} />
          שלח ב-WhatsApp ל-{customerName}
        </a>
      )}
    </div>
  )
}
