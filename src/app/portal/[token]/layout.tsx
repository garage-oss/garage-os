import { getPortalData }    from '@/lib/portal'
import { PortalBottomNav } from '@/components/portal/PortalBottomNav'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params:   { token: string }
}) {
  const wo = await getPortalData(params.token)

  const hasQuote        = !!wo.quote && wo.quote.status !== 'DRAFT'
  const hasPay          = wo.paymentLinks.length > 0 && !wo.paymentLinks[0].paidAt
  const hasQuoteRequest = !!wo.quoteRequest && wo.quoteRequest.status !== 'CANCELLED'

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 font-sans"
      dir="rtl"
    >
      {/* Scrollable content — add bottom padding so nav doesn't cover content */}
      <div className="pb-24">
        {children}
      </div>

      <PortalBottomNav
        token={params.token}
        hasQuote={hasQuote}
        hasPay={hasPay}
        hasQuoteRequest={hasQuoteRequest}
      />
    </div>
  )
}
