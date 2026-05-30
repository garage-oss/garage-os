/**
 * POST /api/ai-quote
 *
 * Accepts a complaint + optional vehicle context, calls the AI engine,
 * persists the analysis to DB, and returns the full result.
 *
 * Body: {
 *   complaintText: string
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
import { getOrgContext } from '@/lib/org'
import { analyzeComplaint } from '@/lib/ai-quote-engine'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60  // allow up to 60 s for the AI call

export async function POST(req: NextRequest) {
  try {
    const org = await getOrgContext()
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY_MISSING', message: 'הוסף ANTHROPIC_API_KEY ל-.env' },
        { status: 503 },
      )
    }

    const body = await req.json() as {
      complaintText:   string
      workOrderId?:    string
      vehiclePlate?:   string
      vehicleMake?:    string
      vehicleModel?:   string
      vehicleYear?:    number
      vehicleMileage?: number
      photoUrls?:      string[]
    }

    if (!body.complaintText?.trim()) {
      return NextResponse.json({ error: 'complaintText is required' }, { status: 400 })
    }

    // Fetch org's labor rate (default 295 if not set)
    const orgRecord = await prisma.organization.findUnique({
      where:  { id: org.orgId },
      select: { defaultLaborRate: true },
    })
    const laborRate = orgRecord?.defaultLaborRate
      ? Number(orgRecord.defaultLaborRate)
      : 295

    // Call AI engine
    const result = await analyzeComplaint({
      complaintText:   body.complaintText,
      vehiclePlate:    body.vehiclePlate,
      vehicleMake:     body.vehicleMake,
      vehicleModel:    body.vehicleModel,
      vehicleYear:     body.vehicleYear,
      vehicleMileage:  body.vehicleMileage,
      photoUrls:       body.photoUrls ?? [],
      laborRate,
    })

    // Persist to DB
    const analysis = await prisma.aiQuoteAnalysis.create({
      data: {
        organizationId:  org.orgId,
        workOrderId:     body.workOrderId ?? null,
        vehiclePlate:    body.vehiclePlate ?? null,
        vehicleMake:     body.vehicleMake  ?? null,
        vehicleModel:    body.vehicleModel ?? null,
        vehicleYear:     body.vehicleYear  ?? null,
        vehicleMileage:  body.vehicleMileage ?? null,
        complaintText:   body.complaintText,
        photoUrls:       body.photoUrls ?? [],
        rawResponse:     result.rawResponse as object,
        diagnosis:       result.diagnosis,
        confidence:      result.confidence,
        urgency:         result.urgency,
        laborOperations: result.laborOperations as unknown as object,
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
        processingMs:    (result as unknown as { processingMs: number }).processingMs ?? null,
      },
    })

    return NextResponse.json({ analysisId: analysis.id, result })
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
