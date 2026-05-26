import { hanesherConfigured } from '@/lib/mssql'
import { ConnectionSetup } from '@/components/migration/ConnectionSetup'

export default function MigrationSetupPage() {
  const configured = hanesherConfigured()
  return <ConnectionSetup configured={configured} />
}
