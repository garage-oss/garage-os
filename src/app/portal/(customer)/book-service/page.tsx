import { Suspense }             from 'react'
import { Loader2 }              from 'lucide-react'
import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { BookServiceFlow }        from '@/components/portal/BookServiceFlow'

export const dynamic = 'force-dynamic'

export default async function BookServicePage() {
  const ctx = await requireCustomerSession()

  const vehicles = await prisma.vehicle.findMany({
    where:   { customerId: ctx.customerId, organizationId: ctx.organizationId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, plate: true, make: true, model: true, year: true, mileage: true },
  })

  return (
    <div className="max-w-lg mx-auto" dir="rtl">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-black text-slate-800">קביעת טיפול</h1>
        <p className="text-slate-500 text-sm mt-1">קבל/י הצעת מחיר ותאם/י תור תוך דקות</p>
      </div>
      <Suspense fallback={<div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>}>
        <BookServiceFlow initialVehicles={vehicles} />
      </Suspense>
    </div>
  )
}
