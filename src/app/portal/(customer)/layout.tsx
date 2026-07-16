import { requireCustomerSession } from '@/lib/customer-auth'
import { prisma }                 from '@/lib/prisma'
import { CustomerPortalNav }      from '@/components/portal/CustomerPortalNav'

export default async function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCustomerSession()

  const org = await prisma.organization.findUnique({
    where:  { id: ctx.organizationId },
    select: { name: true, phone: true, logoUrl: true },
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 font-sans" dir="rtl">
      <div className="pb-36">
        {children}
      </div>
      <CustomerPortalNav orgName={org?.name ?? 'מוסך'} orgPhone={org?.phone ?? null} />
    </div>
  )
}
