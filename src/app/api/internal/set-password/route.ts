import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// One-time password reset endpoint — protected by INTERNAL_RESET_SECRET.
// Only accessible with correct secret in header; never exposes existing hashes.
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_RESET_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (req.headers.get('x-reset-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { email?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { email, newPassword } = body
  if (!email || !newPassword) {
    return NextResponse.json({ error: 'email and newPassword required' }, { status: 400 })
  }
  if (newPassword.length < 12) {
    return NextResponse.json({ error: 'password too short (min 12)' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({ where: { email }, data: { password: hash } })

  return NextResponse.json({ success: true, email: user.email, name: user.name })
}

// Diagnostic GET — returns user metadata only, no hash.
export async function GET(req: NextRequest) {
  const secret = process.env.INTERNAL_RESET_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (req.headers.get('x-reset-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const email = new URL(req.url).searchParams.get('email')
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, createdAt: true, lastLoginAt: true },
  })
  if (!user) {
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json({ exists: true, ...user })
}
