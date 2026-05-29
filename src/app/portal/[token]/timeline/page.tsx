import { getPortalData, STATUS_CONFIG, STEPPER_STEPS, type WOStatus } from '@/lib/portal'
import { StatusStepper } from '@/components/portal/StatusStepper'

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

  const events: TimelineEvent[] = [
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
      time:      step >= 2 ? wo.updatedAt : null,
      active:    step >= 2,
      done:      step > 2,
      highlight: step === 2,
    },
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

  events.push({
    icon:      '🔧',
    title:     'ביצוע התיקון',
    body:      'הטכנאי מבצע את העבודה',
    time:      step >= 3 ? wo.updatedAt : null,
    active:    step >= 3,
    done:      step >= 4,
    highlight: step === 3,
  })

  events.push({
    icon:      '✅',
    title:     'מוכן לאיסוף!',
    body:      status === 'COMPLETED' ? 'הרכב מוכן ומחכה לך' : 'נעדכן אותך כשהרכב יהיה מוכן',
    time:      wo.completedAt,
    active:    step >= 4,
    done:      step >= 4,
    highlight: step === 4,
  })

  // Append customer-visible tech notes as timeline events
  for (const note of wo.techNotes) {
    events.splice(2, 0, {
      icon:      '💬',
      title:     `עדכון: ${note.authorName ?? 'הטכנאי'}`,
      body:      note.content,
      time:      note.createdAt,
      active:    true,
      done:      true,
      highlight: false,
    })
  }

  return events
}

export default async function TimelinePage({ params }: { params: { token: string } }) {
  const wo     = await getPortalData(params.token)
  const status = wo.status as WOStatus
  const st     = STATUS_CONFIG[status]
  const events = buildTimeline(wo)

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">מצב הטיפול</h2>
        <p className="text-slate-500 text-sm mt-1">
          {wo.vehicle.make} {wo.vehicle.model} · {wo.vehicle.plate}
        </p>
      </div>

      {/* Current status pill */}
      <div className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm border
        ${st.color === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          st.color === 'indigo'  ? 'bg-indigo-50  border-indigo-200  text-indigo-700'  :
          st.color === 'amber'   ? 'bg-amber-50   border-amber-200   text-amber-700'   :
          st.color === 'orange'  ? 'bg-orange-50  border-orange-200  text-orange-700'  :
                                   'bg-red-50     border-red-200     text-red-700'     }
      `}>
        <span className={`w-2 h-2 rounded-full ${
          status !== 'COMPLETED' && status !== 'CANCELLED' ? 'animate-pulse' : ''
        } ${
          st.color === 'emerald' ? 'bg-emerald-500' :
          st.color === 'indigo'  ? 'bg-indigo-500'  :
          st.color === 'amber'   ? 'bg-amber-500'   :
          st.color === 'orange'  ? 'bg-orange-500'  : 'bg-red-500'
        }`} />
        {st.label}
      </div>

      {/* Wolt-style stepper */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <StatusStepper status={status} />
      </div>

      {/* Vertical timeline */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">ציר זמן</p>
        <div className="space-y-0">
          {events.map((ev, i) => (
            <div key={i} className="flex gap-4 relative">
              {/* Connector line */}
              {i < events.length - 1 && (
                <div className={`absolute right-[19px] top-10 w-0.5 bottom-0 ${
                  ev.done ? 'bg-indigo-200' : 'bg-slate-100'
                }`} />
              )}

              {/* Icon */}
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
              <div className={`pb-6 flex-1 ${!ev.active ? 'opacity-40' : ''}`}>
                <p className={`font-semibold text-sm leading-tight ${ev.highlight ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {ev.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.body}</p>
                {ev.time && (
                  <p className="text-[11px] text-slate-400 mt-1">
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

    </div>
  )
}
