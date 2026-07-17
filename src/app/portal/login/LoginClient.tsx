'use client'

import { useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, Car, Phone } from 'lucide-react'

interface Props { testMode?: boolean }

export function PortalLoginContent({ testMode }: Props) {
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
              <p className="text-slate-500 text-sm mb-4">קוד חד-פעמי יישלח ל-SMS</p>

              {/* Test mode hint */}
              {testMode && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 text-center" dir="ltr">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">⚠️ TEST MODE</p>
                  <p className="text-xs text-amber-800">
                    Phone: <span className="font-mono font-black">0500000000</span>
                    &nbsp;·&nbsp; OTP: <span className="font-mono font-black">123456</span>
                  </p>
                </div>
              )}

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
                    placeholder={testMode ? '0500000000' : '05X-XXXXXXX'}
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
                  <p className="text-xs text-amber-700 mb-1">
                    {testMode ? '⚠️ TEST MODE — קוד הבדיקה:' : 'מצב פיתוח — הקוד הוא:'}
                  </p>
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
