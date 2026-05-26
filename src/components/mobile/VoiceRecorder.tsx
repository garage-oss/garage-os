'use client'

import { useState, useRef } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface Props {
  /** Called with transcribed / placeholder text once recording stops */
  onTranscript: (text: string) => void
}

type RecordingState = 'idle' | 'recording' | 'processing'

export function VoiceRecorder({ onTranscript }: Props) {
  const [state,     setState]   = useState<RecordingState>('idle')
  const [error,     setError]   = useState<string | null>(null)
  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setState('processing')
        processRecording()
      }

      mediaRef.current = recorder
      recorder.start(250)
      setState('recording')
    } catch {
      setError('אין גישה למיקרופון')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
  }

  function processRecording() {
    // In production, upload to a speech-to-text API.
    // For now, attach a placeholder so the user knows recording was captured
    // and can type over it, or use it as an audio attachment.
    const blob = new Blob(chunksRef.current, { type: getSupportedMimeType() })
    const duration = Math.round(blob.size / 8000) // rough estimate

    // Upload as audio file to work order media (via existing upload route)
    // TODO: integrate with /api/media/upload for audio files
    onTranscript(`[הקלטה קולית — ${duration} שניות] `)
    setState('idle')
  }

  function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  }

  function toggle() {
    if (state === 'idle')      startRecording()
    else if (state === 'recording') stopRecording()
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={state === 'processing'}
        className={[
          'w-12 h-12 rounded-xl flex items-center justify-center transition-all',
          state === 'recording'
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-[#252836] hover:bg-[#2e3147] border border-[#2e3147]',
        ].join(' ')}
        title={state === 'recording' ? 'עצור הקלטה' : 'הקלט קול'}
      >
        {state === 'processing' ? (
          <Loader2 size={18} className="animate-spin text-[#8892a4]" />
        ) : state === 'recording' ? (
          <MicOff size={18} className="text-white" />
        ) : (
          <Mic size={18} className="text-[#8892a4]" />
        )}
      </button>
      {state === 'recording' && (
        <span className="text-[10px] text-red-400 font-semibold">מקליט...</span>
      )}
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  )
}
