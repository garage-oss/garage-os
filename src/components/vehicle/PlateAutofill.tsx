'use client'

/**
 * PlateAutofill
 *
 * Renders an Israeli license plate input that debounces the user's keystrokes,
 * calls /api/vehicle-lookup, and invokes onResult with the parsed vehicle data.
 *
 * Usage:
 *   <PlateAutofill
 *     value={plate}
 *     onChange={setPlate}
 *     onResult={(r) => { setMake(r.make); setModel(r.model); ... }}
 *     onClear={() => { setMake(''); setModel(''); ... }}
 *   />
 */

import { useEffect, useRef, useState } from 'react'
import { VehicleLookupResult } from '@/lib/vehicle-lookup'
import { CheckCircle, Loader2, Search, XCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlateAutofillProps = {
  value:       string
  onChange:    (plate: string) => void
  onResult:    (result: VehicleLookupResult) => void
  onClear?:    () => void
  disabled?:   boolean
  className?:  string
  /** Debounce delay in ms — default 2000 */
  debounceMs?: number
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found';    result: VehicleLookupResult }
  | { status: 'notfound' }
  | { status: 'error' }

// ─── Component ────────────────────────────────────────────────────────────────

export function PlateAutofill({
  value,
  onChange,
  onResult,
  onClear,
  disabled,
  className = '',
  debounceMs = 2000,
}: PlateAutofillProps) {
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Normalize a plate display value — strip everything except digits and add
  // dashes so the input always shows in Israeli format:
  //   7 digits → XX-XXX-XX
  //   8 digits → XXX-XX-XXX
  function formatDisplay(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length === 7) {
      // XX-XXX-XX
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    }
    // XXX-XX-XXX  (8 digits)
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Allow user to type freely; we store the raw value (with dashes)
    onChange(raw)

    // Reset lookup state
    setLookup({ status: 'idle' })
    if (timerRef.current) clearTimeout(timerRef.current)

    // Extract digits for validation
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 7) return   // not enough digits yet

    timerRef.current = setTimeout(() => {
      triggerLookup(raw)
    }, debounceMs)
  }

  async function triggerLookup(plate: string) {
    setLookup({ status: 'loading' })
    try {
      const res = await fetch(
        `/api/vehicle-lookup?plate=${encodeURIComponent(plate)}`,
      )

      if (res.status === 401) {
        setLookup({ status: 'error' })
        return
      }

      const json = await res.json()

      if (!json.found) {
        setLookup({ status: 'notfound' })
        return
      }

      setLookup({ status: 'found', result: json.vehicle })
      onResult(json.vehicle)
    } catch {
      setLookup({ status: 'error' })
    }
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClear() {
    onChange('')
    setLookup({ status: 'idle' })
    if (timerRef.current) clearTimeout(timerRef.current)
    onClear?.()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const StatusIcon = () => {
    switch (lookup.status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 text-[#6366f1] animate-spin" />
      case 'found':
        return <CheckCircle className="h-4 w-4 text-emerald-400" />
      case 'notfound':
        return <XCircle className="h-4 w-4 text-[#8892a4]" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />
      default:
        return <Search className="h-4 w-4 text-[#8892a4]" />
    }
  }

  const statusMsg = () => {
    switch (lookup.status) {
      case 'loading':   return 'מחפש רכב…'
      case 'found':     return `נמצא: ${lookup.result.make} ${lookup.result.model} ${lookup.result.year}`
      case 'notfound':  return 'לוחית לא נמצאה במרשם'
      case 'error':     return 'שגיאה בחיפוש — ניתן להמשיך ידנית'
      default:          return null
    }
  }

  const msgColor = () => {
    switch (lookup.status) {
      case 'found':    return 'text-emerald-400'
      case 'notfound': return 'text-[#8892a4]'
      case 'error':    return 'text-red-400'
      default:         return 'text-[#8892a4]'
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="000-00-000"
          dir="ltr"
          maxLength={11}   // XXX-XX-XXX = 9 chars with 2 dashes
          className={[
            'w-full rounded-lg px-3 py-2 text-sm',
            'bg-[#0d1117] border',
            lookup.status === 'found'
              ? 'border-emerald-500/60 focus:border-emerald-500'
              : lookup.status === 'error'
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-[#30363d] focus:border-[#6366f1]',
            'text-white placeholder-[#8892a4] outline-none',
            'pr-8',   // space for status icon on the left (RTL = right)
            'tracking-widest font-mono',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
        <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
          <StatusIcon />
        </div>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center text-[#8892a4] hover:text-white transition-colors"
            title="נקה"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {statusMsg() && (
        <p className={`text-xs ${msgColor()}`}>{statusMsg()}</p>
      )}
    </div>
  )
}
