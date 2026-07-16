import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireOrg }                from '@/lib/org'
import { toWhatsAppUrl, sendSmsMessage } from '@/lib/sms'
import { CommChannel }               from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { customerId: string } },
) {
  const { memberRole, orgId, userName } = await requireOrg()
  if (memberRole !== 'OWNER') {
    return NextResponse.json({ error: 'OWNER בלבד' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    channel: 'whatsapp' | 'sms'
    message: string
    phone:   string
  }

  if (!body.channel || !body.message || !body.phone) {
    return NextResponse.json({ error: 'channel, message ו-phone נדרשים' }, { status: 400 })
  }

  const pilot = await prisma.customerPilot.findFirst({
    where:   { customerId: params.customerId, organizationId: orgId },
    include: { customer: { select: { name: true } } },
  })
  if (!pilot) return NextResponse.json({ error: 'לא נמצא בפיילוט' }, { status: 404 })

  let waUrl: string | null = null
  let sent                 = false
  let sendError: string | undefined

  if (body.channel === 'whatsapp') {
    waUrl = `${toWhatsAppUrl(body.phone)}?text=${encodeURIComponent(body.message)}`
    sent  = true
  } else {
    const result = await sendSmsMessage(body.phone, body.message)
    sent      = result.success
    sendError = result.error
  }

  await prisma.commLog.create({
    data: {
      organizationId: orgId,
      customerId:     params.customerId,
      channel:        body.channel === 'sms' ? CommChannel.SMS : CommChannel.WHATSAPP,
      direction:      'OUTBOUND',
      templateType:   'pilot_invite',
      message:        body.message,
      recipientPhone: body.phone,
    },
  })

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userName,
      action:      'INVITE_SENT',
      entityType:  'CustomerPilot',
      entityId:    params.customerId,
      entityLabel: pilot.customer.name,
      afterData:   { channel: body.channel, phone: body.phone, sent },
    },
  })

  return NextResponse.json({ success: sent, waUrl, error: sendError })
}
