'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search, Loader2, Plus, Trash2, ChevronDown, ChevronUp,
  Car, User, FileText, Send, Save, Copy, CheckCircle,
} from 'lucide-react'
import type { AutoQuoteItem } from '@/app/api/quotes/automatic/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoryRow {
  card_no:   number | null
  open_dt:   string | null
  car_no:    string | null
  cli_name:  string | null
  cli_no:    number | null
  cli_comp1: string | null
  card_km:   number | null
  total:     number
}

interface LineItem extends AutoQuoteItem {
  _id: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_LABOR_RATE = 295

const DEFAULT_ITEMS: Omit<LineItem, '_id'>[] = [
  { description: 'שמן מנוע',          quantity: 1, unitPrice: 180, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'פילטר שמן',          quantity: 1, unitPrice:  45, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'פילטר אוויר',        quantity: 1, unitPrice:  65, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'פילטר קבינה (מזגן)', quantity: 1, unitPrice:  55, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'נוזל שמשות',         quantity: 1, unitPrice:  25, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'חומרי ניקוי',        quantity: 1, unitPrice:  30, laborHours: 0, discount: 0, itemType: 'part' },
  { description: 'טיפול תקופתי',       quantity: 1, unitPrice:   0, laborHours: 1, discount: 0, itemType: 'labor' },
  { description: 'בדיקת בלמים',        quantity: 1, unitPrice:   0, laborHours: 0.5, discount: 0, itemType: 'labor' },
]

const VAT_RATE = 0.17

function uid() { return Math.random().toString(36).slice(2) }

function fmtDate(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function lineTotal(item: LineItem, laborRate: number): number {
  const base = item.itemType === 'labor'
    ? item.laborHours * laborRate
    : item.quantity * item.unitPrice + item.laborHours * laborRate
  return Math.round(base * (1 - item.discount / 100) * 100) / 100
}

function fmtILS(n: number): string {
  return n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2 })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AutomaticQuoteForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [plate,     setPlate]     = useState(searchParams.get('plate')   ?? '')
  const [mileage,   setMileage]   = useState('')
  const [complaint, setComplaint] = useState('')
  const [laborRate, setLaborRate] = useState(DEFAULT_LABOR_RATE)

  const [history,   setHistory]   = useState<HistoryRow[] | null>(null)
  const [cliNo,     setCliNo]     = useState<number | null>(searchParams.get('cliNo') ? parseInt(searchParams.get('cliNo')!) : null)
  const [cliName,   setCliName]   = useState(searchParams.get('name')    ?? '')
  const [carDesc,   setCarDesc]   = useState(searchParams.get('carDesc') ?? '')

  const [fetching,  setFetching]  = useState(false)
  const [fetchErr,  setFetchErr]  = useState<string | null>(null)
  const [items,     setItems]     = useState<LineItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState<{ quoteId: string; quoteNumber: string; portalToken: string } | null>(null)
  const [copied,    setCopied]    = useState(false)
  const [notes,     setNotes]     = useState('')

  const plateInput = useRef<HTMLInputElement>(null)

