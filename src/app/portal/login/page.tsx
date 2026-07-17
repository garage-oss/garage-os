import { Suspense } from 'react'
import { Loader2 }  from 'lucide-react'
import { PortalLoginContent } from './LoginClient'

export default async function PortalLoginPage() {
  const testMode = process.env.CUSTOMER_PORTAL_TEST_MODE === 'true'

  return (
    <>
      {testMode && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-amber-400 text-amber-900 text-center text-xs font-bold py-2 tracking-wide">
          ⚠️ TEST MODE — SMS is simulated &nbsp;·&nbsp; Phone: 0500000000 &nbsp;·&nbsp; OTP: 123456
        </div>
      )}
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-indigo-400" />
        </div>
      }>
        <PortalLoginContent testMode={testMode} />
      </Suspense>
    </>
  )
}
