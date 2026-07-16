'use client'

import {
  useState, useEffect, useCallback, useRef,
} from 'react'
import {
  Search, UserPlus, UserMinus, RefreshCw, Copy, CheckCircle,
  ChevronDown, ChevronUp, Shield, ShieldOff, Eye,
  MessageCircle, Phone, Car, Calendar, Clock,
  Send, X, ExternalLink, UserCheck,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PVehicle { id: string; plate: string; make: string; model: string; year: number }
interface PSession { id: string; createdAt: string; lastActiveAt: string }
interface PQuote   { id: string; status: string; createdAt: string; quoteNumber: string }
interface PAppt    { id: string; scheduledAt: string; status: string; vehicle: { plate: string; make: string; model: string } | null }

interface PilotCustomer {
  id: string; name: string; phone: string; mobile: string | null
  importSource: string | null; importId: string | null
  vehicles: PVehicle[]; sessions: PSession[]
  quotes: PQuote[]; appointments: PAppt[]
}

interface PilotRecord {
  id: string; customerId: string; organizationId: string
  addedAt: string; disabledAt: string | null; notes: string | null
  phoneVerified: boolean; vehiclesVerified: boolean; historyVerified: boolean
  loggedIn: boolean; quoteTested: boolean; apptTested: boolean; feedbackReceived: boolean
  checklistNotes: string | null
  customer: PilotCustomer
}

interface NesherRow {
  cli_no: number; cli_name: string; phone: string | null
  order_count: number; vehicle_count: number; last_visit_dt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function getPhone(p: PilotCustomer) { return p.mobile || p.phone || null }

function loginActivity(pilots: PilotRecord[]) {
  const days: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    days[d.toISOString().split('T')[0]] = 0
  }
  for (const p of pilots) {
    for (const s of p.customer.sessions) {
      const day = s.createdAt.split('T')[0]
      if (day in days) days[day]++
    }
  }
  return Object.entries(days).map(([date, count]) => ({ date, count }))
}

function getNextAppt(appts: PAppt[]) {
  const now = Date.now()
  return appts
    .filter(a => a.status !== 'CANCELLED' && new Date(a.scheduledAt).getTime() > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0] ?? null
}

// ─── Invitation templates ─────────────────────────────────────────────────────

const WA_TEMPLATE = `שלום {{firstName}},
אנחנו מזמינים אותך לבדוק את פורטל הלקוחות החדש של המוסך.

דרך הפורטל ניתן:
• לצפות ברכבים ובהיסטוריית הטיפולים
• לקבל הצעת מחיר
• לקבוע טיפול

כניסה:
{{portalUrl}}

נשמח לקבל ממך משוב.`

const SMS_TEMPLATE = `שלום {{firstName}}, הוזמנת לפיילוט פורטל הלקוחות של המוסך. כניסה: {{portalUrl}}`

function fillTemplate(t: string, firstName: string, url: string) {
  return t.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{portalUrl\}\}/g, url)
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <p className={`text-2xl font-black ${color ?? 'text-slate-800'}`}>{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

// ─── Login activity chart ─────────────────────────────────────────────────────

function LoginChart({ data }: { data: Array<{ date: string; count: number }> }) {
  const max  = Math.max(...data.map(d => d.count), 1)
  const days = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
  return (
    <div className="flex items-end gap-1 h-8 w-full" dir="ltr">
      {data.map(({ date, count }) => {
        const dayLabel = days[new Date(date).getDay()]
        return (
          <div key={date} className="flex-1 flex flex-col items-center gap-0.5" title={`${date}: ${count}`}>
            <div
              className="w-full rounded-t-sm"
              style={{
                height:    count > 0 ? `${Math.max((count / max) * 28, 4)}px` : '0',
                background: 'rgb(99 102 241)',
              }}
            />
            <span className="text-[9px] text-slate-400">{dayLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Checklist ────────────────────────────────────────────────────────────────

const CL_ITEMS: Array<{ key: keyof Pick<PilotRecord, 'phoneVerified'|'vehiclesVerified'|'historyVerified'|'loggedIn'|'quoteTested'|'apptTested'|'feedbackReceived'>; label: string }> = [
  { key: 'phoneVerified',    label: 'טלפון אומת' },
  { key: 'vehiclesVerified', label: 'רכבים אומתו' },
  { key: 'historyVerified',  label: 'היסטוריה אומתה' },
  { key: 'loggedIn',         label: 'לקוח נכנס' },
  { key: 'quoteTested',      label: 'הצעת מחיר נבדקה' },
  { key: 'apptTested',       label: 'תיאום תור נבדק' },
  { key: 'feedbackReceived', label: 'משוב התקבל' },
]

function Checklist({
  pilot, onUpdate,
}: { pilot: PilotRecord; onUpdate: (u: Partial<PilotRecord>) => void }) {
  const [saving,  setSaving]  = useState<string | null>(null)
  const [notes,   setNotes]   = useState(pilot.checklistNotes ?? '')
  const [notesOk, setNotesOk] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function toggle(key: typeof CL_ITEMS[0]['key']) {
    const v = !pilot[key]
    onUpdate({ [key]: v } as Partial<PilotRecord>)
    setSaving(key)
    await fetch(`/api/portal/pilot/${pilot.customerId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ checklist: { [key]: v } }),
    })
    setSaving(null)
  }

  function onNotes(v: string) {
    setNotes(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await fetch(`/api/portal/pilot/${pilot.customerId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checklist: { checklistNotes: v } }),
      })
      setNotesOk(true); setTimeout(() => setNotesOk(false), 1500)
    }, 700)
  }

  const done = CL_ITEMS.filter(i => pilot[i.key]).length

  return (
    <div className="border-t border-slate-100 pt-3 mt-1">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">צ׳קליסט</p>
        <span className="text-[11px] text-slate-400">{done}/{CL_ITEMS.length}</span>
        {done === CL_ITEMS.length && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ הושלם</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {CL_ITEMS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            disabled={saving === key}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-right ${
              pilot[key]
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-white'
            }`}
          >
            <span className={`w-4 h-4 rounded shrink-0 flex items-center justify-center text-[10px] ${pilot[key] ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white'}`}>
              {saving === key ? <RefreshCw size={8} className="animate-spin" /> : pilot[key] ? '✓' : ''}
            </span>
            {label}
          </button>
        ))}
      </div>
      <div className="relative">
        <textarea
          value={notes}
          onChange={e => onNotes(e.target.value)}
          placeholder="הערות לצ׳קליסט..."
          rows={2}
          className="w-full text-xs border border-slate-100 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-300 resize-none"
        />
        {notesOk && <CheckCircle size={11} className="absolute left-2 bottom-2 text-emerald-500" />}
      </div>
    </div>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
  pilot, channel, portalUrl, onClose,
}: { pilot: PilotRecord; channel: 'whatsapp' | 'sms'; portalUrl: string; onClose: () => void }) {
  const firstName = pilot.customer.name.split(' ')[0]
  const [msg,    setMsg]    = useState(fillTemplate(channel === 'whatsapp' ? WA_TEMPLATE : SMS_TEMPLATE, firstName, portalUrl))
  const [phone,  setPhone]  = useState(getPhone(pilot.customer) ?? '')
  const [busy,   setBusy]   = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function send() {
    if (!phone.trim()) { setResult({ ok: false, msg: 'נדרש מספר טלפון' }); return }
    setBusy(true)
    const r = await fetch(`/api/portal/pilot/${pilot.customerId}/invite`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ channel, message: msg, phone: phone.trim() }),
    })
    const d = await r.json()
    if (channel === 'whatsapp' && d.waUrl) {
      window.open(d.waUrl, '_blank')
      setResult({ ok: true, msg: 'WhatsApp נפתח — שלח את ההודעה שם ✓' })
    } else if (r.ok) {
      setResult({ ok: true, msg: 'SMS נשלח בהצלחה ✓' })
    } else {
      setResult({ ok: false, msg: d.error ?? 'שגיאה' })
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <p className="font-black text-slate-800">{channel === 'whatsapp' ? '📱 WhatsApp' : '💬 SMS'} — הזמנה לפורטל</p>
            <p className="text-slate-500 text-xs mt-0.5">{pilot.customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">מספר טלפון</label>
            <input
              type="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="050-..." disabled={!!result?.ok}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">הודעה (ניתנת לעריכה)</label>
            <textarea
              value={msg} onChange={e => setMsg(e.target.value)}
              rows={channel === 'whatsapp' ? 10 : 4}
              disabled={!!result?.ok}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-y font-mono"
              dir="rtl"
            />
            {channel === 'sms' && <p className="text-[11px] text-slate-400 mt-1">{msg.length} תווים</p>}
          </div>

          {result && (
            <div className={`text-sm px-4 py-3 rounded-xl font-medium ${result.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {result.msg}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-semibold py-3 rounded-2xl hover:bg-slate-50 text-sm">ביטול</button>
            <button
              onClick={send} disabled={busy || !!result?.ok}
              className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-2xl hover:bg-indigo-500 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {busy ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {channel === 'whatsapp' ? 'פתח WhatsApp' : 'שלח SMS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Pilot customer card ──────────────────────────────────────────────────────

function PilotCard({
  pilot, portalUrl, onRemove, onUpdate, onToggleAccess,
}: {
  pilot: PilotRecord; portalUrl: string
  onRemove: (id: string) => void
  onUpdate: (id: string, u: Partial<PilotRecord>) => void
  onToggleAccess: (id: string, disable: boolean) => void
}) {
  const [expanded, setExpanded]  = useState(false)
  const [acting,   setActing]    = useState<string | null>(null)
  const [copied,   setCopied]    = useState(false)
  const [invite,   setInvite]    = useState<'whatsapp' | 'sms' | null>(null)
  const [prevErr,  setPrevErr]   = useState<string | null>(null)

  const c          = pilot.customer
  const phone      = getPhone(c)
  const active     = !pilot.disabledAt
  const sessions   = c.sessions
  const lastLogin  = sessions[0]?.lastActiveAt ?? null
  const loginCount = sessions.length
  const qCreated   = c.quotes.length
  const qApproved  = c.quotes.filter(q => q.status === 'APPROVED').length
  const appts      = c.appointments.filter(a => a.status !== 'CANCELLED')
  const nextA      = getNextAppt(c.appointments)
  const clDone     = CL_ITEMS.filter(i => pilot[i.key]).length

  async function openPreview() {
    setActing('preview'); setPrevErr(null)
    const r = await fetch(`/api/portal/pilot/${pilot.customerId}/preview`, { method: 'POST' })
    const d = await r.json()
    setActing(null)
    if (!r.ok) { setPrevErr(d.error ?? 'שגיאה'); return }
    window.open(d.url, '_blank')
  }

  async function remove() {
    if (!confirm(`להסיר את ${c.name} מהפיילוט?`)) return
    setActing('remove')
    await fetch(`/api/portal/pilot/${pilot.customerId}`, { method: 'DELETE' })
    onRemove(pilot.customerId)
  }

  async function toggleAccess() {
    setActing('access')
    const disable = !pilot.disabledAt
    await fetch(`/api/portal/pilot/${pilot.customerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: disable }),
    })
    onToggleAccess(pilot.customerId, disable)
    setActing(null)
  }

  function copyLink() {
    navigator.clipboard.writeText(`${portalUrl}/portal/login`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {invite && (
        <InviteModal
          pilot={pilot} channel={invite}
          portalUrl={`${portalUrl}/portal/login`}
          onClose={() => setInvite(null)}
        />
      )}

      <div className={`bg-white rounded-2xl border shadow-sm transition-colors ${active ? 'border-slate-100' : 'border-slate-200 bg-slate-50/50'}`}>
        <div className="p-4">

          {/* ── Header row ──────────────────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
              {c.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-slate-800">{c.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">#{c.importId}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {active ? '● פעיל' : '○ מושבת'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Phone size={10} className={phone ? 'text-slate-400' : 'text-amber-400'} />
                  {phone ?? <span className="text-amber-500 font-medium">אין טלפון</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Car size={10} className="text-slate-400" />{c.vehicles.length} רכבים
                </span>
                {c.vehicles.slice(0, 3).map(v => (
                  <span key={v.id} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[10px]">{v.plate}</span>
                ))}
                {c.vehicles.length > 3 && <span className="text-slate-400 text-[10px]">+{c.vehicles.length - 3}</span>}
              </div>
            </div>
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors shrink-0">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* ── Stats grid ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2 mt-3 bg-slate-50 rounded-xl p-2.5">
            <div className="text-center">
              <p className="text-sm font-black text-indigo-600">{loginCount}</p>
              <p className="text-[10px] text-slate-400">כניסות</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-amber-600">{qCreated}</p>
              <p className="text-[10px] text-slate-400">הצעות</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-emerald-600">{qApproved}</p>
              <p className="text-[10px] text-slate-400">אושרו</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-violet-600">{appts.length}</p>
              <p className="text-[10px] text-slate-400">תורים</p>
            </div>
          </div>

          {/* Timing */}
          <div className="flex gap-4 mt-2 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={10} /> כניסה אחרונה: {fmtDate(lastLogin)}
            </span>
            {nextA && (
              <span className="flex items-center gap-1 text-violet-600 font-medium">
                <Calendar size={10} /> תור: {fmtDate(nextA.scheduledAt)}
              </span>
            )}
          </div>

          {prevErr && <p className="text-xs text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded">{prevErr}</p>}

          {/* ── Action bar ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <button
              onClick={openPreview} disabled={acting === 'preview'}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {acting === 'preview' ? <RefreshCw size={11} className="animate-spin" /> : <Eye size={11} />}
              צפה כלקוח
            </button>

            <button
              onClick={() => setInvite('whatsapp')}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle size={11} /> WhatsApp
            </button>

            <button
              onClick={() => setInvite('sms')}
              className="flex items-center gap-1.5 text-xs font-bold text-sky-700 border border-sky-200 bg-sky-50 px-2.5 py-1.5 rounded-lg hover:bg-sky-100 transition-colors"
            >
              <Send size={11} /> SMS
            </button>

            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {copied ? <CheckCircle size={11} className="text-emerald-500" /> : <Copy size={11} />}
              {copied ? 'הועתק' : 'קישור'}
            </button>

            <button
              onClick={toggleAccess} disabled={acting === 'access'}
              className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                active
                  ? 'text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100'
                  : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {acting === 'access' ? <RefreshCw size={11} className="animate-spin" /> : active ? <ShieldOff size={11} /> : <Shield size={11} />}
              {active ? 'השבת' : 'הפעל'}
            </button>

            <button
              onClick={remove} disabled={acting === 'remove'}
              className="flex items-center gap-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 px-2.5 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors mr-auto"
            >
              {acting === 'remove' ? <RefreshCw size={11} className="animate-spin" /> : <UserMinus size={11} />}
              הסר
            </button>
          </div>

          {/* Checklist progress bar */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(clDone / CL_ITEMS.length) * 100}%` }} />
            </div>
            <span className="text-[11px] text-slate-400 shrink-0">{clDone}/{CL_ITEMS.length} צ׳קליסט</span>
          </div>
        </div>

        {/* ── Expanded details ─────────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">

            {/* Vehicles */}
            {c.vehicles.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">רכבים</p>
                <div className="space-y-1.5">
                  {c.vehicles.map(v => (
                    <div key={v.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <Car size={11} className="text-slate-400 shrink-0" />
                      <span className="font-mono font-bold">{v.plate}</span>
                      <span className="text-slate-400">{v.make} {v.model}</span>
                      {v.year && <span className="text-slate-400 mr-auto">{v.year}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appointments */}
            {appts.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">תורים ({appts.length})</p>
                <div className="space-y-1.5">
                  {appts.slice(0, 3).map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <Calendar size={11} className="text-violet-400 shrink-0" />
                      <span>{fmtDate(a.scheduledAt)}</span>
                      {a.vehicle && <span className="text-slate-400">{a.vehicle.make} {a.vehicle.plate}</span>}
                      <span className={`mr-auto text-[10px] font-bold px-1.5 rounded-full ${a.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.status === 'CONFIRMED' ? 'מאושר' : 'ממתין'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quotes */}
            {c.quotes.length > 0 && (
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">הצעות מחיר ({c.quotes.length})</p>
                <div className="space-y-1.5">
                  {c.quotes.slice(0, 3).map(q => (
                    <div key={q.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="font-mono text-slate-400">{q.quoteNumber}</span>
                      <span className="text-slate-400">{fmtDate(q.createdAt)}</span>
                      <span className={`mr-auto text-[10px] font-bold px-1.5 rounded-full ${
                        q.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                        q.status === 'SENT'     ? 'bg-amber-100 text-amber-700'     :
                        q.status === 'REJECTED' ? 'bg-red-100 text-red-600'         :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {q.status === 'APPROVED' ? 'אושר' : q.status === 'SENT' ? 'נשלח' : q.status === 'REJECTED' ? 'נדחה' : 'טיוטה'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist */}
            <Checklist pilot={pilot} onUpdate={u => onUpdate(pilot.customerId, u)} />
          </div>
        )}
      </div>
    </>
  )
}

// ─── Add customer search panel ────────────────────────────────────────────────

function AddPanel({
  pilotIds, onAdded, onClose,
}: { pilotIds: Set<string>; onAdded: () => void; onClose: () => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<NesherRow[]>([])
  const [loading, setLoading] = useState(false)
  const [adding,  setAdding]  = useState<number | null>(null)
  const [added,   setAdded]   = useState<Set<number>>(new Set())
  const [error,   setError]   = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/nesher/customers?search=${encodeURIComponent(query)}&limit=30`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setResults(d.rows ?? [])
    } catch (e) {
      setError(`שגיאה: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setLoading(false) }
  }

  async function add(cliNo: number) {
    setAdding(cliNo)
    const r = await fetch('/api/portal/pilot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ cliNo: String(cliNo) }),
    })
    const d = await r.json()
    setAdding(null)
    if (!r.ok) { setError(d.error ?? 'שגיאה'); return }
    setAdded(prev => { const s = new Set(prev); s.add(cliNo); return s })
    onAdded()
  }

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-black text-slate-700">הוסף לקוח NESHER לפיילוט</p>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
      </div>
      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl mb-3">{error}</p>}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 pointer-events-none" />
          <input
            type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="שם, מספר לקוח..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>
        <button
          onClick={search} disabled={loading || !query.trim()}
          className="bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-500 disabled:opacity-40 flex items-center gap-1.5"
        >
          {loading ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
          חפש
        </button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {results.map(row => {
            const inPilot   = pilotIds.has(String(row.cli_no))
            const justAdded = added.has(row.cli_no)
            return (
              <div key={row.cli_no} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${inPilot || justAdded ? 'bg-indigo-50' : 'bg-slate-50 hover:bg-slate-100'}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{row.cli_name}</p>
                  <p className="text-[11px] text-slate-400">#{row.cli_no} · {row.vehicle_count} רכבים</p>
                </div>
                {inPilot || justAdded ? (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg shrink-0">בפיילוט</span>
                ) : (
                  <button
                    onClick={() => add(row.cli_no)} disabled={adding === row.cli_no}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-600 border border-indigo-200 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50 shrink-0"
                  >
                    {adding === row.cli_no ? <RefreshCw size={10} className="animate-spin" /> : <UserPlus size={10} />}
                    הוסף
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomerPilotPage() {
  const [pilots,  setPilots]  = useState<PilotRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/portal/pilot')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setPilots(d.pilots ?? [])
    } catch (e) {
      setError(`שגיאת טעינה: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function remove(cId: string)      { setPilots(prev => prev.filter(p => p.customerId !== cId)) }
  function update(cId: string, u: Partial<PilotRecord>) { setPilots(prev => prev.map(p => p.customerId === cId ? { ...p, ...u } : p)) }
  function toggleAccess(cId: string, disable: boolean) {
    setPilots(prev => prev.map(p => p.customerId === cId ? { ...p, disabledAt: disable ? new Date().toISOString() : null } : p))
  }

  // Stats
  const total         = pilots.length
  const activeCount   = pilots.filter(p => !p.disabledAt).length
  const loggedIn      = pilots.filter(p => p.customer.sessions.length > 0).length
  const neverIn       = total - loggedIn
  const totalAppts    = pilots.reduce((s, p) => s + p.customer.appointments.filter(a => a.status !== 'CANCELLED').length, 0)
  const totalApproved = pilots.reduce((s, p) => s + p.customer.quotes.filter(q => q.status === 'APPROVED').length, 0)
  const cutoff        = Date.now() - 7 * 24 * 60 * 60 * 1000
  const sevenDays     = pilots.reduce((s, p) => s + p.customer.sessions.filter(ss => new Date(ss.createdAt).getTime() > cutoff).length, 0)
  const chart         = loginActivity(pilots)
  const pilotImportIds = new Set(pilots.map(p => p.customer.importId ?? '').filter(Boolean))

  return (
    <div className="max-w-4xl mx-auto p-5 space-y-5" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-800">פיילוט לקוחות</h1>
          <p className="text-slate-500 text-sm mt-0.5">רק אתה מחליט מי מצטרף · כל פעולה מתועדת</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100" title="רענן">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <a href="/portal/login" target="_blank" className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 bg-white px-3 py-2 rounded-xl hover:border-indigo-300 transition-colors">
            <ExternalLink size={13} /> פתח פורטל
          </a>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 text-sm font-bold bg-indigo-600 text-white px-3 py-2 rounded-xl hover:bg-indigo-500 transition-colors"
          >
            <UserPlus size={14} /> הוסף לקוח
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <StatCard label="בפיילוט"       value={total}         />
          <StatCard label="גישה פעילה"    value={activeCount}   color="text-emerald-600" />
          <StatCard label="כניסה אחת+"    value={loggedIn}      color="text-indigo-600" />
          <StatCard label="לא נכנסו"      value={neverIn}       color={neverIn > 0 ? 'text-amber-600' : 'text-slate-400'} />
          <StatCard label="תורים"         value={totalAppts}    color="text-violet-600" />
          <StatCard label="אושרו"         value={totalApproved} color="text-sky-600" />
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <p className="text-2xl font-black text-slate-800">{sevenDays}</p>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">כניסות 7 ימים</p>
            <div className="mt-2"><LoginChart data={chart} /></div>
          </div>
        </div>
      )}

      {/* Add customer panel */}
      {showAdd && (
        <AddPanel
          pilotIds={pilotImportIds}
          onAdded={load}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Pilot cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <RefreshCw size={18} className="animate-spin" /><span className="text-sm">טוען...</span>
        </div>
      ) : pilots.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCheck size={28} className="text-indigo-400" />
          </div>
          <p className="text-slate-600 font-bold text-lg">אין לקוחות בפיילוט</p>
          <p className="text-slate-400 text-sm mt-1">לחץ &#34;הוסף לקוח&#34; כדי לחפש לקוח NESHER</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pilots.map(pilot => (
            <PilotCard
              key={pilot.customerId}
              pilot={pilot}
              portalUrl={origin}
              onRemove={remove}
              onUpdate={update}
              onToggleAccess={toggleAccess}
            />
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
          <code className="flex-1 text-xs text-slate-600 font-mono truncate">{origin}/portal/login</code>
          <button
            onClick={() => navigator.clipboard.writeText(`${origin}/portal/login`)}
            className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 shrink-0"
          >
            <Copy size={11} /> העתק
          </button>
        </div>
      )}
    </div>
  )
}
