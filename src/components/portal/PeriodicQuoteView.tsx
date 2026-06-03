'use client'

import { useState, useTransition } from 'react'
import { approveQuote }            from '@/app/actions/portal'
import { formatCurrency }          from '@/lib/utils'
import type { PeriodicPortalData, PeriodicItemData } from '@/lib/periodic-portal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VAT_RATE = 0.17

function itemCost(item: PeriodicItemData, laborRate: number): number {
  return Math.round((item.unitPrice * item.quantity + item.laborHours * laborRate) * 100) / 100
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, color }: { title: string; color: 'emerald' | 'indigo' | 'amber' }) {
  const styles = {
    emerald: 'text-emerald-700 border-emerald-200 bg-emerald-50',
    indigo:  'text-indigo-700  border-indigo-200  bg-indigo-50',
    amber:   'text-amber-700   border-amber-200   bg-amber-50',
  }
  return (
    <div className={`px-5 py-2.5 border-b text-xs font-bold uppercase tracking-widest ${styles[color]}`}>
      {title}
    </div>
  )
}

function ItemRow({
  item,
  laborRate,
  checked,
  onToggle,
  icon,
  canToggle,
}: {
  item:       PeriodicItemData
  laborRate:  number
  checked:    boolean
  onToggle?:  () => void
  icon:       'check' | 'circle' | 'warning'
  canToggle:  boolean
}) {
  const cost    = itemCost(item, laborRate)
  const isZero  = cost === 0

  const iconEl = icon === 'check' ? (
    <span className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
      <span className="text-emerald-600 text-xs font-bold">✓</span>
    </span>
  ) : icon === 'warning' ? (
    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
      checked
        ? 'bg-amber-100 border border-amber-300'
        : 'bg-slate-100 border border-slate-200'
    }`}>
      <span className={`text-xs ${checked ? 'text-amber-600' : 'text-slate-400'}`}>⚠</span>
    </span>
  ) : (
    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      checked
        ? 'border-indigo-500 bg-indigo-500'
        : 'border-slate-300 bg-white'
    }`}>
      {checked && <span className="text-white text-[10px] font-bold">✓</span>}
    </span>
  )

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
        canToggle ? 'cursor-pointer active:bg-slate-50/50' : ''
      } ${!checked && icon !== 'check' ? 'opacity-50' : ''}`}
      onClick={canToggle ? onToggle : undefined}
    >
      {iconEl}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-slate-800' : 'text-slate-500'}`}>
          {item.nameHe}
        </p>
        {item.notes && (
          <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
        )}
      </div>
      <p className={`text-sm font-bold shrink-0 tabular-nums ${
        isZero
          ? 'text-slate-400'
          : checked ? 'text-slate-900' : 'text-slate-400'
      }`}>
        {isZero ? 'כלול' : formatCurrency(cost)}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PeriodicQuoteView({
  periodicData,
  quoteId,
  workOrderId,
  quoteStatus,
  orgPhone,
}: {
  periodicData: PeriodicPortalData
  quoteId:      string
  workOrderId:  string
  quoteStatus:  string
  orgPhone:     string | null
}) {
  const [selectedRec,  setSelectedRec]  = useState(() => new Set(periodicData.initialRecommended))
  const [selectedSafe, setSelectedSafe] = useState(() => new Set(periodicData.initialSafety))
  const [pending,      startTransition] = useTransition()
  const [done,         setDone]         = useState(false)

  const { required, recommended, safety, laborRate, intervalLabel, vehicleName, mileage } = periodicData
  const canAct = quoteStatus === 'SENT'

  // Live total calculation
  const requiredCost = required.reduce((s, i)     => s + itemCost(i, laborRate), 0)
  const recCost      = recommended
    .filter((_, i) => selectedRec.has(i))
    .reduce((s, i)  => s + itemCost(i, laborRate), 0)
  const safeCost     = safety
    .filter((_, i) => selectedSafe.has(i))
    .reduce((s, i)  => s + itemCost(i, laborRate), 0)
  const subtotal  = Math.round((requiredCost + recCost + safeCost) * 100) / 100
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100
  const total     = Math.round((subtotal + vatAmount) * 100) / 100

  function toggleRec(idx: number) {
    setSelectedRec(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }
  function toggleSafe(idx: number) {
    setSelectedSafe(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }

  function handleApprove() {
    startTransition(async () => {
      await approveQuote(quoteId, workOrderId)
      setDone(true)
    })
  }

  if (done) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-10 text-center space-y-3">
        <span className="text-5xl block">✅</span>
        <p className="font-bold text-emerald-700 text-xl">ההצעה אושרה בהצלחה!</p>
        <p className="text-sm text-emerald-600">תודה — הצוות שלנו יצור איתך קשר לקביעת תור</p>
      </div>
    )
  }

  const callbackHref = orgPhone
    ? `https://wa.me/972${orgPhone.replace(/^0/, '').replace(/\D/g, '')}?text=${encodeURIComponent(
        `שלום, קיבלתי הצעת מחיר עבור ${vehicleName} ואני מעוניין לדון בה לפני אישור.`
      )}`
    : null

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <p className="font-black text-slate-900 text-lg leading-tight">{intervalLabel}</p>
        <p className="text-sm text-slate-500 mt-1">
          {vehicleName} · {mileage.toLocaleString('he-IL')} ק״מ
        </p>
      </div>

      {/* ── Required section ────────────────────────────────────────────────── */}
      {required.length > 0 && (
        <>
          <SectionHeader title="נדרש לפי יצרן" color="emerald" />
          <div className="divide-y divide-slate-50">
            {required.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                laborRate={laborRate}
                checked={true}
                icon="check"
                canToggle={false}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Recommended section ─────────────────────────────────────────────── */}
      {recommended.length > 0 && (
        <>
          <SectionHeader title="מומלץ" color="indigo" />
          {canAct && (
            <p className="px-5 py-2 text-xs text-slate-400 bg-indigo-50/50">
              לחץ להוסיף / להסיר פריטים מומלצים
            </p>
          )}
          <div className="divide-y divide-slate-50">
            {recommended.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                laborRate={laborRate}
                checked={selectedRec.has(i)}
                onToggle={() => canAct && toggleRec(i)}
                icon="circle"
                canToggle={canAct}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Safety section ──────────────────────────────────────────────────── */}
      {safety.length > 0 && (
        <>
          <SectionHeader title="התראות בטיחות" color="amber" />
          {canAct && (
            <p className="px-5 py-2 text-xs text-amber-700 bg-amber-50/50">
              פריטי בטיחות — מומלץ לטפל בדחיפות
            </p>
          )}
          <div className="divide-y divide-slate-50">
            {safety.map((item, i) => (
              <ItemRow
                key={i}
                item={item}
                laborRate={laborRate}
                checked={selectedSafe.has(i)}
                onToggle={() => canAct && toggleSafe(i)}
                icon="warning"
                canToggle={canAct}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Total breakdown ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>סכום לפני מע״מ</span>
          <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>מע״מ 17%</span>
          <span className="font-mono tabular-nums">{formatCurrency(vatAmount)}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <p className="font-bold text-slate-900 text-base">סה״כ לתשלום</p>
          <p className="font-black text-indigo-600 text-2xl tabular-nums">{formatCurrency(total)}</p>
        </div>
      </div>

      {/* ── CTAs ────────────────────────────────────────────────────────────── */}
      {canAct && (
        <div className="px-5 py-5 border-t border-slate-100 space-y-3">
          <p className="text-sm font-bold text-slate-700">האם לאשר את הצעת המחיר?</p>
          <button
            onClick={handleApprove}
            disabled={pending}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold text-base px-6 py-4 rounded-2xl shadow-md shadow-emerald-200 active:scale-[0.98] transition-transform min-h-[60px] disabled:opacity-50"
          >
            {pending
              ? <span className="animate-spin text-xl">⌛</span>
              : <span className="text-xl">✅</span>}
            מאשר הצעת מחיר
          </button>

          {callbackHref ? (
            <a
              href={callbackHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 font-semibold text-sm px-6 py-3.5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform min-h-[52px]"
            >
              <span>📞</span>
              מבקש שיחזרו אלי
            </a>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-500 font-semibold text-sm px-6 py-3.5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform min-h-[52px]"
              onClick={() => window.history.back()}
            >
              לא כרגע
            </button>
          )}
        </div>
      )}

      {/* ── Approved state ──────────────────────────────────────────────────── */}
      {quoteStatus === 'APPROVED' && (
        <div className="px-5 py-5 border-t border-slate-100">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <span className="text-3xl block mb-1">✅</span>
            <p className="font-bold text-emerald-700">ההצעה אושרה — תודה!</p>
            <p className="text-sm text-emerald-600 mt-1">הצוות שלנו יצור איתך קשר לקביעת תור</p>
          </div>
        </div>
      )}

      {/* ── Rejected / other state ──────────────────────────────────────────── */}
      {quoteStatus === 'REJECTED' && (
        <div className="px-5 py-5 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-slate-500">ההצעה נסגרה</p>
          </div>
        </div>
      )}

      {/* ── Disclaimer ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 leading-relaxed text-center">
          הצעה אוטומטית לפי נתוני רכב וק״מ — המחיר הסופי יאושר בעת הטיפול
        </p>
      </div>
    </div>
  )
}
