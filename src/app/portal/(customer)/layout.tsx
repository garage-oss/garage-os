import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { CustomerPortalNav }      from '@/components/portal/CustomerPortalNav'

export default async function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx      = await requireCustomerSession()
  const testMode = process.env.CUSTOMER_PORTAL_TEST_MODE === 'true'

  const org = await prisma.organization.findUnique({
    where:  { id: ctx.organizationId },
    select: { name: true, phone: true, logoUrl: true },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 font-sans" dir="rtl">
      {testMode && (
        <div className="w-full bg-amber-400 text-amber-900 text-center text-xs font-bold py-2 tracking-wide select-none">
          ⚠️ TEST MODE — SMS is simulated &nbsp;·&nbsp; Phone: 0500000000 &nbsp;·&nbsp; OTP: 123456
        </div>
      )}
      <div className="pb-36">
        {children}
      </div>
      <CustomerPortalNav orgName={org?.name ?? 'מוסך'} orgPhone={org?.phone ?? null} />
    </div>
  )
}
