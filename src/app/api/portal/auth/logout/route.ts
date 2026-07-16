import { NextResponse } from 'next/server'
import { cookies }      from 'next/headers'
import { prisma }       from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const cookieStore = cookies()
  const token       = cookieStore.get('cgps')?.value

  if (token) {
    await prisma.customerSession.deleteMany({ where: { token } }).catch(() => null)
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set('cgps', '', { maxAge: 0, path: '/' })
  return res
}
