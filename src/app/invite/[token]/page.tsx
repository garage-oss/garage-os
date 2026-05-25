import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AcceptInviteButton } from '@/components/settings/AcceptInviteButton'
import { Wrench, Clock, UserCheck, AlertCircle } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/org'

interface Props { params: { token: string } }

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: Props) {
  const session = await getServerSession(authOptions)

  const invitation = await prisma.invitation.findUnique({
    where: { token: params.token },
    include: { organization: { select: { name: true } } },
  })

  if (!invitation) {
    return <InviteError message="הזמנה לא נמצאה או כבר בוטלה" />
  }

  if (invitation.acceptedAt) {
    return <InviteError message="הזמנה זו כבר הייתה בשימוש" />
  }

  if (invitation.expiresAt < new Date()) {
    return <InviteError message="תוקף ההזמנה פג. בקש הזמנה חדשה." />
  }

  const isLoggedIn = !!session?.user
  const isCorrectUser = session?.user?.email?.toLowerCase() === invitation.email.toLowerCase()

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#6366f1] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Wrench size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black">הזמנה ל-GarageOS</h1>
        </div>

        <div className="bg-[#1a1d27] border border-[#2e3147] rounded-2xl p-8">
          {/* Invite details */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-[#6366f1]/15 flex items-center justify-center mx-auto mb-3">
              <UserCheck size={22} className="text-[#6366f1]" />
            </div>
            <p className="text-[#8892a4] text-sm">הוזמנת להצטרף ל</p>
            <p className="text-xl font-bold mt-1">{invitation.organization.name}</p>
            <div className="mt-2">
              <span className="text-xs bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/25 px-3 py-1 rounded-full font-semibold">
                {ROLE_LABELS[invitation.role]}
              </span>
            </div>
          </div>

          {/* Expiry */}
          <div className="flex items-center gap-2 text-xs text-[#8892a4] bg-[#0f1117] rounded-lg px-3 py-2.5 mb-6">
            <Clock size={12} />
            <span>ההזמנה תפוג ב-{new Date(invitation.expiresAt).toLocaleDateString('he-IL')}</span>
          </div>

          {/* CTA */}
          {!isLoggedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-[#8892a4] text-center">
                ההזמנה מיועדת לכתובת <strong className="text-[#e2e8f0]">{invitation.email}</strong>
              </p>
              <a
                href={`/login?callbackUrl=/invite/${params.token}`}
                className="w-full flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white font-semibold rounded-lg px-4 py-3 transition-colors"
              >
                התחבר לאישור
              </a>
              <p className="text-xs text-center text-[#8892a4]">
                אין לך חשבון? <a href="/login" className="text-[#6366f1] hover:underline">הרשמה</a>
              </p>
            </div>
          ) : !isCorrectUser ? (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg p-4 text-sm text-center">
              <p>מחובר כ-{session.user.email}</p>
              <p className="mt-1 text-xs">ההזמנה מיועדת ל-{invitation.email}. התנתק והתחבר עם החשבון הנכון.</p>
            </div>
          ) : (
            <AcceptInviteButton token={params.token} />
          )}
        </div>
      </div>
    </div>
  )
}

function InviteError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#e2e8f0] flex items-center justify-center p-4" dir="rtl">
      <div className="text-center">
        <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">הזמנה לא תקפה</h1>
        <p className="text-[#8892a4]">{message}</p>
      </div>
    </div>
  )
}
