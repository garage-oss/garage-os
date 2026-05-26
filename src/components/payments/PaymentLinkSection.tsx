'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Copy, Check, ExternalLink, Loader2, Link2 } from 'lucide-react'
import { generatePaymentLink } from '@/app/actions/payments'
import { formatCurrency } from '@/lib/utils'

interface LinkItem {
  id:        string
  token:     string
  amount:    number
  paidAt:    string | null
  expiresAt: string | null
  createdAt: string
}

interface Props {
  workOrderId:  string
  totalPrice:   number
  initialLinks: LinkItem[]
  baseUrl:      string
}

export function PaymentLinkSection({ workOrderId, totalPrice, initialLinks, baseUrl }: Props) {
  const [links,     setLinks]    = useState(initialLinks)
  const [copied,    setCopied]   = useState<string | null>(null)
  const [isPending, start]       = useTransition()
  const [error,     setError]    = useState<string | null>(null)

  function payUrl(token: string) { return `${baseUrl}/pay/${token}` }

  async function handleGenerate() {
    setError(null)
    start(async () => {
      const res = await generatePaymentLink(workOrderId)
      if ('error' in res) { setError(res.error); return }
      // Re-fetch or optimistically add
      setLinks((prev) => {
        if (prev.find((l) => l.token === res.token)) return prev
        return [{
          id: crypto.randomUUID(), token: res.token,
          amount: totalPrice, paidAt: null,
          expiresAt: null, createdAt: new Date().toISOString(),
        }, ...prev]
      })
    })
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(payUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const unpaidLinks = links.filter((l) => !l.paidAt)
  const paidLinks   = links.filter((l) => l.paidAt)

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
        <div className="flex items-center gap-2 font-semibold text-[15px]">
          <CreditCard size={15} className="text-[#6366f1]" />
          קישור תשלום
        </div>
        <span className="text-xs font-bold text-[#6366f1]">{formatCurrency(totalPrice)}</span>
      </div>

      <div className="p-5 space-y-4">
        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isPending || unpaidLinks.length > 0}
          className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
        >
          {isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Link2 size={15} />
          )}
          {unpaidLinks.length > 0 ? 'קישור קיים' : 'צור קישור תשלום'}
        </button>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        {/* Active links */}
        {unpaidLinks.map((link) => (
          <div key={link.id} className="bg-[#252836] border border-[#2e3147] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold">פעיל</span>
              <span className="text-xs font-bold">{formatCurrency(link.amount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] text-[#8892a4] truncate bg-[#1a1d27] rounded px-2 py-1">
                {payUrl(link.token)}
              </code>
              <button
                onClick={() => copyLink(link.token)}
                className="text-[#8892a4] hover:text-white transition-colors"
                title="העתק"
              >
                {copied === link.token ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <a
                href={payUrl(link.token)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8892a4] hover:text-[#6366f1] transition-colors"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            {link.expiresAt && (
              <div className="text-[10px] text-[#8892a4]">
                פג תוקף: {new Date(link.expiresAt).toLocaleDateString('he-IL')}
              </div>
            )}
          </div>
        ))}

        {/* Paid links */}
        {paidLinks.map((link) => (
          <div key={link.id} className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <Check size={12} />
                שולם
              </div>
              <span className="text-xs font-bold text-emerald-400">{formatCurrency(link.amount)}</span>
            </div>
            <div className="text-[10px] text-[#8892a4] mt-1">
              {link.paidAt && new Date(link.paidAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
