import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import Link from 'next/link'
import { Wrench, Home } from 'lucide-react'

export const metadata = { title: 'GarageOS Mobile', description: 'Technician mobile view' }

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const org = await getOrgContext()
  if (!org) redirect('/onboarding')

  return (
    <html lang="he" dir="rtl">
      <body className="bg-[#0f1117] text-white min-h-screen font-sans antialiased">
        {/* Top nav bar */}
        <header className="sticky top-0 z-50 flex items-center justify-between bg-[#0f1117]/95 backdrop-blur border-b border-[#2e3147] px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#6366f1] rounded-lg flex items-center justify-center">
              <Wrench size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm truncate max-w-[160px]">{org.orgName}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/mobile/jobs" className="text-xs text-[#8892a4] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1a1d27] transition-colors">
              משימות
            </Link>
            <Link href="/dashboard" className="text-xs text-[#8892a4] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#1a1d27] transition-colors flex items-center gap-1">
              <Home size={13} />
              דשבורד
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-lg mx-auto px-4 pb-20 pt-4">
          {children}
        </main>
      </body>
    </html>
  )
}
