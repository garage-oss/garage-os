'use client'

import { useState } from 'react'
import { DebugPanel }    from './DebugPanel'
import { MappingEditor } from './MappingEditor'
import type { MappingPreset } from '@/lib/migration/types'

export function MappingPageClient({ initialPresets }: { initialPresets: MappingPreset[] }) {
  const [reloadKey, setReloadKey] = useState(0)

  return (
    <div className="space-y-6">
      {/* Debug panel — auto-runs on mount, notifies MappingEditor when tables are found */}
      <DebugPanel onTablesReady={() => setReloadKey(k => k + 1)} />

      {/* Mapping editor — re-fetches tables when reloadKey changes */}
      <MappingEditor initialPresets={initialPresets} reloadKey={reloadKey} />
    </div>
  )
}
