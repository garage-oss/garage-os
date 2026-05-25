import { requireOrg, PLAN_LABELS, PLAN_COLORS } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Users, CreditCard, Building2, Check, Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    key: 'FREE' as const,
    name: 'חינמי',
    price: '₪0',
    period: 'לחודש',
    features: ['3 משתמשים', '50 לקוחות', '200 פקודות עבודה', 'כל המודולים', 'תמיכה בסיסית'],
  },
  {
    key: 'PRO' as const,
    name: 'Pro',
    price: '₪299',
    period: 'לחודש',
    features: ['15 משתמשים', 'לקוחות ופקודות ללא הגבלה', 'דף שיתוף ממותג', 'אבחון AI מתקדם', 'תמיכה מועדפת'],
    highlight: true,
  },
  {
    key: 'ENTERPRISE' as const,
    name: 'Enterprise',
    price: 'צור קשר',
    period: '',
    features: ['משתמשים ללא הגבלה', 'כל תכונות Pro', 'API גישה', 'אינטגרציות מותאמות', 'מנהל חשבון ייעודי'],
  },
]

export default async function BillingPage() {
  const { orgId } = await requireOrg()

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true, planExpiry: true },
  })

  const currentPlan = org?.plan ?? 'FREE'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-[#8892a4] mt-0.5">ניהול פרופיל המוסך והצוות</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { href: '/dashboard/settings', label: 'פרופיל', icon: Building2 },
          { href: '/dashboard/settings/team', label: 'צוות', icon: Users },
          { href: '/dashboard/settings/billing', label: 'תכנית', icon: CreditCard, active: true },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
              active
                ? 'bg-[#6366f1]/10 border-[#6366f1]/30 text-[#6366f1]'
                : 'bg-[#1a1d27] border-[#2e3147] text-[#8892a4] hover:text-[#e2e8f0] hover:bg-[#252836]'
            }`}>
            <Icon size={15} />{label}
          </Link>
        ))}
      </div>

      {/* Current plan banner */}
      <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#8892a4] mb-1">תכנית נוכחית</div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{PLAN_LABELS[currentPlan]}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[currentPlan]}`}>
                {PLAN_LABELS[currentPlan]}
              </span>
            </div>
          </div>
          {currentPlan === 'FREE' && (
            <div className="flex items-center gap-2 text-amber-400">
              <Zap size={16} />
              <span className="text-sm font-semibold">שדרג לPro</span>
            </div>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="space-y-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan
          return (
            <div
              key={plan.key}
              className={`bg-[#1a1d27] border rounded-xl p-5 ${
                plan.highlight ? 'border-[#6366f1]/40' : 'border-[#2e3147]'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{plan.name}</span>
                    {plan.highlight && (
                      <span className="text-xs bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/25 px-2 py-0.5 rounded-full font-semibold">
                        מומלץ
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-semibold">
                        תכנית נוכחית
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black mt-1">
                    {plan.price}
                    {plan.period && <span className="text-sm font-normal text-[#8892a4] ms-1">{plan.period}</span>}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    disabled
                    className="text-sm font-medium px-4 py-2 rounded-lg bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/25 opacity-60 cursor-not-allowed"
                    title="בקרוב"
                  >
                    {plan.key === 'ENTERPRISE' ? 'צור קשר' : 'שדרג'}
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-[#8892a4]">
                    <Check size={13} className="text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-[#8892a4] mt-6">
        שדרוג תוכניות יהיה זמין בקרוב · לפרטים: support@garageos.co.il
      </p>
    </div>
  )
}
