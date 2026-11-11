/**
 * /api/portal/feedback  — customer-authenticated
 *
 * POST — submit pilot feedback from the customer portal.
 *        Stores formatted feedback text in CustomerPilot.checklistNotes
 *        and marks feedbackReceived = true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '@/lib/prisma'
import { requireCustomerSession }    from '@/lib/customer-auth'

export const dynamic = 'force-dynamic'

interface FeedbackBody {
  loginEase:        number          // 1-5 stars
  vehiclesOk:       string          // 'yes' | 'partial' | 'no' | 'not_sure'
  historyOk:        string          // 'yes' | 'partial' | 'no' | 'not_sure'
  quotesTried:      string          // 'yes_clear' | 'yes_unclear' | 'not_tried'
  bookingTried:     string          // 'yes_easy' | 'yes_hard' | 'not_tried'
  wouldRecommend:   string          // 'yes' | 'maybe' | 'no'
  bestFeature:      string          // free text, optional
  improvement:      string          // free text, optional
}

function label(value: string, map: Record<string, string>): string {
  return map[value] ?? value
}

function formatFeedback(fb: FeedbackBody, name: string): string {
  const stars   = '★'.repeat(Math.min(5, Math.max(1, fb.loginEase))) +
                  '☆'.repeat(5 - Math.min(5, Math.max(1, fb.loginEase)))
  const dateStr = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const vehiclesMap   = { yes: 'כן', partial: 'חלקית', no: 'לא', not_sure: 'לא בטוח/ה' }
  const historyMap    = { yes: 'כן', partial: 'חלקית', no: 'לא', not_sure: 'לא בטוח/ה' }
  const quotesMap     = { yes_clear: 'כן — ברור', yes_unclear: 'כן — לא ברור', not_tried: 'לא ניסיתי' }
  const bookingMap    = { yes_easy: 'כן — נוח', yes_hard: 'כן — לא נוח', not_tried: 'לא ניסיתי' }
  const recommendMap  = { yes: 'כן', maybe: 'אולי', no: 'לא' }

  const lines = [
    `[FEEDBACK ${dateStr} — ${name}]`,
    `כניסה: ${stars}`,
    `רכבים: ${label(fb.vehiclesOk, vehiclesMap)}`,
    `היסטוריה: ${label(fb.historyOk, historyMap)}`,
    `הצעת מחיר: ${label(fb.quotesTried, quotesMap)}`,
    `קביעת תור: ${label(fb.bookingTried, bookingMap)}`,
    `המלצה: ${label(fb.wouldRecommend, recommendMap)}`,
  ]
  if (fb.bestFeature?.trim()) lines.push(`הטוב ביותר: ${fb.bestFeature.trim()}`)
  if (fb.improvement?.trim()) lines.push(`שיפור: ${fb.improvement.trim()}`)

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const ctx = await requireCustomerSession()

  const body = await req.json().catch(() => null) as FeedbackBody | null
  if (!body || typeof body.loginEase !== 'number') {
    return NextResponse.json({ error: 'גוף הבקשה שגוי' }, { status: 400 })
  }

  // Find the pilot record for this customer
  const pilot = await prisma.customerPilot.findUnique({
    where: { customerId: ctx.customerId },
  })

  if (!pilot) {
    // Not in pilot — still accept feedback gracefully (just log to customer notes)
    const feedbackText = formatFeedback(body, ctx.customerName)
    await prisma.customer.update({
      where: { id: ctx.customerId },
      data:  { notes: feedbackText },
    })
    return NextResponse.json({ success: true })
  }

  const feedbackText = formatFeedback(body, ctx.customerName)

  // Append to existing checklistNotes without overwriting staff content
  const existing = pilot.checklistNotes?.trim() ?? ''
  // If there is already a [FEEDBACK] block, replace it; otherwise append
  const hasPrior = existing.includes('[FEEDBACK ')
  const newNotes = hasPrior
    ? existing.replace(/\[FEEDBACK[\s\S]*$/, feedbackText)
    : existing ? `${existing}\n\n${feedbackText}` : feedbackText

  await prisma.customerPilot.update({
    where: { customerId: ctx.customerId },
    data:  {
      feedbackReceived: true,
      checklistNotes:   newNotes,
    },
  })

  return NextResponse.json({ success: true })
}
