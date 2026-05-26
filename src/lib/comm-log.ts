import { prisma } from './prisma'
import { CommChannel, CommDirection } from '@prisma/client'

// ─── WhatsApp deep-link templates ─────────────────────────────────────────────

export type WaTemplate =
  | 'status_update'
  | 'status_completed'
  | 'waiting_parts'
  | 'quote_approval'
  | 'ready_pickup'
  | 'payment_link'
  | 'appointment_reminder'

export interface TemplateContext {
  customerName:    string
  workOrderNumber: string
  garageName:      string
  status?:         string
  quoteUrl?:       string
  paymentUrl?:     string
  vehiclePlate?:   string
  vehicleDesc?:    string
  estimatedDays?:  string
}

const TEMPLATES: Record<WaTemplate, (ctx: TemplateContext) => string> = {
  status_update: (ctx) =>
    `שלום ${ctx.customerName},\nעדכון על רכבך (${ctx.vehiclePlate ?? ''}):\nפקודת עבודה ${ctx.workOrderNumber} — ${ctx.status ?? 'בעדכון'}\n\n${ctx.garageName}`,

  status_completed: (ctx) =>
    `שלום ${ctx.customerName} 👋\nרכבך *${ctx.vehicleDesc ?? ctx.vehiclePlate ?? ''}* מוכן לאיסוף!\n\nפקודת עבודה: ${ctx.workOrderNumber}\n\nניתן לאסוף בשעות הפעילות. נשמח לראותך 🙂\n\n${ctx.garageName}`,

  waiting_parts: (ctx) =>
    `שלום ${ctx.customerName},\nרכבך (${ctx.vehiclePlate ?? ''}) ממתין לחלקים.\nנעדכן אותך ברגע שהחלקים יגיעו.\n\nזמן משוער: ${ctx.estimatedDays ?? 'לא ידוע'} ימי עסקים\n\n${ctx.garageName}`,

  quote_approval: (ctx) =>
    `שלום ${ctx.customerName},\nהצעת מחיר מוכנה עבורך לרכב *${ctx.vehicleDesc ?? ctx.vehiclePlate ?? ''}*.\n\nלצפייה ואישור ההצעה:\n${ctx.quoteUrl ?? '[קישור להצעה]'}\n\n${ctx.garageName}`,

  ready_pickup: (ctx) =>
    `שלום ${ctx.customerName} 🎉\nרכבך מוכן לאיסוף!\nפקודה: ${ctx.workOrderNumber}\n\nנשמח לראותך בקרוב.\n${ctx.garageName}`,

  payment_link: (ctx) =>
    `שלום ${ctx.customerName},\nהתשלום עבור רכבך (${ctx.vehiclePlate ?? ''}) ממתין.\n\nלתשלום מאובטח:\n${ctx.paymentUrl ?? '[קישור לתשלום]'}\n\n${ctx.garageName}`,

  appointment_reminder: (ctx) =>
    `שלום ${ctx.customerName},\nתזכורת לביקורך המתוכנן ב-${ctx.garageName}.\n\nנשמח לראותך!`,
}

export const TEMPLATE_LABELS: Record<WaTemplate, string> = {
  status_update:        'עדכון סטטוס',
  status_completed:     'הושלמה — מוכן לאיסוף',
  waiting_parts:        'ממתין לחלקים',
  quote_approval:       'אישור הצעת מחיר',
  ready_pickup:         'מוכן לאיסוף',
  payment_link:         'קישור לתשלום',
  appointment_reminder: 'תזכורת תור',
}

export function buildTemplate(type: WaTemplate, ctx: TemplateContext): string {
  return TEMPLATES[type](ctx)
}

/** Generate a wa.me deep-link for the given phone + message. */
export function buildWaLink(phone: string, message: string): string {
  const clean = phone.replace(/\D/g, '')
  // Convert Israeli local number (05x) → international (+972)
  const intl = clean.startsWith('0') ? `972${clean.slice(1)}` : clean
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function logComm(input: {
  orgId:         string
  customerId?:   string
  workOrderId?:  string
  channel?:      CommChannel
  direction?:    CommDirection
  templateType?: string
  message:       string
  recipientPhone?: string
}) {
  return prisma.commLog.create({
    data: {
      organizationId: input.orgId,
      customerId:     input.customerId,
      workOrderId:    input.workOrderId,
      channel:        input.channel     ?? 'WHATSAPP',
      direction:      input.direction   ?? 'OUTBOUND',
      templateType:   input.templateType,
      message:        input.message,
      recipientPhone: input.recipientPhone,
    },
  })
}

export async function getCommLogs(
  orgId:       string,
  workOrderId: string,
  limit = 20
) {
  return prisma.commLog.findMany({
    where:   { organizationId: orgId, workOrderId },
    orderBy: { sentAt: 'desc' },
    take:    limit,
    include: { customer: { select: { name: true } } },
  })
}

export async function getCustomerCommHistory(orgId: string, customerId: string, limit = 30) {
  return prisma.commLog.findMany({
    where:   { organizationId: orgId, customerId },
    orderBy: { sentAt: 'desc' },
    take:    limit,
  })
}
