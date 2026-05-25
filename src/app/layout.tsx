import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const rubik = Rubik({
  subsets: ['latin', 'hebrew'],
  variable: '--font-rubik',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GarageOS — מערכת ניהול מוסך',
  description: 'מערכת ניהול מוסך מקצועית',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans antialiased bg-bg text-text-base">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
