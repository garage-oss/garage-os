'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye, Plus } from 'lucide-react'
import { createNote } from '@/app/actions/notes'
import { NoteVisibility } from '@prisma/client'

interface Props {
  workOrderId: string
  onAdd: () => void
}

export function NoteForm({ workOrderId, onAdd }: Props) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<NoteVisibility>('INTERNAL')
  const [authorName, setAuthorName] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!content.trim()) { setError('יש להזין תוכן'); return }
    startTransition(async () => {
      const result = await createNote(workOrderId, content, visibility, authorName)
      if (result.error) {
        setError(result.error)
      } else {
        setContent('')
        onAdd()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1d27] border border-[#2e3147] rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[#8892a4] uppercase tracking-wide">הוסף פתק</h3>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="כתוב פתק פנימי או הערה ללקוח..."
        className="w-full bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2.5 text-sm text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1] resize-none"
      />

      <div className="flex items-center gap-3 flex-wrap">
        {/* Visibility toggle */}
        <div className="flex bg-[#252836] border border-[#2e3147] rounded-lg p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setVisibility('INTERNAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              visibility === 'INTERNAL'
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-[#8892a4] hover:text-[#e2e8f0]'
            }`}
          >
            <Lock size={11} />פנימי
          </button>
          <button
            type="button"
            onClick={() => setVisibility('CUSTOMER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              visibility === 'CUSTOMER'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-[#8892a4] hover:text-[#e2e8f0]'
            }`}
          >
            <Eye size={11} />ללקוח
          </button>
        </div>

        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="שם טכנאי (אופציונלי)"
          className="bg-[#252836] border border-[#2e3147] rounded-lg px-3 py-2 text-xs text-[#e2e8f0] placeholder-[#4a5568] focus:outline-none focus:border-[#6366f1]"
        />

        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="flex items-center gap-1.5 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white text-xs font-medium rounded-lg px-4 py-2 transition-colors ms-auto"
        >
          <Plus size={13} />{isPending ? 'שומר...' : 'הוסף פתק'}
        </button>
      </div>
    </form>
  )
}
