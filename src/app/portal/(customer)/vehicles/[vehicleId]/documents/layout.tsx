import { notFound } from 'next/navigation'

// Vehicle Documents require a persistent remote storage provider.
// In production: STORAGE_PROVIDER must be 'supabase' or 's3'.
// In development (NODE_ENV !== 'production'): local storage is allowed.
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const p = process.env.STORAGE_PROVIDER
  const enabled = p === 'supabase' || p === 's3' || process.env.NODE_ENV !== 'production'
  if (!enabled) notFound()
  return <>{children}</>
}
