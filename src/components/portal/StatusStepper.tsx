import { STEPPER_STEPS, type WOStatus } from '@/lib/portal'

const STEP_FOR_STATUS: Record<WOStatus, number> = {
  PENDING:       1,
  IN_PROGRESS:   2,
  WAITING_PARTS: 3,
  COMPLETED:     4,
  CANCELLED:     0,
}

export function StatusStepper({ status }: { status: WOStatus }) {
  const activeStep = STEP_FOR_STATUS[status]
  const cancelled  = status === 'CANCELLED'

  if (cancelled) {
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="text-2xl">❌</span>
        <span className="text-sm font-semibold text-red-500">פקודה בוטלה</span>
      </div>
    )
  }

  return (
    <div className="flex items-center w-full gap-0">
      {STEPPER_STEPS.map((step, idx) => {
        const done    = step.id < activeStep
        const active  = step.id === activeStep
        const future  = step.id > activeStep
        const isLast  = idx === STEPPER_STEPS.length - 1

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={`
                  w-11 h-11 rounded-full flex items-center justify-center text-lg
                  transition-all duration-300
                  ${done   ? 'bg-indigo-600 shadow-md shadow-indigo-200'       : ''}
                  ${active ? 'bg-indigo-600 ring-4 ring-indigo-200 shadow-lg shadow-indigo-200' : ''}
                  ${future ? 'bg-slate-100 border-2 border-slate-200'          : ''}
                `}
              >
                {done ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={active ? '' : 'grayscale opacity-50'}>{step.icon}</span>
                )}
              </div>
              <span className={`text-[11px] font-semibold leading-none text-center
                ${done || active ? 'text-indigo-700' : 'text-slate-400'}
              `}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-slate-200">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500"
                  style={{ width: done ? '100%' : active ? '50%' : '0%' }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
