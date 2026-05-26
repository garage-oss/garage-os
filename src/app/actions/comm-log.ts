'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { logComm } from '@/lib/comm-log'
import { revalidatePath } from 'next/cache'
import { CommChannel } from '@prisma/client'

export type CommResult = { error: string } | { success: true }

/** Record that a WhatsApp (or other) message was sent to a customer. */
export async function recordOutboundMessage(input: {
  customerId?:   string
  workOrderId?:  string
  templateType?: string
  message:       string
  recipientPhone?: string
  channel?: CommChannel
}): Promise<CommResult> {
  const { orgId } = await requireOrg()

  try {
    await logComm({
      orgId:          orgId,
      customerId:     input.customerId,
      workOrderId:    input.workOrderId,
      channel:        input.channel ?? 'WHATSAPP',
      direction:      'OUTBOUND',
      templateType:   input.templateType,
      message:        input.message,
      recipientPhone: input.recipientPhone,
    })

    if (input.workOrderId) {
      revalidatePath(`/dashboard/work-orders/${input.workOrderId}`)
    }
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: 'שגיאה בשמירת הודעה' }
  }
}

/** Fetch comm history for a work order (used by server components). */
export async function getWorkOrderComms(workOrderId: string) {
  const { orgId } = await requireOrg()
  return prisma.commLog.findMany({
    where:   { organizationId: orgId, workOrderId },
    orderBy: { sentAt: 'desc' },
    take:    30,
  })
}
