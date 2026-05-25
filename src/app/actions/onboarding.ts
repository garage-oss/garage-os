'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

function makeSlug(name: string, id: string): string {
  // Use first 8 chars of the org ID so the slug is always unique and URL-safe
  return id.slice(0, 8)
}

export async function createOrganization(formData: FormData): Promise<{ error?: string }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null

  if (!name) return { error: 'שם המוסך הוא שדה חובה' }

  try {
    // Check user doesn't already have an org
    const existing = await prisma.membership.findFirst({
      where: { userId: session.user.id },
    })
    if (existing) redirect('/dashboard')

    const org = await prisma.organization.create({
      data: {
        name,
        slug: '', // will update below
        phone,
        city,
        plan: 'FREE',
      },
    })

    // Slug = first 8 chars of org cuid (always unique)
    await prisma.organization.update({
      where: { id: org.id },
      data: { slug: makeSlug(name, org.id) },
    })

    await prisma.membership.create({
      data: {
        organizationId: org.id,
        userId: session.user.id,
        role: 'OWNER',
      },
    })

    redirect('/dashboard')
  } catch (e) {
    // redirect() throws — let it propagate
    if (e instanceof Error && e.message !== 'NEXT_REDIRECT') {
      console.error(e)
      return { error: 'שגיאה ביצירת המוסך' }
    }
    throw e
  }
}
