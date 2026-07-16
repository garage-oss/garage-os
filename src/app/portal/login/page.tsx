'use client'

import { useState, useRef, Suspense }   from 'react'
import { useSearchParams, useRouter }   from 'next/navigation'
import { Loader2, Car, Phone }          from 'lucide-react'

function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.305A9.956 9.956 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.946 7.946 0 0 1-4.054-1.107l-.29-.173-3.005.787.803-2.926-.19-.3A7.952 7.952 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
    </svg>
  )
}

function PortalLoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const urlError     = searchParams.get('error')

  const [phone,    setPhone]    = useState('')
  const [digits,   setDigits]   = useState(['', '', '', '', '', ''])
  const [screen,   setScreen]   = useState<'phone' | 'otp'>('phone')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [demoCode, setDemoCode] = useState<string | null>(null)

  const digitRefs = useRef<(HTMLInputElement | null)[]>([])

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const r    = await fetch('/api/portal/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error ?? 'שגיאה'); return }
      setDemoCode(data.demo ?? null)
      setScreen('otp')
      setTimeout(() => digitRefs.current[0]?.focus(), 120)
    } catch { setError('שגיאת חיבור — נסה שוב') }
    finally  { setLoading(false) }
  }

  function handleDigit(i: number, raw: string) {
    const char = raw.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]; next[i] = char; setDigits(next)
    if (char && i < 5) digitRefs.current[i + 1]?.focus()
    if (next.every(d => d)) submitOtp(next.join(''))
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ''; setDigits(next)
      digitRefs.current[i - 1]?.focus()
    }
  }

  async function submitOtp(code: string) {
    setLoading(true); setError(null)
    try {
      const r    = await fetch('/api/portal/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'קוד שגוי')
        setDigits(['', '', '', '', '', ''])
        setTimeout(() => digitRefs.current[0]?.focus(), 80)
        return
      }
      router.push('/portal')
      router.refresh()
    } catch { setError('שגיאת חיבור — נסה שוב') }
    finally  { setLoading(false) }
  }

  async function resend() {
    setDigits(['', '', '', '', '', ''])
    setError(null)
    await sendOtp({ preventDefault: () => {} } as React.FormEvent)
    setTimeout(() => digitRefs.current[0]?.focus(), 120)
  }

  const phoneDigits = phone.replace(/[^0-9]/g, '')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 flex flex-col items-center justify-center px-5 py-10" dir="rtl">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/60 mb-3">
            <Car size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800">פורטל לקוחות</h1>
          <p className="text-slate-500 text-sm mt-1">שירות מהיר ישירות מהטלפון</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">

          {/* ── Screen 1: phone ── */}
          {screen === 'phone' && (
            <>
              <h2 className="font-bold text-slate-800 text-lg mb-0.5">כניסה</h2>
              <p className="text-slate-500 text-sm mb-5">קוד חד-פעמי יישלח ל-SMS</p>

              {(error ?? urlError) && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100 mb-4">
                  {error ?? (urlError === 'session-expired' ? 'פג תוקף החיבור — כנס/י מחדש' : 'שגיאה')}
                </div>
              )}

              <form onSubmit={sendOtp} className="space-y-3">
                <div className="relative">
                  <Phone size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-4 text-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || phoneDigits.length < 9}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-black text-lg py-4 rounded-xl shadow-md shadow-indigo-200/60 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 size={22} className="animate-spin mx-auto" /> : 'שלחו לי קוד'}
                </button>
              </form>
            </>
          )}

          {/* ── Screen 2: OTP ── */}
          {screen === 'otp' && (
            <>
              <button onClick={() => { setScreen('phone'); setError(null) }} className="text-indigo-600 text-sm mb-4 hover:underline">
                ← חזרה
              </button>
              <h2 className="font-bold text-slate-800 text-lg mb-0.5">הכנס/י את הקוד</h2>
              <p className="text-slate-500 text-sm mb-5">
                שלחנו קוד SMS ל-<span dir="ltr" className="font-mono">{phone}</span>
              </p>

              {demoCode && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center mb-5">
                  <p className="text-xs text-amber-700 mb-1">מצב פיתוח — הקוד הוא:</p>
                  <p className="font-mono text-3xl font-black text-amber-800 tracking-[0.25em]">{demoCode}</p>
                </div>
              )}

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100 mb-4 text-center">
                  {error}
                </div>
              )}

              {/* 6-digit boxes */}
              <div className="flex gap-2 justify-center mb-5" dir="ltr">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { digitRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKey(i, e)}
                    className="w-11 h-14 text-center text-2xl font-black border-2 rounded-xl focus:outline-none transition-colors bg-slate-50 focus:bg-white"
                    style={{ borderColor: d ? '#6366f1' : '#e2e8f0' }}
                  />
                ))}
              </div>

              {loading && (
                <div className="flex justify-center mb-4">
                  <Loader2 size={24} className="animate-spin text-indigo-400" />
                </div>
              )}

              <button onClick={resend} className="w-full text-slate-400 text-sm py-1 hover:text-indigo-600 transition-colors">
                לא קיבלתי קוד — שלח שוב
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">הפורטל מיועד ללקוחות הרשומים במוסך בלבד</p>
      </div>
    </div>
  )
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>}>
      <PortalLoginContent />
    </Suspense>
  )
}
