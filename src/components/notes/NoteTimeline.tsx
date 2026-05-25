'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye, Trash2, User } from 'lucide-react'
import { deleteNote } from '@/app/actions/notes'

export type NoteItem = {
  id: string
  content: string
  visibility: 'INTERNAL' | 'CUSTOMER'
  authorName: string | null
  workOrderId: string
  createdAt: string
}

interface Props {
  notes: NoteItem[]
  onDelete: (id: string) => void
}

export function NoteTimeline({ notes, onDelete }: Props) {
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (notes.length === 0) {
    return <p className="text-sm text-[#8892a4] text-center py-6">אין פתקים עדיין</p>
  }

  function handleDelete(note: NoteItem) {
    setDeletingId(note.id)
    startTransition(async () => {
      await deleteNote(note.id, note.workOrderId)
      onDelete(note.id)
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div
          key={note.id}
          className={`rounded-xl p-4 border ${
            note.visibility === 'INTERNAL'
              ? 'bg-amber-500/5 border-amber-500/20'
              : 'bg-emerald-500/5 border-emerald-500/20'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {note.visibility === 'INTERNAL' ? (
                  <span className="flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                    <Lock size={10} />פנימי
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                    <Eye size={10} />ללקוח
                  </span>
                )}
                {note.authorName && (
                  <span className="flex items-center gap-1 text-xs text-[#8892a4]">
                    <User size={10} />{note.authorName}
                  </span>
                )}
                <span className="text-xs text-[#8892a4] ms-auto">
                  {new Date(note.createdAt).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
            </div>
            <button
              onClick={() => handleDelete(note)}
              disabled={pending && deletingId === note.id}
              className="text-[#8892a4] hover:text-red-400 transition-colors flex-shrink-0 mt-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
