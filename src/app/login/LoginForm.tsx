'use client'

import { useState } from 'react'
import { signIn }   from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Zap } from 'lucide-react'

interface Props {
  demoEmail?:    string
  demoPassword?: string
}

export default function LoginForm({ demoEmail, demoPassword }: Props) {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const hasDemo = !!(demoEmail && demoPassword)

  // ── Regular submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doSignIn(email, password)
  }

  // ── Demo one-click ──────────────────────────────────────────────────────────
  async function handleDemo() {
    if (!demoEmail || !demoPassword) return
    setEmail(demoEmail)
    setPassword(demoPassword)
    await doSignIn(demoEmail, demoPassword)
  }

  async function doSignIn(em: string, pw: string) {
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { email: em, password: pw, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError('אימייל או סיסמה שגויים')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-black text-white text-xl">
            G
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">GarageOS</div>
            <div className="text-xs text-muted">מערכת ניהול מוסך</div>
          </div>
        </div>

        {/* ── Card ─────────────────────────────────────────────────────────── */}
        <div className="bg-surface border border-[#2e3147] rounded-2xl p-8 shadow-2xl space-y-6">
          <div>
            <h1 className="text-xl font-bold mb-1">כניסה למערכת</h1>
            <p className="text-sm text-muted">הזן את פרטי הכניסה שלך</p>
          </div>

          {/* Demo button — shown only when DEMO_EMAIL + DEMO_PASSWORD are set */}
          {hasDemo && (
            <button
              type="button"
              onClick={handleDemo}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-sm rounded-xl py-3 transition-colors disabled:opacity-50"
            >
              <Zap size={15} className="shrink-0" />
              <span>כניסת הדגמה</span>
              <span className="text-amber-500/60 font-normal text-xs">({demoEmail})</span>
            </button>
          )}

          {/* Divider */}
          {hasDemo && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2e3147]" />
              <span className="text-xs text-muted">או כנס עם חשבון אחר</span>
              <div className="flex-1 h-px bg-[#2e3147]" />
            </div>
          )}

          {/* Credentials form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@garage.com"
                required
                autoComplete="email"
                className="w-full bg-[#252836] border border-[#2e3147] text-text-base rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted uppercase tracking-wide">
                סיסמה
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-[#252836] border border-[#2e3147] text-text-base rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted/50"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  מתחבר...
                </>
              ) : (
                'כניסה'
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
