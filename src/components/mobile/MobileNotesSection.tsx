'use client'

import { useState, useTransition } from 'react'
import { StickyNote, Loader2, Lock, Eye, Mic } from 'lucide-react'
import { addTechNote } from '@/app/actions/time-entries'
import { NoteVisibility } from '@prisma/client'
import { VoiceRecorder } from './VoiceRecorder'

interface NoteItem {
  id:         string
  content:    string
  authorName: string | null
  visibility: NoteVisibility
  createdAt:  string
}

interface Props {
  workOrderId:   string
  initialNotes:  NoteItem[]
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)   return 'עכשיו'
  if (diff < 3600000) return `לפני ${Math.floor(diff/60000)} דק׳`
  if (diff < 86400000) return `לפני ${Math.floor(diff/3600000)} שעות`
  return `לפני ${Math.floor(diff/86400000)} ימים`
}

export function MobileNotesSection({ workOrderId, initialNotes }: Props) {
  const [notes,     setNotes]  = useState(initialNotes)
  const [text,      setText]   = useState('')
  const [expanded,  setExpanded] = useState(false)
  const [isPending, start]    = useTransition()

  function handleVoiceText(transcript: string) {
    setText((prev) => prev ? `${prev}\n${transcript}` : transcript)
  }

  async function handleSubmit() {
    if (!text.trim()) return
    start(async () => {
      const res = await addTechNote(workOrderId, text.trim())
      if (!res.error) {
        setNotes((prev) => [{
          id:         crypto.randomUUID(),
          content:    text.trim(),
          authorName: 'אתה',
          visibility: 'INTERNAL',
          createdAt:  new Date().toISOString(),
        }, ...prev])
        setText('')
      }
    })
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2e3147] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#2e3147]"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote size={15} className="text-[#8892a4]" />
          פתקים טכניים
        </div>
        <span className="text-xs text-[#8892a4]">{notes.length} פתקים {expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Add note */}
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="הוסף פתק טכני פנימי..."
                rows={3}
                className="w-full bg-[#252836] border border-[#2e3147] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#8892a4] focus:outline-none focus:border-[#6366f1] resize-none"
              />
            </div>
            <div className="flex gap-2">
              <VoiceRecorder onTranscript={handleVoiceText} />
              <button
                onClick={handleSubmit}
                disabled={isPending || !text.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <StickyNote size={14} />}
                שמור פתק
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="bg-[#252836] rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#8892a4]">{note.authorName ?? 'טכנאי'}</span>
                    <div className="flex items-center gap-1.5">
                      {note.visibility === 'INTERNAL' ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#8892a4]"><Lock size={9} />פנימי</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-sky-400"><Eye size={9} />ללקוח</span>
                      )}
                      <span className="text-[10px] text-[#8892a4]">{relTime(note.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-line">{note.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#8892a4] text-center py-3">אין פתקים עדיין</p>
          )}
        </div>
      )}
    </div>
  )
}
