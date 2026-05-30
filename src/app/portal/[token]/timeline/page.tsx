import { getPortalData, STATUS_CONFIG, type WOStatus } from '@/lib/portal'

export const dynamic = 'force-dynamic'

interface TimelineEvent {
  icon:      string
  title:     string
  body:      string
  time?:     Date | null
  active:    boolean
  done:      boolean
  highlight: boolean
}

function buildTimeline(wo: Awaited<ReturnType<typeof getPortalData>>): TimelineEvent[] {
  const status = wo.status as WOStatus
  const step   = STATUS_CONFIG[status].step

  // Fixed structural events
  const structural: TimelineEvent[] = [
    {
      icon:      '🚗',
      title:     'הרכב התקבל במוסך',
      body:      wo.complaint ?? 'הרכב נכנס לטיפול',
      time:      wo.receivedAt ?? wo.createdAt,
      active:    step >= 1,
      done:      step > 1,
      highlight: step === 1,
    },
    {
      icon:      '🔍',
      title:     'בדיקה ואבחון',
      body:      wo.diagnosis ?? 'הטכנאי בודק את הרכב',
      // Only show a real timestamp if diagnosis is actually done (step > 2)
      time:      step > 2 ? wo.updatedAt : null,
      active:    step >= 2,
      done:      step > 2,
      highlight: step === 2,
    },
  ]

  // Tech notes sorted chronologically — inserted after reception event
  const techNoteEvents: TimelineEvent[] = [...wo.techNotes]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(note => ({
      icon:      '💬',
      title:     `עדכון מ${note.authorName ? ` ${note.authorName}` : 'הטכנאי'}`,
      body:      note.content,
      time:      note.createdAt,
      active:    true,
      done:      true,
      highlight: false,
    }))

  const repair: TimelineEvent = {
    icon:      '🔧',
    title:     'ביצוע התיקון',
    body:      'הטכנאי מבצע את העבודה',
    // Only show timestamp when repair is genuinely done
    time:      step >= 4 ? wo.completedAt ?? wo.updatedAt : null,
    active:    step >= 3,
    done:      step >= 4,
    highlight: step === 3,
  }

  const ready: TimelineEvent = {
    icon:      '✅',
    title:     'מוכן לאיסוף!',
    body:      status === 'COMPLETED' ? 'הרכב מוכן ומחכה לך 🎉' : 'נעדכן אותך כשהרכב יהיה מוכן',
    time:      wo.completedAt,
    active:    step >= 4,
    done:      step >= 4,
    highlight: step === 4,
  }

  const events: TimelineEvent[] = [
    ...structural,
    ...techNoteEvents,
  ]

  if (status === 'WAITING_PARTS') {
    events.push({
      icon:      '📦',
      title:     'ממתין לחלקים',
      body:      'הוזמנו חלקים — נמשיך ברגע שיגיעו',
      time:      wo.updatedAt,
      active:    true,
      done:      false,
      highlight: true,
    })
  }

  events.push(repair, ready)

  return events
}

const COLOR_PILL: Record<string, string> = {
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  indigo:  'bg-indigo-50  border-indigo-200  text-indigo-700',
  amber:   'bg-amber-50   border-amber-200   text-amber-700',
  orange:  'bg-orange-50  border-orange-200  text-orange-700',
  red:     'bg-red-50     border-red-200     text-red-700',
}
const COLOR_DOT: Record<string, string> = {
  emerald: 'bg-emerald-500',
  indigo:  'bg-indigo-500',
  amber:   'bg-amber-500',
  orange:  'bg-orange-500',
  red:     'bg-red-500',
}

export default async function TimelinePage({ params }: { params: { token: string } }) {
  const wo     = await getPortalData(params.token)
  const status = wo.status as WOStatus
  const st     = STATUS_CONFIG[status]
  const events = buildTimeline(wo)
  const isLive = status !== 'COMPLETED' && status !== 'CANCELLED'

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">מצב הטיפול</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Current status — full-width banner, not just inline pill */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border font-semibold ${COLOR_PILL[st.color] ?? COLOR_PILL.indigo}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLOR_DOT[st.color] ?? COLOR_DOT.indigo} ${isLive ? 'animate-pulse' : ''}`} />
        <div className="flex-1">
          <p className="font-bold text-base leading-tight">{st.label}</p>
          <p className="text-sm opacity-70 font-normal mt-0.5">{st.description}</p>
        </div>
        {wo.completedAt && (
          <p className="text-xs opacity-60 font-normal shrink-0">
            {new Date(wo.completedAt).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
          </p>
        )}
      </div>

      {/* Vertical timeline — NO duplicate stepper here */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">ציר זמן</p>
        <div className="space-y-0">
          {events.map((ev, i) => (
            <div key={i} className="flex gap-4 relative">
              {/* Connector line */}
              {i < events.length - 1 && (
                <div className="absolute top-10 bottom-0 w-0.5 right-[19px]">
                  <div className={`h-full rounded-full ${ev.done ? 'bg-indigo-200' : 'bg-slate-100'}`} />
                </div>
              )}

              {/* Icon bubble */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg z-10
                ${ev.highlight ? 'ring-4 ring-indigo-100 bg-indigo-600 shadow-md shadow-indigo-200' :
                  ev.done      ? 'bg-indigo-100' :
                  ev.active    ? 'bg-indigo-50 border-2 border-indigo-200' :
                                 'bg-slate-100 border-2 border-slate-200'
                }
              `}>
                {ev.done && !ev.highlight ? (
                  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={ev.active ? '' : 'grayscale opacity-40'}>{ev.icon}</span>
                )}
              </div>

              {/* Content */}
              <div className={`pb-6 flex-1 ${!ev.active ? 'opacity-35' : ''}`}>
                <p className={`font-semibold text-sm leading-tight ${ev.highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {ev.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.body}</p>
                {ev.time && (
                  <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                    {new Date(ev.time).toLocaleDateString('he-IL', {
                      day: '2-digit', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live update note */}
      {isLive && (
        <p className="text-center text-xs text-slate-400">
          הסטטוס מתעדכן בזמן אמת · רענן לראות שינויים
        </p>
      )}

    </div>
  )
}
