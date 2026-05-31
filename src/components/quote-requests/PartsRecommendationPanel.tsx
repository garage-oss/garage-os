'use client'

import { useState }         from 'react'
import {
  CheckCircle2, ChevronDown, ChevronUp,
  Package, Truck, ShieldCheck, Plus, Trash2, X,
} from 'lucide-react'
import {
  buildPartQuotes,
  selectionTotal,
  cheapestBundleTotal,
  recommendedBundleTotal,
  type PartQuote,
  type SupplierOption,
} from '@/lib/mock-suppliers'
import { formatCurrency }   from '@/lib/utils'
import type { QuoteItemEdit } from '@/app/actions/quote-request'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiPart {
  name:              string
  category:          string
  quantity:          number
  estimatedPriceILS: number
  isOptional:        boolean
  notes?:            string
}

interface ManualPart {
  description: string
  quantity:    number
  unitPrice:   number
}

interface Props {
  parts:      AiPart[]
  laborHours: number
  laborRate?: number
  onConfirm:  (items: QuoteItemEdit[], partsNotes: string) => void
  onCancel:   () => void
}

// ─── Display config maps ──────────────────────────────────────────────────────

const AVAIL_CFG: Record<string, { label: string; textColor: string; dot: string }> = {
  IN_STOCK:     { label: 'במלאי',       textColor: 'text-emerald-400', dot: 'bg-emerald-400' },
  ORDER_2_DAYS: { label: '2 ימי הזמנה', textColor: 'text-amber-400',  dot: 'bg-amber-400'   },
  ORDER_5_DAYS: { label: '5 ימי הזמנה', textColor: 'text-orange-400', dot: 'bg-orange-400'  },
  UNAVAILABLE:  { label: 'לא זמין',     textColor: 'text-red-400',    dot: 'bg-red-400'     },
}

