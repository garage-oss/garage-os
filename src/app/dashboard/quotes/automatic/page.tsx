import { requireOrg } from '@/lib/org'
import { AutomaticQuoteForm } from '@/components/quotes/AutomaticQuoteForm'
import { Zap } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'הצעת מחיר אוטומטית | GarageOS' }

export default async function AutomaticQuotePage() {
  await requireOrg()

  return (
    <div dir="rtl" className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
          <Zap size={18} className="text-[#6366f1]" />
        </div>
        <div>
          <h1 className="text-xl font-bold">הצעת מחיר אוטומטית</h1>
          <p className="text-sm text-[#8892a4]">חיפוש רכב בנשר ← היסטוריה ← עריכת פריטים ← שמירה ב-GarageOS</p>
        </div>
      </div>

      <AutomaticQuoteForm />
    </div>
  )
}
