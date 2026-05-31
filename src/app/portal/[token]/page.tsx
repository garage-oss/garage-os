import Link from 'next/link'
import { getPortalData, STATUS_CONFIG, type WOStatus } from '@/lib/portal'
import { StatusStepper } from '@/components/portal/StatusStepper'
import { formatCurrency, toNum } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const FUEL_HE: Record<string, string> = {
  GASOLINE: 'בנזין', DIESEL: 'דיזל', HYBRID: 'היברידי',
  ELECTRIC: 'חשמלי', LPG: 'גז',
}

// Progress % per status
const STATUS_PROGRESS: Record<string, number> = {
  PENDING: 15, IN_PROGRESS: 55, WAITING_PARTS: 75, COMPLETED: 100, CANCELLED: 0,
}

// Tailwind color maps — static strings so the scanner picks them up
const STATUS_BG: Record<string, string> = {
  amber:   'bg-amber-50   border-amber-200   text-amber-700',
  indigo:  'bg-indigo-50  border-indigo-200  text-indigo-700',
  orange:  'bg-orange-50  border-orange-200  text-orange-700',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  red:     'bg-red-50     border-red-200     text-red-700',
}
const STATUS_DOT: Record<string, string> = {
  amber:   'bg-amber-500',
  indigo:  'bg-indigo-500',
  orange:  'bg-orange-500',
  emerald: 'bg-emerald-500',
  red:     'bg-red-500',
}
const STATUS_BAR: Record<string, string> = {
  amber:   'bg-amber-400',
  indigo:  'bg-indigo-500',
  orange:  'bg-orange-400',
  emerald: 'bg-emerald-500',
  red:     'bg-red-400',
}
const STATUS_LABEL: Record<string, string> = {
  amber:   'text-amber-700',
  indigo:  'text-indigo-700',
  orange:  'text-orange-700',
  emerald: 'text-emerald-700',
  red:     'text-red-700',
}

