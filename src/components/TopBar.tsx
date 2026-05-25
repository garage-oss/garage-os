interface TopBarProps {
  title?: string
  user?: { name?: string | null; email?: string | null }
}

export default function TopBar({ title, user }: TopBarProps) {
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').slice(0, 2)
    : '?'

  return (
    <header className="h-14 bg-surface border-b border-[#2e3147] flex items-center justify-between px-6 flex-shrink-0">
      {title && <h2 className="font-semibold text-[15px]">{title}</h2>}
      {!title && <div />}

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted hidden sm:block">{user?.name}</span>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
          {initials}
        </div>
      </div>
    </header>
  )
}
