import type { Metadata, Viewport } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

const rubik = Rubik({
  subsets:  ['latin', 'hebrew'],
  variable: '--font-rubik',
  display:  'swap',
})

// ─── Viewport ─────────────────────────────────────────────────────────────────

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,        // prevent accidental zoom in forms on iOS
  themeColor:   '#6366f1',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),

  title: {
    default:  'GarageOS — מערכת ניהול מוסך',
    template: '%s | GarageOS',
  },
  description: 'מערכת ניהול מוסך מקצועית לניהול לקוחות, רכבים ופקודות עבודה',

  // PWA
  manifest: '/manifest.json',

  // Favicon / Apple touch icon
  icons: {
    icon:             '/favicon.ico',
    apple:            '/icons/icon-180.png',
    shortcut:         '/favicon.ico',
  },

  // Apple PWA
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'GarageOS',
  },

  // Prevent indexing of the SaaS dashboard
  robots: {
    index:  false,
    follow: false,
  },

  // Open Graph (landing / marketing pages can override)
  openGraph: {
    type:        'website',
    locale:      'he_IL',
    siteName:    'GarageOS',
    title:       'GarageOS — מערכת ניהול מוסך',
    description: 'מערכת ניהול מוסך מקצועית',
  },
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans antialiased bg-bg text-text-base">
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
