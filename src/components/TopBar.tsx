import { NotificationBell } from '@/components/notifications/NotificationBell'
import { countUnread }      from '@/lib/notifications'
import { getOrgContext }    from '@/lib/org'

interface TopBarProps {
  title?: string
  user?:  { name?: string | null; email?: string | null; id?: string }
}

export default async function TopBar({ title, user }: TopBarProps) {
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)
    : '?'

  // Fetch initial unread count server-side to avoid a flash of zero
  let initialUnread = 0
  try {
    const org = await getOrgContext()
    if (org && user?.id) {
      initialUnread = await countUnread(user.id, org.orgId)
    }
  } catch { /* non-critical */ }

  return (
    <header className="h-14 bg-surface border-b border-[#2e3147] flex items-center justify-between px-6 flex-shrink-0">
      {title
        ? <h2 className="font-semibold text-[15px]">{title}</h2>
        : <div />
      }

      <div className="flex items-center gap-2">
        {/* Notification bell (client component — polls every 30 s) */}
        <NotificationBell initialCount={initialUnread} />

        {/* User avatar */}
        <div className="flex items-center gap-2.5 ps-2 border-s border-[#2e3147]">
          <span className="text-sm text-[#8892a4] hidden sm:block">{user?.name}</span>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30
                          flex items-center justify-center text-primary text-xs font-bold
                          flex-shrink-0">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
