import { hanesherConfigured } from '@/lib/mssql'
import { ConnectionSetup }    from '@/components/migration/ConnectionSetup'

export default function MigrationSetupPage() {
  const configured = hanesherConfigured()

  // Read env values server-side — NEVER include the password value
  const config = {
    server:      process.env.HANESHER_DB_SERVER    ?? '',   // named instance string
    host:        process.env.HANESHER_DB_HOST      ?? '',
    port:        process.env.HANESHER_DB_PORT       ?? '1433',
    name:        process.env.HANESHER_DB_NAME       ?? '',
    user:        process.env.HANESHER_DB_USER       ?? '',
    passwordSet: !!process.env.HANESHER_DB_PASSWORD,
    encrypt:     process.env.HANESHER_DB_ENCRYPT    ?? 'false',
    trustCert:   process.env.HANESHER_DB_TRUST_CERT ?? 'true',
  }

  return <ConnectionSetup configured={configured} config={config} />
}
