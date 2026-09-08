import { notFound } from 'next/navigation'

// Gate: Vehicle Documents only available when S3 is configured (or in dev with local storage)
export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const enabled = process.env.STORAGE_PROVIDER === 's3' || process.env.NODE_ENV !== 'production'
  if (!enabled) notFound()
  return <>{children}</>
}
