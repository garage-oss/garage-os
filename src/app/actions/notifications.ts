'use server'

import { requireOrg }                   from '@/lib/org'
import { markRead, markAllRead }        from '@/lib/notifications'
import { revalidatePath }               from 'next/cache'

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { userId } = await requireOrg()
  await markRead(notificationId, userId)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { userId, orgId } = await requireOrg()
  await markAllRead(userId, orgId)
  revalidatePath('/dashboard', 'layout')
}
