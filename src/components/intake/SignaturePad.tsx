'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Trash2, PenLine } from 'lucide-react'

interface Props {
  onCapture: (dataUrl: string | null) => void
  width?:    number
  height?:   number
}

export function SignaturePad({ onCapture, width = 380, height = 140 }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const drawing    = useRef(false)
  const lastPoint  = useRef<{ x: number; y: number } | null>(null)
  const [isEmpty,  setIsEmpty]  = useState(true)

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle   = '#1a1d27'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const t = e.touches[0]
      if (!t) return null
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    lastPoint.current = getPos(e)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const point = getPos(e)
    if (!point || !lastPoint.current) return

    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()

    lastPoint.current = point
    setIsEmpty(false)
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    drawing.current   = false
    lastPoint.current = null

    const canvas = canvasRef.current
    if (canvas && !isEmpty) {
      onCapture(canvas.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#1a1d27'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
    onCapture(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative border border-[#2e3147] rounded-xl overflow-hidden bg-[#1a1d27]" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full block cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-[#8892a4] text-sm">
              <PenLine size={16} />
              חתום כאן
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1.5 text-xs text-[#8892a4] hover:text-red-400 transition-colors"
      >
        <Trash2 size={12} />
        מחק חתימה
      </button>
    </div>
  )
}
