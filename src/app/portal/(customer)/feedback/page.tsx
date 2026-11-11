'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, ChevronRight, CheckCircle, MessageSquare } from 'lucide-react'

// ── Option button ──────────────────────────────────────────────────────────────

function Option({
  label, value, selected, onSelect,
}: { label: string; value: string; selected: boolean; onSelect: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`flex-1 min-w-0 text-sm font-semibold py-3 px-2 rounded-2xl border-2 transition-all active:scale-95 text-center leading-tight ${
        selected
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200/60'
          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
      }`}
    >
      {label}
    </button>
  )
}

// ── Star rating ────────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-2 justify-center py-2" dir="ltr">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-1 transition-transform active:scale-110"
          aria-label={`${n} כוכבים`}
        >
          <Star
            size={36}
            className={`transition-colors ${(hover || value) >= n ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{emoji}</span>
        <h2 className="font-black text-slate-800 text-base">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const router = useRouter()

  const [loginEase,       setLoginEase]       = useState(0)
  const [vehiclesOk,      setVehiclesOk]      = useState('')
  const [historyOk,       setHistoryOk]       = useState('')
  const [quotesTried,     setQuotesTried]     = useState('')
  const [bookingTried,    setBookingTried]    = useState('')
  const [wouldRecommend,  setWouldRecommend]  = useState('')
  const [bestFeature,     setBestFeature]     = useState('')
  const [improvement,     setImprovement]     = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const canSubmit = loginEase > 0 && vehiclesOk && historyOk && quotesTried && bookingTried && wouldRecommend

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/portal/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ loginEase, vehiclesOk, historyOk, quotesTried, bookingTried, wouldRecommend, bestFeature, improvement }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `HTTP ${r.status}`)
      }
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בשמירת המשוב')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Thank you screen ───────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 pb-8 flex flex-col items-center text-center" dir="rtl">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">תודה על המשוב!</h1>
        <p className="text-slate-500 text-base mb-8 leading-relaxed">
          הפניות שלך חשובות לנו ויעזרו לנו לשפר את השירות.
        </p>
        <button
          onClick={() => router.push('/portal')}
          className="bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-indigo-200/60 active:scale-95 transition-transform flex items-center gap-2"
        >
          <ChevronRight size={18} />
          חזרה לדף הבית
        </button>
      </div>
    )
  }

  // ── Feedback form ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-4" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center shrink-0">
          <MessageSquare size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800">משוב על הפורטל</h1>
          <p className="text-slate-500 text-sm">כמה שאלות קצרות — יקח דקה</p>
        </div>
      </div>

      {/* 1. Login ease */}
      <Section emoji="🔑" title="כניסה למערכת">
        <p className="text-slate-600 text-sm">עד כמה הכניסה עם SMS הייתה קלה ונוחה?</p>
        <StarRating value={loginEase} onChange={setLoginEase} />
        {loginEase > 0 && (
          <p className="text-center text-xs text-slate-400 -mt-1">
            {loginEase === 1 ? 'קשה מאוד' : loginEase === 2 ? 'קשה' : loginEase === 3 ? 'בסדר' : loginEase === 4 ? 'קל' : 'קל מאוד'}
          </p>
        )}
      </Section>

      {/* 2. Vehicles */}
      <Section emoji="🚗" title="הרכבים שלי">
        <p className="text-slate-600 text-sm">ראית את הרכב/ים שלך? האם הפרטים נכונים?</p>
        <div className="flex gap-2">
          <Option label="כן, הכל נכון"   value="yes"      selected={vehiclesOk === 'yes'}      onSelect={setVehiclesOk} />
          <Option label="חלקית"           value="partial"  selected={vehiclesOk === 'partial'}  onSelect={setVehiclesOk} />
          <Option label="לא"              value="no"       selected={vehiclesOk === 'no'}       onSelect={setVehiclesOk} />
          <Option label="לא בטוח/ה"       value="not_sure" selected={vehiclesOk === 'not_sure'} onSelect={setVehiclesOk} />
        </div>
      </Section>

      {/* 3. Service history */}
      <Section emoji="📋" title="היסטוריית שירות">
        <p className="text-slate-600 text-sm">ראית את היסטוריית הטיפולים של הרכב/ים שלך? האם הנתונים מדויקים?</p>
        <div className="flex gap-2">
          <Option label="כן, מדויק"  value="yes"      selected={historyOk === 'yes'}      onSelect={setHistoryOk} />
          <Option label="חלקית"      value="partial"  selected={historyOk === 'partial'}  onSelect={setHistoryOk} />
          <Option label="לא"         value="no"       selected={historyOk === 'no'}       onSelect={setHistoryOk} />
          <Option label="לא בטוח/ה"  value="not_sure" selected={historyOk === 'not_sure'} onSelect={setHistoryOk} />
        </div>
      </Section>

      {/* 4. Quotes */}
      <Section emoji="💰" title="הצעת מחיר">
        <p className="text-slate-600 text-sm">ניסית לבקש הצעת מחיר?</p>
        <div className="flex gap-2">
          <Option label="כן — ברור"      value="yes_clear"   selected={quotesTried === 'yes_clear'}   onSelect={setQuotesTried} />
          <Option label="כן — לא ברור"   value="yes_unclear" selected={quotesTried === 'yes_unclear'} onSelect={setQuotesTried} />
          <Option label="לא ניסיתי"      value="not_tried"   selected={quotesTried === 'not_tried'}   onSelect={setQuotesTried} />
        </div>
      </Section>

      {/* 5. Booking */}
      <Section emoji="📅" title="קביעת תור">
        <p className="text-slate-600 text-sm">ניסית לקבוע תור?</p>
        <div className="flex gap-2">
          <Option label="כן — נוח"    value="yes_easy"  selected={bookingTried === 'yes_easy'}  onSelect={setBookingTried} />
          <Option label="כן — לא נוח" value="yes_hard"  selected={bookingTried === 'yes_hard'}  onSelect={setBookingTried} />
          <Option label="לא ניסיתי"   value="not_tried" selected={bookingTried === 'not_tried'} onSelect={setBookingTried} />
        </div>
      </Section>

      {/* 6. Recommend */}
      <Section emoji="👍" title="המלצה">
        <p className="text-slate-600 text-sm">האם תמליץ לחבר להשתמש במערכת?</p>
        <div className="flex gap-2">
          <Option label="בהחלט כן" value="yes"   selected={wouldRecommend === 'yes'}   onSelect={setWouldRecommend} />
          <Option label="אולי"     value="maybe" selected={wouldRecommend === 'maybe'} onSelect={setWouldRecommend} />
          <Option label="לא"       value="no"    selected={wouldRecommend === 'no'}    onSelect={setWouldRecommend} />
        </div>
      </Section>

      {/* 7. Free text */}
      <Section emoji="💬" title="בחופשיות">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">מה הדבר הטוב ביותר במערכת?</label>
            <textarea
              value={bestFeature}
              onChange={e => setBestFeature(e.target.value)}
              placeholder="לא חובה — כתוב/י בחופשיות"
              rows={2}
              maxLength={500}
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1.5">מה היית משפר/ת?</label>
            <textarea
              value={improvement}
              onChange={e => setImprovement(e.target.value)}
              placeholder="לא חובה — ספר/י לנו"
              rows={2}
              maxLength={500}
              className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>
        </div>
      </Section>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit || submitting}
        className={`w-full py-4 rounded-2xl font-black text-base transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 ${
          canSubmit && !submitting
            ? 'bg-gradient-to-l from-indigo-600 to-indigo-500 text-white shadow-indigo-200/60'
            : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
        }`}
      >
        {submitting ? (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {submitting ? 'שומר...' : 'שלח משוב'}
      </button>

      {!canSubmit && (
        <p className="text-center text-xs text-slate-400">יש לענות על כל השאלות לפני השליחה</p>
      )}
    </div>
  )
}