// ── Car silhouette SVG ────────────────────────────────────────────────────────
function CarSilhouette() {
  return (
    <svg
      viewBox="0 0 420 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-h-32 pointer-events-none select-none"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      {/* Main body */}
      <path
        d="M36 112 L36 84 Q40 70 56 60 L94 42 Q116 32 156 28 L260 28 Q296 28 318 46 L360 82 L372 102 L374 112 Z"
        fill="white" fillOpacity="0.13"
      />
      {/* Roof */}
      <path
        d="M94 42 Q116 32 156 28 L260 28 Q294 28 314 42 L314 62 L94 62 Z"
        fill="white" fillOpacity="0.07"
      />
      {/* Windshield */}
      <path
        d="M94 62 L94 44 L130 34 Q148 28 170 28 L220 28 L220 62 Z"
        fill="white" fillOpacity="0.07"
      />
      {/* Rear side window */}
      <rect x="224" y="28" width="86" height="34" rx="3" fill="white" fillOpacity="0.07" />
      {/* Pillar lines */}
      <line x1="220" y1="28" x2="220" y2="62" stroke="white" strokeOpacity="0.12" strokeWidth="2" />
      <line x1="312" y1="28" x2="312" y2="62" stroke="white" strokeOpacity="0.12" strokeWidth="2" />
      {/* Front wheel */}
      <circle cx="314" cy="114" r="28" fill="white" fillOpacity="0.05" />
      <circle cx="314" cy="114" r="20" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="3.5" />
      <circle cx="314" cy="114" r="8"  fill="white" fillOpacity="0.22" />
      {/* Rear wheel */}
      <circle cx="86"  cy="114" r="28" fill="white" fillOpacity="0.05" />
      <circle cx="86"  cy="114" r="20" fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="3.5" />
      <circle cx="86"  cy="114" r="8"  fill="white" fillOpacity="0.22" />
      {/* Headlight */}
      <rect x="362" y="84" width="10" height="14" rx="3" fill="white" fillOpacity="0.45" />
      {/* Tail light */}
      <rect x="33"  y="78" width="5"  height="22" rx="2" fill="white" fillOpacity="0.25" />
      {/* Ground shadow line */}
      <line x1="28" y1="136" x2="392" y2="136" stroke="white" strokeOpacity="0.06" strokeWidth="1" />
      {/* Grille slats */}
      <line x1="368" y1="72" x2="372" y2="92" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
      <line x1="373" y1="72" x2="377" y2="92" stroke="white" strokeOpacity="0.10" strokeWidth="1.5" />
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function PortalHomePage({ params }: { params: { token: string } }) {
  const wo  = await getPortalData(params.token)
  const st  = STATUS_CONFIG[wo.status as WOStatus]
  const v   = wo.vehicle
  const org = wo.organization

  const pendingQuote     = wo.quote?.status === 'SENT'
  const unpaidPayment    = wo.paymentLinks[0] && !wo.paymentLinks[0].paidAt
  const customerNotes    = wo.techNotes
  const totalPrice       = toNum(wo.totalPrice)
  const qr               = wo.quoteRequest ?? null
  const hasActiveRequest = !!qr && qr.status !== 'CANCELLED'
  const canRequestQuote  = !wo.quote && !qr
  const hasViewableQuote = !!(wo.quote && wo.quote.status !== 'DRAFT')

  const isActive  = wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED'
  const progress  = STATUS_PROGRESS[wo.status] ?? 0
  const allPhotos = wo.media.filter(m => !m.mimeType.startsWith('video/'))
  const photos    = allPhotos.slice(0, 5)
  const fuelLabel = v.fuelType ? FUEL_HE[v.fuelType] ?? v.fuelType : null

  // Derive estimated completion (no DB field — estimate from receivedAt + 2 days)
  const estimatedLabel = (() => {
    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') return null
    if (!wo.receivedAt) return 'בקרוב'
    const est = new Date(wo.receivedAt)
    est.setDate(est.getDate() + 2)
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
    const estMidnight   = new Date(est); estMidnight.setHours(0, 0, 0, 0)
    if (estMidnight <= todayMidnight) return 'היום'
    return est.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
  })()

  return (
    <div className="max-w-lg mx-auto">

      {/* ════════════════════════════════════════════════════════════
          HERO — full-bleed dark gradient
      ════════════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 overflow-hidden">
        {/* Ambient radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 60% 20%, rgba(99,102,241,0.18) 0%, transparent 70%)' }}
        />

        {/* Top bar — garage identity + call CTA */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-500/25 border border-indigo-400/30 rounded-xl flex items-center justify-center">
                <span className="text-indigo-200 font-black text-sm">{org.name.charAt(0)}</span>
              </div>
            )}
            <span className="text-white/70 font-semibold text-sm">{org.name}</span>
          </div>
          {org.phone && (
            <a
              href={`tel:${org.phone}`}
              className="flex items-center gap-1.5 bg-white/10 border border-white/10 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform min-h-[36px]"
            >
              <span>📞</span>
              <span>התקשר</span>
            </a>
          )}
        </div>

        {/* Vehicle identity */}
        <div className="relative z-10 px-5 pt-6">
          <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5">
            הרכב שלך
          </p>
          <h1 className="text-[2.5rem] font-black text-white leading-none tracking-tight">
            {v.make}&nbsp;{v.model}
          </h1>
          <p className="text-indigo-300 text-sm mt-2">
            {v.year}{fuelLabel ? ` · ${fuelLabel}` : ''}{v.color ? ` · ${v.color}` : ''}
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="bg-white/10 border border-white/15 text-white font-mono font-bold text-sm px-3.5 py-1.5 rounded-xl">
              {v.plate}
            </div>
            {v.mileage && (
              <span className="text-indigo-300/80 text-sm">
                {v.mileage.toLocaleString('he-IL')}&nbsp;ק&quot;מ
              </span>
            )}
          </div>
        </div>

        {/* ── Hero CTA — big button, visible in < 3 seconds ─────── */}
        {(canRequestQuote || pendingQuote || hasActiveRequest) && (
          <div className="relative z-10 px-5 mt-5 pb-1">
            {/* Pending quote — amber */}
            {pendingQuote && (
              <Link
                href={`/portal/${params.token}/quote`}
                className="flex items-center justify-between bg-amber-400 text-slate-900 px-5 py-4 rounded-2xl shadow-lg shadow-amber-900/40 active:scale-[0.98] transition-transform min-h-[64px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center text-xl shrink-0">
                    📋
                  </div>
                  <div>
                    <p className="font-black text-base leading-tight">צפה בהצעת המחיר</p>
                    <p className="text-amber-800 text-sm mt-0.5">לחץ/י לצפייה ואישור</p>
                  </div>
                </div>
                <span className="text-2xl opacity-60">›</span>
              </Link>
            )}

            {/* Can request — indigo */}
            {canRequestQuote && (
              <Link
                href={`/portal/${params.token}/request-quote`}
                className="flex items-center justify-between bg-indigo-500 text-white px-5 py-4 rounded-2xl shadow-lg shadow-indigo-900/50 active:scale-[0.98] transition-transform min-h-[64px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">
                    📋
                  </div>
                  <div>
                    <p className="font-black text-base">בקש/י הצעת מחיר</p>
                    <p className="text-indigo-200 text-sm mt-0.5">הצעה אוטומטית תוך שניות</p>
                  </div>
                </div>
                <span className="text-2xl opacity-70">›</span>
              </Link>
            )}

            {/* Active request — ghost */}
            {hasActiveRequest && !pendingQuote && (
              <Link
                href={`/portal/${params.token}/request-quote`}
                className="flex items-center gap-3 bg-white/12 border border-white/20 text-white px-5 py-3.5 rounded-2xl active:scale-[0.98] transition-transform backdrop-blur-sm"
              >
                <span className="text-xl shrink-0">
                  {qr?.status === 'REVIEWING' ? '🔍' : '⏳'}
                </span>
                <div>
                  <p className="font-semibold text-sm">
                    {qr?.status === 'REVIEWING' ? 'הצעה בהכנה' : 'הבקשה התקבלה'}
                  </p>
                  <p className="text-indigo-300 text-xs">לחץ/י לפרטים</p>
                </div>
                <span className="mr-auto text-xl opacity-50">›</span>
              </Link>
            )}
          </div>
        )}

        {/* Car silhouette — bottom of hero */}
        <div className="relative z-0 mt-3 -mb-1">
          <CarSilhouette />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          CONTENT STACK
      ════════════════════════════════════════════════════════════ */}
      <div className="px-4 pt-3 pb-2 space-y-3">

        {/* ── STATUS CARD ─────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Coloured status banner */}
          <div className={`px-5 pt-4 pb-4 border-b ${STATUS_BG[st.color]}`}>
            <div className="flex items-center gap-2.5 mb-1">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[st.color]} ${isActive ? 'animate-pulse' : ''}`} />
              <p className={`font-black text-xl leading-tight ${STATUS_LABEL[st.color]}`}>{st.label}</p>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed ps-[1.375rem]">{st.description}</p>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="font-medium">התקדמות הטיפול</span>
                <span className="font-bold tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 bg-black/[0.07] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${STATUS_BAR[st.color]}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Dates row */}
            <div className="flex items-center justify-between mt-3">
              {wo.receivedAt && (
                <span className="text-xs text-slate-500">
                  📅&nbsp;התקבל&nbsp;
                  {new Date(wo.receivedAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                </span>
              )}
              {estimatedLabel && (
                <span className="text-xs font-bold text-slate-600">
                  ⏱&nbsp;מתוכנן:&nbsp;{estimatedLabel}
                </span>
              )}
              {wo.status === 'COMPLETED' && wo.completedAt && (
                <span className="text-xs font-bold text-emerald-700">
                  ✅&nbsp;הושלם&nbsp;
                  {new Date(wo.completedAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          </div>

          {/* Progress stepper */}
          <div className="px-5 py-5">
            <StatusStepper status={wo.status as WOStatus} />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            ACTION SECTION — primary CTAs, always visible
        ════════════════════════════════════════════════════════════ */}
        <div className="space-y-3">

          {/* ── QUOTE CARD — most visible section ─────────────────── */}
          {hasViewableQuote && wo.quote && (
            <div className={`rounded-3xl overflow-hidden shadow-xl ${
              pendingQuote ? 'shadow-amber-300/50' : 'shadow-indigo-300/30'
            }`}>
              {/* Gradient header */}
              <div className={`px-5 pt-5 pb-5 ${
                pendingQuote
                  ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600'
                  : 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700'
              }`}>
                {/* Pulse badge for pending */}
                {pendingQuote && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                    </span>
                    <span className="text-white font-black text-[11px] uppercase tracking-[0.12em]">
                      ממתינה לאישורך
                    </span>
                  </div>
                )}

                {/* Amount — headline */}
                <p className={`text-sm font-semibold mb-0.5 ${pendingQuote ? 'text-amber-100/70' : 'text-indigo-300'}`}>
                  {pendingQuote ? 'הצעת מחיר' : `הצעת מחיר ${wo.quote.quoteNumber ?? ''}`}
                </p>
                <p className="text-white font-black tabular-nums leading-none"
                  style={{ fontSize: 'clamp(2rem, 10vw, 2.75rem)' }}>
                  {formatCurrency(toNum(wo.quote.totalPrice))}
                </p>
                <p className={`text-sm mt-1.5 ${pendingQuote ? 'text-amber-100/80' : 'text-indigo-200'}`}>
                  {pendingQuote
                    ? 'ההצעה מוכנה — בדוק/י את הפרטים ואשר/י'
                    : 'לחץ/י לצפייה בפרטי ההצעה'}
                </p>
              </div>

              {/* CTA row */}
              <div className={`px-4 pb-4 pt-3 flex gap-2.5 ${
                pendingQuote
                  ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600'
                  : 'bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700'
              }`}>
                {pendingQuote ? (
                  <>
                    <Link
                      href={`/portal/${params.token}/quote`}
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-amber-700 font-black text-lg py-4 rounded-2xl shadow-lg active:scale-[0.97] transition-transform"
                    >
                      <span>✅</span>
                      <span>אשר הצעה</span>
                    </Link>
                    <Link
                      href={`/portal/${params.token}/quote`}
                      className="w-[58px] flex items-center justify-center bg-white/15 border border-white/30 text-white text-xl py-4 rounded-2xl active:scale-[0.97] transition-transform"
                    >
                      👁
                    </Link>
                  </>
                ) : (
                  <Link
                    href={`/portal/${params.token}/quote`}
                    className="flex-1 flex items-center justify-center gap-2.5 bg-white/15 border border-white/25 text-white font-bold text-base py-4 rounded-2xl active:scale-[0.97] transition-transform"
                  >
                    <span>📋</span>
                    <span>צפה בהצעת המחיר</span>
                    <span className="opacity-50">›</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── PAYMENT ───────────────────────────────────────────── */}
          {unpaidPayment && (
            <Link
              href={`/portal/${params.token}/pay`}
              className="flex items-center gap-4 w-full bg-gradient-to-l from-indigo-600 to-indigo-500 text-white px-5 py-4 rounded-3xl shadow-lg shadow-indigo-200/60 active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shrink-0">💳</div>
              <div>
                <p className="font-black text-lg leading-tight">לתשלום</p>
                <p className="text-indigo-200 text-sm tabular-nums">{formatCurrency(toNum(wo.paymentLinks[0].amount))}</p>
              </div>
              <span className="mr-auto text-2xl opacity-60">›</span>
            </Link>
          )}

          {/* ── REQUEST QUOTE ─────────────────────────────────────── */}
          {canRequestQuote && (
            <Link
              href={`/portal/${params.token}/request-quote`}
              className="flex items-center gap-4 w-full bg-gradient-to-l from-indigo-600 to-indigo-500 text-white px-5 py-5 rounded-3xl shadow-xl shadow-indigo-200/60 active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl shrink-0">📋</div>
              <div>
                <p className="font-black text-xl leading-tight">בקש הצעת מחיר</p>
                <p className="text-indigo-200 text-sm mt-0.5">הצעה אוטומטית תוך דקות</p>
              </div>
              <span className="mr-auto text-2xl opacity-60">›</span>
            </Link>
          )}

          {/* ── ACTIVE REQUEST STATUS ─────────────────────────────── */}
          {hasActiveRequest && !hasViewableQuote && qr && (
            <Link
              href={`/portal/${params.token}/request-quote`}
              className="flex items-center gap-4 bg-indigo-50 border-2 border-indigo-100 px-5 py-4 rounded-3xl active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                {qr.status === 'REVIEWING' ? '🔍' : '⏳'}
              </div>
              <div className="flex-1">
                <p className="font-bold text-indigo-800 text-base">
                  {qr.status === 'REVIEWING' ? 'הצעה בהכנה' : 'הבקשה התקבלה'}
                </p>
                <p className="text-indigo-500 text-sm mt-0.5">
                  {qr.status === 'REVIEWING'
                    ? 'הצוות מכין את הפרטים — בקרוב'
                    : 'הצעת המחיר נוצרת אוטומטית'}
                </p>
              </div>
              <span className="text-indigo-300 text-xl">›</span>
            </Link>
          )}

          {/* ── CONTACT ───────────────────────────────────────────── */}
          {org.phone && (
            <a
              href={`tel:${org.phone}`}
              className="flex items-center gap-4 w-full bg-white border-2 border-slate-100 text-slate-800 px-5 py-4 rounded-3xl shadow-sm active:scale-[0.98] transition-all hover:border-indigo-100 hover:shadow-md"
            >
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">📞</div>
              <div>
                <p className="font-black text-lg leading-tight">צור קשר עם המוסך</p>
                <p className="text-slate-500 text-sm">{org.phone}</p>
              </div>
              <span className="mr-auto text-slate-300 text-xl">›</span>
            </a>
          )}

        </div>

        {/* ── TECHNICIAN CARD ─────────────────────────────────────── */}
        {wo.assignedTechnician && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 px-4 py-4">
            <div className="flex items-center gap-3.5">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center shrink-0">
                <span className="text-indigo-700 font-black text-xl leading-none">
                  {wo.assignedTechnician.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                  הטכנאי שלך
                </p>
                <p className="font-bold text-slate-900 text-lg leading-tight truncate">
                  {wo.assignedTechnician}
                </p>
              </div>
              {org.phone && (
                <a
                  href={`tel:${org.phone}`}
                  className="shrink-0 flex items-center gap-1.5 bg-indigo-50 text-indigo-700 font-semibold text-sm px-4 py-2.5 rounded-2xl border border-indigo-100 active:scale-95 transition-transform min-h-[44px]"
                >
                  <span>📞</span>
                  <span>שאלה?</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── RECENT PHOTOS STRIP ─────────────────────────────────── */}
        {photos.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                תמונות הטיפול
              </p>
              <Link
                href={`/portal/${params.token}/media`}
                className="text-indigo-600 text-xs font-bold"
              >
                לכל התמונות ›
              </Link>
            </div>
            <div className="px-4 pb-4">
              <div
                className="flex gap-2"
                style={{ overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
              >
                {photos.map(photo => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 w-[88px] h-[88px] rounded-2xl overflow-hidden bg-slate-100 block"
                  >
                    <img
                      src={photo.url}
                      alt={photo.originalName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
                {allPhotos.length > 5 && (
                  <Link
                    href={`/portal/${params.token}/media`}
                    className="shrink-0 w-[88px] h-[88px] rounded-2xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-xl">📷</span>
                    <span className="text-indigo-600 text-xs font-black">+{allPhotos.length - 5}</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TECHNICIAN NOTES (latest 2, with connector line) ────── */}
        {customerNotes.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              עדכון מהטכנאי
            </p>
            <div className="space-y-0">
              {[...customerNotes].slice(-2).map((note, idx, arr) => (
                <div key={note.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm">
                      🔧
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="w-px flex-1 bg-slate-100 mt-1 mb-1 min-h-[20px]" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-slate-800 text-sm leading-relaxed">{note.content}</p>
                    <p className="text-xs text-slate-400 mt-1.5">
                      {new Date(note.createdAt).toLocaleDateString('he-IL', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {customerNotes.length > 2 && (
              <Link
                href={`/portal/${params.token}/timeline`}
                className="text-indigo-600 text-xs font-semibold ps-11 block"
              >
                לכל העדכונים ›
              </Link>
            )}
          </div>
        )}

        {/* ── SERVICE DETAILS ─────────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">פרטי הטיפול</p>

          {wo.complaint && (
            <div>
              <p className="text-[11px] text-slate-400 font-medium mb-1">תלונה</p>
              <p className="text-slate-800 text-sm leading-relaxed">{wo.complaint}</p>
            </div>
          )}

          {wo.diagnosis && (
            <div className={wo.complaint ? 'border-t border-slate-50 pt-3' : ''}>
              <p className="text-[11px] text-slate-400 font-medium mb-1">אבחון</p>
              <p className="text-slate-800 text-sm leading-relaxed">{wo.diagnosis}</p>
            </div>
          )}

          {wo.receivedAt && (
            <div className="flex items-center justify-between text-sm border-t border-slate-50 pt-3">
              <span className="text-slate-500">תאריך קבלה</span>
              <span className="text-slate-700">
                {new Date(wo.receivedAt).toLocaleDateString('he-IL', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </span>
            </div>
          )}

          {totalPrice > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100">
              <span className="font-bold text-slate-700">עלות משוערת</span>
              <span className="font-black text-indigo-600 text-lg tabular-nums">
                {formatCurrency(totalPrice)}
              </span>
            </div>
          )}

          <p className="text-[10px] text-slate-300 text-left tabular-nums pt-1">{wo.workOrderNumber}</p>
        </div>

        {/* ── QUICK LINKS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          <Link
            href={`/portal/${params.token}/media`}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="text-3xl">📷</span>
            <span className="text-sm font-semibold text-slate-700">תמונות ווידאו</span>
            <span className="text-xs text-slate-400">
              {wo.media.length > 0 ? `${wo.media.length} קבצים` : 'אין עדיין'}
            </span>
          </Link>
          <Link
            href={`/portal/${params.token}/history`}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <span className="text-3xl">🕓</span>
            <span className="text-sm font-semibold text-slate-700">היסטוריית שירות</span>
            <span className="text-xs text-slate-400">הצג טיפולים קודמים</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