  // Auto-fetch if plate pre-filled from URL
  useEffect(() => {
    if (plate && !history) fetchHistory(plate)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchHistory(p: string) {
    const clean = p.trim().toUpperCase()
    if (!clean) return
    setFetching(true)
    setFetchErr(null)
    setHistory(null)
    setItems([])
    try {
      const r    = await fetch(`/api/nesher/vehicles/${encodeURIComponent(clean)}/history?limit=20`)
      const body = await r.json()
      if (!r.ok) { setFetchErr(body.error ?? 'שגיאה'); return }

      const rows: HistoryRow[] = body.rows ?? []
      setHistory(rows)

      // Auto-populate cli info from most recent record
      if (rows.length > 0) {
        const latest = rows[0]
        if (latest.cli_no && !cliNo)   setCliNo(latest.cli_no)
        if (latest.cli_name && !cliName) setCliName(latest.cli_name)
        if (!mileage && latest.card_km) setMileage(String(latest.card_km))
      }

      // Generate default items based on history
      setItems(buildItems(rows, parseInt(mileage || '0', 10)))
    } catch {
      setFetchErr('לא ניתן להגיע לקונקטור')
    } finally {
      setFetching(false)
    }
  }

  function buildItems(rows: HistoryRow[], km: number): LineItem[] {
    // Check which items were recently done (in last 2 orders)
    const recentComplaints = rows.slice(0, 2).map(r => (r.cli_comp1 ?? '').toLowerCase())
    const oilDone = recentComplaints.some(c => c.includes('שמן') || c.includes('oil'))

    return DEFAULT_ITEMS
      .filter(it => !(oilDone && it.description.includes('שמן')))
      .map(it => ({ ...it, _id: uid() }))
  }

  // ── Item editing ────────────────────────────────────────────────────────────

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems(prev => prev.map(it => it._id === id ? { ...it, ...patch } : it))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it._id !== id))
  }

  function addItem() {
    setItems(prev => [...prev, { _id: uid(), description: '', quantity: 1, unitPrice: 0, laborHours: 0, discount: 0, itemType: 'part' }])
  }

  // ── Totals ──────────────────────────────────────────────────────────────────

  const subtotal  = items.reduce((s, it) => s + lineTotal(it, laborRate), 0)
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100
  const total     = subtotal + vatAmount

  // ── Save ────────────────────────────────────────────────────────────────────

  async function save(send = false) {
    if (!plate.trim()) { alert('יש להזין מספר רישוי'); return }
    if (!items.length) { alert('יש להוסיף לפחות פריט אחד'); return }

    setSaving(true)
    try {
      const payload = {
        plate:       plate.trim().toUpperCase(),
        mileage:     parseInt(mileage || '0', 10),
        complaint,
        nesherCliNo: cliNo,
        cliName,
        carDesc,
        items:       items.map(({ _id: _, ...rest }) => rest),
        laborRate,
        notes,
      }
      const r    = await fetch('/api/quotes/automatic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await r.json()
      if (!r.ok) { alert(body.error ?? 'שגיאה בשמירה'); return }

      setSaved(body)

      if (send) {
        // Mark as SENT
        await fetch(`/api/quotes/${body.quoteId}/send`, { method: 'POST' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function copyPortalLink() {
    if (!saved) return
    const url = `${window.location.origin}/portal/quote/${saved.portalToken}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (saved) {
    const portalUrl = `/portal/quote/${saved.portalToken}`
    return (
      <div dir="rtl" className="max-w-lg mx-auto text-center space-y-5 py-10">
        <CheckCircle size={48} className="mx-auto text-emerald-400" />
        <h2 className="text-xl font-bold">הצעת מחיר נשמרה!</h2>
        <p className="text-[#8892a4] text-sm">מספר הצעה: <span className="font-mono text-[#6366f1]">{saved.quoteNumber}</span></p>

        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 text-sm space-y-3">
          <p className="font-semibold text-[#e2e8f0]">קישור לפורטל לקוח:</p>
          <div className="bg-[#252836] rounded-lg px-3 py-2 font-mono text-xs text-[#6366f1] break-all text-right" dir="ltr">
            {window.location.origin}{portalUrl}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={copyPortalLink}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6366f1] text-white text-sm hover:bg-[#4f46e5] transition-colors"
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? 'הועתק!' : 'העתק קישור'}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#252836] border border-[#2e3147] text-[#8892a4] text-sm hover:text-[#e2e8f0] transition-colors"
            >
              <FileText size={14} /> פתח פורטל
            </a>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.push(`/dashboard/quotes/${saved.quoteId}`)}
            className="px-4 py-2 rounded-lg bg-[#252836] border border-[#2e3147] text-[#8892a4] text-sm hover:text-[#e2e8f0] transition-colors"
          >
            צפה בהצעה
          </button>
          <button
            onClick={() => { setSaved(null); setPlate(''); setHistory(null); setItems([]) }}
            className="px-4 py-2 rounded-lg text-[#6366f1] text-sm hover:underline"
          >
            הצעה חדשה
          </button>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Step 1: Plate search */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Car size={16} className="text-[#6366f1]" /> פרטי הרכב</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-[#8892a4] block mb-1">לוחית רישוי *</label>
            <div className="flex gap-2">
              <input
                ref={plateInput}
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') fetchHistory(plate) }}
                placeholder="12-345-67"
                className="flex-1 bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#5a6279] focus:outline-none focus:border-[#6366f1]/60 font-mono"
                dir="ltr"
              />
              <button
                onClick={() => fetchHistory(plate)}
                disabled={fetching || !plate.trim()}
                className="px-3 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm disabled:opacity-50 transition-colors"
              >
                {fetching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#8892a4] block mb-1">קילומטרז׳</label>
            <input
              type="number"
              value={mileage}
              onChange={e => setMileage(e.target.value)}
              placeholder="מד ק״מ נוכחי"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#5a6279] focus:outline-none focus:border-[#6366f1]/60"
            />
          </div>
          <div>
            <label className="text-xs text-[#8892a4] block mb-1">תלונת לקוח / סיבת ביקור</label>
            <input
              type="text"
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder="טיפול שוטף, בלמים…"
              className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder:text-[#5a6279] focus:outline-none focus:border-[#6366f1]/60"
            />
          </div>
        </div>

        {fetchErr && <p className="text-sm text-red-400">{fetchErr}</p>}

        {/* Customer info auto-populated */}
        {(cliName || cliNo) && (
          <div className="flex items-center gap-2 text-sm text-[#8892a4] bg-[#252836] rounded-lg px-3 py-2">
            <User size={13} className="text-[#6366f1]" />
            <span>{cliName || '—'}</span>
            {cliNo && <span className="text-xs font-mono">({cliNo})</span>}
            {carDesc && <><span className="text-[#2e3147]">|</span><span className="text-xs">{carDesc}</span></>}
          </div>
        )}
      </div>

      {/* Work history (collapsible) */}
      {history !== null && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-[#252836]/40 transition-colors"
          >
            <span className="flex items-center gap-2"><FileText size={14} className="text-[#6366f1]" /> היסטוריית שירות ({history.length} רשומות)</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHistory && history.length > 0 && (
            <div className="overflow-x-auto border-t border-[#2e3147]">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="bg-[#252836]">
                    {['כרטיסיה', 'תאריך', 'ק״מ', 'תלונה', 'סה״כ'].map(h => (
                      <th key={h} className="px-3 py-2 text-right text-[#8892a4] font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i} className="border-t border-[#2e3147] hover:bg-[#252836]/30">
                      <td className="px-3 py-2 font-mono text-[#6366f1]">{r.card_no ?? '—'}</td>
                      <td className="px-3 py-2 text-[#8892a4] whitespace-nowrap">{fmtDate(r.open_dt)}</td>
                      <td className="px-3 py-2 text-[#8892a4]">{r.card_km?.toLocaleString() ?? '—'}</td>
                      <td className="px-3 py-2 text-[#8892a4] max-w-[200px] truncate">{r.cli_comp1 || '—'}</td>
                      <td className="px-3 py-2 text-emerald-400 font-semibold whitespace-nowrap">{fmtILS(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {showHistory && history.length === 0 && (
            <p className="text-sm text-[#8892a4] text-center py-6 border-t border-[#2e3147]">אין היסטוריה לרכב זה</p>
          )}
        </div>
      )}

      {/* Quote items */}
      {items.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#2e3147]">
            <h2 className="font-semibold text-sm flex items-center gap-2"><FileText size={14} className="text-[#6366f1]" /> פירוט הצעת מחיר</h2>
            <div className="flex items-center gap-2 text-xs text-[#8892a4]">
              <span>תעריף שעה:</span>
              <input
                type="number"
                value={laborRate}
                onChange={e => setLaborRate(parseInt(e.target.value) || DEFAULT_LABOR_RATE)}
                className="w-20 bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60"
              />
              <span>₪/שעה</span>
            </div>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-[1fr_60px_80px_70px_60px_50px_80px_36px] gap-1 px-3 py-2 bg-[#252836] text-xs font-semibold text-[#8892a4] min-w-[700px]">
            <span>תיאור פריט</span><span>כמות</span><span>מחיר יחידה</span><span>שעות עבודה</span><span>הנחה%</span><span>סוג</span><span className="text-left">סה״כ</span><span></span>
          </div>

          <div className="divide-y divide-[#2e3147] min-w-[700px]">
            {items.map(item => {
              const tot = lineTotal(item, laborRate)
              return (
                <div key={item._id} className="grid grid-cols-[1fr_60px_80px_70px_60px_50px_80px_36px] gap-1 px-3 py-2 items-center">
                  <input
                    value={item.description}
                    onChange={e => updateItem(item._id, { description: e.target.value })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 w-full"
                  />
                  <input
                    type="number" min="1"
                    value={item.quantity}
                    onChange={e => updateItem(item._id, { quantity: parseFloat(e.target.value) || 1 })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-sm text-center text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 w-full"
                  />
                  <input
                    type="number" min="0" step="0.01"
                    value={item.unitPrice}
                    onChange={e => updateItem(item._id, { unitPrice: parseFloat(e.target.value) || 0 })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 w-full"
                  />
                  <input
                    type="number" min="0" step="0.25"
                    value={item.laborHours}
                    onChange={e => updateItem(item._id, { laborHours: parseFloat(e.target.value) || 0 })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 w-full"
                  />
                  <input
                    type="number" min="0" max="100" step="1"
                    value={item.discount}
                    onChange={e => updateItem(item._id, { discount: parseFloat(e.target.value) || 0 })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#6366f1]/60 w-full"
                  />
                  <select
                    value={item.itemType}
                    onChange={e => updateItem(item._id, { itemType: e.target.value as 'part' | 'labor' | 'other' })}
                    className="bg-[#252836] border border-[#2e3147] rounded px-1 py-1 text-xs text-[#e2e8f0] focus:outline-none w-full"
                  >
                    <option value="part">חלק</option>
                    <option value="labor">עבודה</option>
                    <option value="other">אחר</option>
                  </select>
                  <span className={`text-sm font-semibold text-left tabular-nums ${tot > 0 ? 'text-emerald-400' : 'text-[#5a6279]'}`}>{fmtILS(tot)}</span>
                  <button onClick={() => removeItem(item._id)} className="flex items-center justify-center w-8 h-8 rounded text-[#5a6279] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Add row */}
          <div className="px-3 py-2 border-t border-[#2e3147]">
            <button onClick={addItem} className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:underline">
              <Plus size={13} /> הוסף שורה
            </button>
          </div>

          {/* Totals */}
          <div className="border-t border-[#2e3147] bg-[#252836]/50 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>סכום לפני מע״מ</span>
              <span className="font-mono tabular-nums">{fmtILS(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-[#8892a4]">
              <span>מע״מ {Math.round(VAT_RATE * 100)}%</span>
              <span className="font-mono tabular-nums">{fmtILS(vatAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#2e3147]">
              <span className="font-bold">סה״כ לתשלום</span>
              <span className="font-black text-[#6366f1] text-lg tabular-nums">{fmtILS(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {items.length > 0 && (
        <div>
          <label className="text-xs text-[#8892a4] block mb-1">הערות להצעה</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="הערות פנימיות או ללקוח…"
            className="w-full bg-[#1a1d27] border border-[#2e3147] rounded-xl px-4 py-3 text-sm text-[#e2e8f0] placeholder:text-[#5a6279] focus:outline-none focus:border-[#6366f1]/60 resize-none"
          />
        </div>
      )}

      {/* Action buttons */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#252836] border border-[#2e3147] text-[#e2e8f0] text-sm font-medium hover:bg-[#2e3147] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            שמור טיוטה
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            שלח ללקוח
          </button>
        </div>
      )}

      {!history && !fetching && (
        <div className="flex flex-col items-center gap-3 py-16 text-[#5a6279]">
          <Car size={40} className="opacity-30" />
          <p className="text-sm">הזן לוחית רישוי ולחץ חיפוש כדי להתחיל</p>
        </div>
      )}
    </div>
  )
}