const TYPE_CFG: Record<string, { label: string; cls: string }> = {
  OEM:            { label: 'OEM',       cls: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' },
  AFTERMARKET:    { label: 'אפטרמרקט', cls: 'text-slate-400  bg-slate-500/10  border-slate-500/20'  },
  REMANUFACTURED: { label: 'מחודש',    cls: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
}

// ─── Supplier option card ─────────────────────────────────────────────────────

function SupplierCard({
  sup, qty, selected, isCheapest, isRecommended, onSelect,
}: {
  sup:           SupplierOption
  qty:           number
  selected:      boolean
  isCheapest:    boolean
  isRecommended: boolean
  onSelect:      () => void
}) {
  const avail     = AVAIL_CFG[sup.availability]  ?? AVAIL_CFG.UNAVAILABLE
  const typeStyle = TYPE_CFG[sup.type]           ?? TYPE_CFG.AFTERMARKET
  const unavail   = sup.availability === 'UNAVAILABLE'

  return (
    <button
      type="button"
      onClick={() => !unavail && onSelect()}
      disabled={unavail}
      className={[
        'w-full text-right rounded-xl border px-3.5 py-3 transition-all',
        selected
          ? 'border-[#6366f1]/60 bg-[#6366f1]/10'
          : unavail
          ? 'border-[#1e2230] bg-[#0d0f18] opacity-40 cursor-not-allowed'
          : 'border-[#252836] bg-[#141720] hover:border-[#3a3f58] hover:bg-[#1a1d27]',
      ].join(' ')}
    >
      {/* ── Row 1: radio · name · badges · price ── */}
      <div className="flex items-center justify-between gap-2">

        {/* Left cluster */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Radio dot */}
          <div className={[
            'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
            selected ? 'border-[#6366f1] bg-[#6366f1]' : 'border-[#3a3f58]',
          ].join(' ')}>
            {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
          </div>

          <span className="text-sm font-semibold text-[#c5cde2] truncate">{sup.supplierName}</span>

          {/* Type badge */}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${typeStyle.cls}`}>
            {typeStyle.label}
          </span>

          {/* Cheapest / Recommended badges */}
          {isCheapest && (
            <span className="text-[9px] font-bold text-slate-300 bg-slate-500/15 border border-slate-500/25 px-1.5 py-0.5 rounded-md shrink-0">
              הוזל
            </span>
          )}
          {isRecommended && (
            <span className="text-[9px] font-bold text-indigo-200 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-md shrink-0">
              ★ מומלץ
            </span>
          )}
        </div>

        {/* Price (right) */}
        <div className="shrink-0 text-right">
          <p className={`text-sm font-black font-mono ${selected ? 'text-indigo-300' : 'text-[#e2e8f0]'}`}>
            {formatCurrency(sup.pricePerUnit * qty)}
          </p>
          {qty > 1 && (
            <p className="text-[10px] text-[#4a5270] font-mono">
              ₪{sup.pricePerUnit.toLocaleString('he-IL')}/יח׳
            </p>
          )}
        </div>
      </div>

      {/* ── Row 2: meta info ── */}
      <div className="flex items-center gap-3 mt-2 mr-6 flex-wrap">
        {/* Availability */}
        <span className="flex items-center gap-1 text-[10px]">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${avail.dot}`} />
          <span className={avail.textColor}>{avail.label}</span>
        </span>

        {/* Delivery */}
        {!unavail && (
          <span className="flex items-center gap-1 text-[10px] text-[#4a5270]">
            <Truck size={9} className="shrink-0" />
            {sup.deliveryDays} ימים
          </span>
        )}

        {/* Warranty */}
        <span className="flex items-center gap-1 text-[10px] text-[#4a5270]">
          <ShieldCheck size={9} className="shrink-0" />
          {sup.warranty}
        </span>

        {/* Part number */}
        <span className="text-[9px] text-[#2e3147] font-mono">{sup.partNumber}</span>
      </div>
    </button>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PartsRecommendationPanel({
  parts, laborHours, laborRate = 295, onConfirm, onCancel,
}: Props) {
  const partQuotes = buildPartQuotes(parts)

  // ── Selection state — default to recommended for each part ──────────────────
  const [selections, setSelections] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      partQuotes.map((pq, i) => [i, pq.suppliers[pq.recommendedIdx]?.supplierId ?? ''])
    )
  )

  // ── Expand/collapse per-part ─────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(partQuotes.map((_, i) => [i, true]))
  )

  // ── Manual parts added by advisor ───────────────────────────────────────────
  const [manualParts, setManualParts] = useState<ManualPart[]>([])

  // ── Bulk selection helpers ───────────────────────────────────────────────────
  function selectAll(mode: 'cheapest' | 'recommended') {
    setSelections(
      Object.fromEntries(
        partQuotes.map((pq, i) => [
          i,
          pq.suppliers[mode === 'cheapest' ? pq.cheapestIdx : pq.recommendedIdx]?.supplierId ?? '',
        ])
      )
    )
  }

  // ── Manual part helpers ──────────────────────────────────────────────────────
  function addManualPart() {
    setManualParts(prev => [...prev, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function updateManualPart(idx: number, field: keyof ManualPart, value: string) {
    setManualParts(prev =>
      prev.map((p, i) => i !== idx ? p : {
        ...p,
        [field]: field === 'description' ? value : parseFloat(value) || 0,
      })
    )
  }

  function removeManualPart(idx: number) {
    setManualParts(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Live totals ──────────────────────────────────────────────────────────────
  const VAT          = 0.17
  const chTotal      = cheapestBundleTotal(partQuotes)
  const recTotal     = recommendedBundleTotal(partQuotes)
  const selPartsSum  = selectionTotal(partQuotes, selections)
  const manualSum    = manualParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)
  const allPartsSum  = selPartsSum + manualSum
  const laborSum     = laborHours * laborRate
  const subtotal     = allPartsSum + laborSum
  const vat          = Math.round(subtotal * VAT * 100) / 100
  const grandTotal   = Math.round((subtotal + vat) * 100) / 100

  // ── Confirm handler ──────────────────────────────────────────────────────────
  function handleConfirm() {
    const items: QuoteItemEdit[] = []

    // AI-sourced parts with selected supplier
    partQuotes.forEach((pq, idx) => {
      const sup = pq.suppliers.find(s => s.supplierId === selections[idx])
               ?? pq.suppliers[pq.recommendedIdx]
      if (!sup) return

      const typeLabel = TYPE_CFG[sup.type]?.label ?? sup.type
      items.push({
        description:
          pq.partName
          + (pq.notes ? ` — ${pq.notes}` : '')
          + (pq.isOptional ? ' [אופציונלי]' : '')
          + ` (${sup.supplierName} · ${typeLabel})`,
        quantity:  pq.quantity,
        unitPrice: sup.pricePerUnit,
        total:     Math.round(pq.quantity * sup.pricePerUnit * 100) / 100,
      })
    })

    // Manually added parts
    manualParts.forEach(p => {
      if (!p.description.trim()) return
      items.push({
        description: p.description,
        quantity:    p.quantity,
        unitPrice:   p.unitPrice,
        total:       Math.round(p.quantity * p.unitPrice * 100) / 100,
      })
    })

    // Build notes summary of chosen suppliers
    const lines = partQuotes.map((pq, idx) => {
      const sup = pq.suppliers.find(s => s.supplierId === selections[idx])
               ?? pq.suppliers[pq.recommendedIdx]
      const avail = AVAIL_CFG[sup?.availability ?? 'UNAVAILABLE']?.label ?? ''
      return `• ${pq.partName} ×${pq.quantity} — ${sup?.supplierName ?? '?'} · ₪${sup?.pricePerUnit ?? 0}/יח׳ · ${avail}`
    })
    const partsNotes = `חלקים שנבחרו:\n${lines.join('\n')}`

    onConfirm(items, partsNotes)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#0f1117] border border-[#252836] rounded-2xl overflow-hidden">

      {/* ══ Header ══════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2230]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
            <Package size={13} className="text-[#6366f1]" />
          </div>
          <span className="text-sm font-bold text-[#e2e8f0]">השוואת ספקים לחלקים</span>
          <span className="text-[10px] bg-[#1a1d27] text-[#4a5270] border border-[#252836] px-2 py-0.5 rounded-full">
            {parts.length} חלקים
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-[#4a5270] hover:text-[#8892a4] transition-colors p-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* ══ Summary bar + bulk-select buttons ═══════════════════════════════════ */}
      <div className="px-5 py-3 border-b border-[#1e2230] flex flex-wrap items-center gap-3">
        <div className="flex gap-4 text-xs flex-1 flex-wrap">
          <span className="text-[#4a5270]">
            הוזל:&ensp;
            <span className="text-[#8892a4] font-mono font-bold">{formatCurrency(chTotal)}</span>
          </span>
          <span className="text-[#4a5270]">
            מומלץ:&ensp;
            <span className="text-indigo-300 font-mono font-bold">{formatCurrency(recTotal)}</span>
          </span>
          <span className="text-[#4a5270]">
            נבחר:&ensp;
            <span className="text-emerald-400 font-mono font-bold">{formatCurrency(selPartsSum)}</span>
          </span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => selectAll('cheapest')}
            className="text-[10px] font-bold border border-[#2e3147] text-[#8892a4] hover:border-slate-500 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            כולם הוזל
          </button>
          <button
            type="button"
            onClick={() => selectAll('recommended')}
            className="text-[10px] font-bold border border-[#6366f1]/30 text-[#6366f1] hover:bg-[#6366f1]/10 px-3 py-1.5 rounded-lg transition-colors"
          >
            ★ כולם מומלץ
          </button>
        </div>
      </div>

      {/* ══ Parts list ══════════════════════════════════════════════════════════ */}
      {parts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[#4a5270]">אין חלקים מהאבחון — הוסף ידנית למטה</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1e2230]">
          {partQuotes.map((pq, pIdx) => {
            const isOpen   = expanded[pIdx] !== false
            const selId    = selections[pIdx]
            const selSup   = pq.suppliers.find(s => s.supplierId === selId)
            const selTotal = selSup ? selSup.pricePerUnit * pq.quantity : 0

            return (
              <div key={pIdx}>
                {/* Part accordion header */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#141720] transition-colors text-right"
                  onClick={() => setExpanded(prev => ({ ...prev, [pIdx]: !isOpen }))}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isOpen
                      ? <ChevronUp   size={13} className="text-[#4a5270] shrink-0" />
                      : <ChevronDown size={13} className="text-[#4a5270] shrink-0" />
                    }
                    <span className="text-sm font-semibold text-[#c5cde2] truncate">
                      {pq.partName}
                    </span>
                    <span className="text-[10px] text-[#4a5270] shrink-0">×{pq.quantity}</span>
                    {pq.isOptional && (
                      <span className="text-[9px] border border-[#2e3147] text-[#4a5270] px-1.5 py-0.5 rounded-md shrink-0">
                        אופציונלי
                      </span>
                    )}
                  </div>
                  {selSup && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#4a5270]">{selSup.supplierName}</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        {formatCurrency(selTotal)}
                      </span>
                    </div>
                  )}
                </button>

                {/* Supplier options */}
                {isOpen && (
                  <div className="px-4 pb-3 space-y-2">
                    {pq.suppliers.map((sup, sIdx) => (
                      <SupplierCard
                        key={sup.supplierId}
                        sup={sup}
                        qty={pq.quantity}
                        selected={selId === sup.supplierId}
                        isCheapest={sIdx === pq.cheapestIdx}
                        isRecommended={sIdx === pq.recommendedIdx}
                        onSelect={() =>
                          setSelections(prev => ({ ...prev, [pIdx]: sup.supplierId }))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ Manual parts section ════════════════════════════════════════════════ */}
      <div className="px-5 py-4 border-t border-[#1e2230] space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#4a5270] uppercase tracking-[0.12em]">
            חלקים נוספים
          </p>
          <button
            type="button"
            onClick={addManualPart}
            className="flex items-center gap-1 text-xs font-semibold text-[#6366f1] hover:text-indigo-300 transition-colors"
          >
            <Plus size={12} />
            הוסף ידנית
          </button>
        </div>

        {manualParts.length === 0 ? (
          <p className="text-xs text-[#2e3147] py-1">הוסף חלקים שלא הופיעו באבחון</p>
        ) : (
          <>
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_56px_72px_24px] gap-2 text-[9px] text-[#2e3147] uppercase">
              <span>תיאור</span>
              <span className="text-center">כמות</span>
              <span className="text-center">מחיר יח׳</span>
              <span />
            </div>

            {manualParts.map((p, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_56px_72px_24px] gap-2 items-center">
                <input
                  type="text"
                  value={p.description}
                  onChange={e => updateManualPart(idx, 'description', e.target.value)}
                  placeholder="שם חלק"
                  className="bg-[#1a1d27] border border-[#252836] rounded-lg px-2.5 py-2 text-xs text-[#c5cde2] placeholder-[#2e3147] focus:outline-none focus:border-[#6366f1]/40 focus:ring-0"
                />
                <input
                  type="number"
                  min={1}
                  value={p.quantity}
                  onChange={e => updateManualPart(idx, 'quantity', e.target.value)}
                  className="bg-[#1a1d27] border border-[#252836] rounded-lg px-2 py-2 text-xs text-center text-[#c5cde2] font-mono focus:outline-none focus:border-[#6366f1]/40"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={p.unitPrice}
                  onChange={e => updateManualPart(idx, 'unitPrice', e.target.value)}
                  placeholder="₪"
                  className="bg-[#1a1d27] border border-[#252836] rounded-lg px-2 py-2 text-xs text-center text-[#c5cde2] font-mono focus:outline-none focus:border-[#6366f1]/40"
                />
                <button
                  type="button"
                  onClick={() => removeManualPart(idx)}
                  className="text-[#2e3147] hover:text-red-400 transition-colors flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ══ Cost summary ════════════════════════════════════════════════════════ */}
      <div className="px-5 py-4 border-t border-[#1e2230] bg-[#0d0f18] space-y-1.5">
        <div className="flex justify-between text-xs text-[#4a5270]">
          <span>חלקים שנבחרו</span>
          <span className="font-mono">{formatCurrency(allPartsSum)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#4a5270]">
          <span>עבודה ({laborHours} שע׳ × ₪{laborRate})</span>
          <span className="font-mono">{formatCurrency(laborSum)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#4a5270] pt-1.5 border-t border-[#1e2230]">
          <span>לפני מע&quot;מ</span>
          <span className="font-mono">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-[#4a5270]">
          <span>מע&quot;מ 17%</span>
          <span className="font-mono">{formatCurrency(vat)}</span>
        </div>
        <div className="flex justify-between font-black text-sm text-[#e2e8f0] pt-1.5 border-t border-[#252836]">
          <span>סה&quot;כ כולל מע&quot;מ</span>
          <span className="font-mono text-indigo-300">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      {/* ══ CTA ════════════════════════════════════════════════════════════════ */}
      <div className="px-5 pb-5 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full flex items-center justify-center gap-2.5 bg-[#6366f1] hover:bg-[#5558e8] text-white font-black text-base py-4 rounded-xl transition-colors active:scale-[0.98] shadow-lg shadow-[#6366f1]/20"
        >
          <CheckCircle2 size={16} />
          בנה הצעת מחיר עם החלקים שנבחרו
        </button>
      </div>

    </div>
  )
}
