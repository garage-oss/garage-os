import { cookies, headers } from 'next/headers'
import { redirect }         from 'next/navigation'
import { prisma }           from './prisma'

const COOKIE = 'cgps' // customer garage portal session

export interface CustomerCtx {
  customerId:     string
  customerName:   string
  customerEmail:  string | null
  customerPhone:  string | null
  organizationId: string
  importSource:   string | null
  importId:       string | null   // nesherCliNo when importSource === 'nesher'
}

export async function getCustomerSession(): Promise<CustomerCtx | null> {
  const cookieStore = cookies()
  const token       = cookieStore.get(COOKIE)?.value
  if (!token) return null

  const session = await prisma.customerSession.findUnique({
    where:   { token },
    include: { customer: { select: { id: true, name: true, email: true, phone: true, organizationId: true, importSource: true, importId: true } } },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.customerSession.delete({ where: { id: session.id } }).catch(() => null)
    }
    return null
  }

  // Refresh lastActiveAt at most once per minute to track inactivity
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
  if (!session.lastActiveAt || session.lastActiveAt < oneMinuteAgo) {
    await prisma.customerSession
      .update({ where: { id: session.id }, data: { lastActiveAt: new Date() } })
      .catch(() => null)
  }

  const c = session.customer
  return {
    customerId:     c.id,
    customerName:   c.name,
    customerEmail:  c.email,
    customerPhone:  c.phone,
    organizationId: c.organizationId,
    importSource:   c.importSource,
    importId:       c.importId,
  }
}

export async function requireCustomerSession(): Promise<CustomerCtx> {
  const ctx = await getCustomerSession()
  if (!ctx) redirect('/portal/login')
  return ctx
}

export async function createCustomerSession(customerId: string): Promise<string> {
  const headersList = headers()
  const ip          = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? null
  const userAgent   = headersList.get('user-agent') ?? null

  const session = await prisma.customerSession.create({
    data: {
      customerId,
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })
  return session.token
}

export function getSessionCookieConfig(token: string) {
  return {
    name:     COOKIE,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   30 * 24 * 60 * 60, // 30 days
  }
}
