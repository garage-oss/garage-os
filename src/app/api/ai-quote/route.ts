/**
 * POST /api/ai-quote
 *
 * Accepts a complaint + optional vehicle context, runs analysis (real or mock),
 * persists the result to DB, and returns the full AiQuoteResult.
 *
 * When ANTHROPIC_API_KEY is absent the route falls back to getMockAnalysis()
 * which returns a deterministic result from one of 8 pre-built Hebrew scenarios.
 * The response includes  { isMock: true }  so the client can show a DEMO badge.
 *
 * Body: {
 *   complaintText:  string
 *   workOrderId?:   string
 *   vehiclePlate?:  string
 *   vehicleMake?:   string
 *   vehicleModel?:  string
 *   vehicleYear?:   number
 *   vehicleMileage?: number
 *   photoUrls?:     string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext }    from '@/lib/org'
import { analyzeComplaint } from '@/lib/ai-quote-engine'
import { getMockAnalysis, MOCK_DELAY_MS } from '@/lib/mock-ai-analysis'
import { prisma }           from '@/lib/prisma'
import type { AiQuoteResult } from '@/lib/ai-quote-engine'

export const maxDuration = 60   // allow up to 60 s for real AI calls

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const org = await getOrgContext()
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json() as {
      complaintText:   string
      serviceType?:    string   // passed by client so we can enforce the guard server-side
      workOrderId?:    string
      vehiclePlate?:   string
      vehicleMake?:    string
      vehicleModel?:   string
      vehicleYear?:    number
      vehicleMileage?: number
      photoUrls?:      string[]
    }

    // ── Periodic service guard ────────────────────────────────────────────────
    // Periodic service quotes must be generated from structured MaintenanceSchedule
    // data only.  AI analysis is explicitly prohibited for this service type —
    // AI must never guess at maintenance intervals or required parts.
    if (body.serviceType === 'PERIODIC_SERVICE') {
      return NextResponse.json(
        {
          error:   'PERIODIC_SERVICE_NOT_ALLOWED',
          message: 'טיפול תקופתי מחייב שימוש בלוח טיפולים מובנה — /api/periodic-quote',
        },
        { status: 400 },
      )
    }

    if (!body.complaintText?.trim()) {
      return NextResponse.json({ error: 'complaintText is required' }, { status: 400 })
    }

    // ── Labor rate (org setting or default) ───────────────────────────────────
    const orgRecord = await prisma.organization.findUnique({
      where:  { id: org.orgId },
      select: { defaultLaborRate: true },
    })
    const laborRate = orgRecord?.defaultLaborRate
      ? Number(orgRecord.defaultLaborRate)
      : 295

    // ── Run analysis — real or mock ───────────────────────────────────────────
    const isMock = !process.env.ANTHROPIC_API_KEY

    let result: AiQuoteResult

    if (isMock) {
      // Simulate AI thinking time so the loading UX feels realistic
      await new Promise(r => setTimeout(r, MOCK_DELAY_MS))
      result = getMockAnalysis(body.complaintText, laborRate)
    } else {
      result = await analyzeComplaint({
        complaintText:  body.complaintText,
        vehiclePlate:   body.vehiclePlate,
        vehicleMake:    body.vehicleMake,
        vehicleModel:   body.vehicleModel,
        vehicleYear:    body.vehicleYear,
        vehicleMileage: body.vehicleMileage,
        photoUrls:      body.photoUrls ?? [],
        laborRate,
      })
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const analysis = await prisma.aiQuoteAnalysis.create({
      data: {
        organizationId:  org.orgId,
        workOrderId:     body.workOrderId   ?? null,
        vehiclePlate:    body.vehiclePlate  ?? null,
        vehicleMake:     body.vehicleMake   ?? null,
        vehicleModel:    body.vehicleModel  ?? null,
        vehicleYear:     body.vehicleYear   ?? null,
        vehicleMileage:  body.vehicleMileage ?? null,
        complaintText:   body.complaintText,
        photoUrls:       body.photoUrls     ?? [],
        rawResponse:     result.rawResponse as object,
        diagnosis:       result.diagnosis,
        confidence:      result.confidence,
        urgency:         result.urgency,
        laborOperations: result.laborOperations  as unknown as object,
        totalLaborHours: result.totalLaborHours,
        partsRecommended: result.partsRecommended as unknown as object,
        additionalChecks: result.additionalChecks as unknown as object,
        safetyWarning:   result.safetyWarning,
        aiNotes:         result.aiNotes,
        laborRateUsed:   result.laborRateUsed,
        laborTotal:      result.laborTotal,
        partsTotal:      result.partsTotal,
        subtotal:        result.subtotal,
        vatAmount:       result.vatAmount,
        totalEstimate:   result.totalEstimate,
        modelUsed:       result.modelUsed,
        inputTokens:     result.inputTokens,
        outputTokens:    result.outputTokens,
        processingMs:    isMock
          ? MOCK_DELAY_MS
          : ((result as unknown as { processingMs?: number }).processingMs ?? null),
      },
    })

    return NextResponse.json({ analysisId: analysis.id, result, isMock })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown'

    if (message === 'ANTHROPIC_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY_MISSING', message: 'הוסף ANTHROPIC_API_KEY ל-.env' },
        { status: 503 },
      )
    }
    if (message === 'AI_NO_TOOL_RESPONSE') {
      return NextResponse.json(
        { error: 'AI_NO_TOOL_RESPONSE', message: 'ה-AI לא החזיר תשובה תקנית' },
        { status: 500 },
      )
    }

    console.error('[ai-quote] error:', err)
    return NextResponse.json(
      { error: 'AI_CALL_FAILED', message: 'שגיאה בקריאה ל-AI' },
      { status: 500 },
    )
  }
}
