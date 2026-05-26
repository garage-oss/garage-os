import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOrgContext } from '@/lib/org'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const org = await getOrgContext()
  if (!org) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar
        orgName={org.orgName}
        orgPlan={org.orgPlan}
        memberRole={org.memberRole}
        userName={session.user?.name ?? undefined}
        userEmail={session.user?.email ?? undefined}
      />
      <div className="flex-1 flex flex-col ms-[220px] min-w-0">
        <TopBar user={{ ...session.user, id: (session.user as { id?: string }).id }} />
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}
