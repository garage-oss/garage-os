/**
 * AI Quote Engine — uses Claude tool_use for guaranteed structured output.
 *
 * Flow:
 *  analyzeComplaint(input) → AiQuoteResult
 *    ├── Builds message content (text + optional images)
 *    ├── Calls claude-opus-4-5 with tool_use (structured JSON contract)
 *    └── Computes cost totals (labor × rate + parts + 17% VAT)
 *
 * All prices are ILS.  VAT_RATE = 17%.
 */

import Anthropic from '@anthropic-ai/sdk'

// ─── Constants ────────────────────────────────────────────────────────────────

export const VAT_RATE = 0.17

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface LaborOperation {
  name:           string   // Hebrew operation name
  description:    string   // Detail description
  estimatedHours: number
}

export interface PartRecommendation {
  name:               string
  category:           PartCategory
  quantity:           number
  estimatedPriceILS:  number   // per-unit, pre-VAT
  isOptional:         boolean
  notes?:             string
}

export type PartCategory =
  | 'brakes' | 'engine' | 'suspension' | 'electrical'
  | 'ac' | 'tires' | 'fluid' | 'filter' | 'body' | 'other'

export type AiUrgency = 'low' | 'medium' | 'high' | 'critical'

export interface AiQuoteInput {
  complaintText:   string
  vehicleMake?:    string
  vehicleModel?:   string
  vehicleYear?:    number
  vehiclePlate?:   string
  vehicleMileage?: number
  photoUrls?:      string[]   // publicly accessible image URLs
  laborRate?:      number     // ILS/hr — falls back to org default (295)
}

export interface AiQuoteResult {
  // Structured AI output
  diagnosis:       string
  confidence:      number      // 0–1
  urgency:         AiUrgency
  laborOperations: LaborOperation[]
  totalLaborHours: number
  partsRecommended: PartRecommendation[]
  additionalChecks: string[]
  safetyWarning:   string | null
  aiNotes:         string

  // Cost totals (ready to display)
  laborRateUsed:   number
  laborTotal:      number
  partsTotal:      number
  subtotal:        number
  vatAmount:       number
  totalEstimate:   number

  // AI call metadata
  modelUsed:       string
  inputTokens:     number
  outputTokens:    number
  rawResponse:     unknown
}

// ─── Tool schema ──────────────────────────────────────────────────────────────
// Forcing tool_use guarantees Claude returns valid JSON — no text-parsing hacks.

const QUOTE_ANALYSIS_TOOL: Anthropic.Tool = {
  name: 'create_quote_analysis',
  description:
    'Create a structured diagnostic and quote analysis for a vehicle complaint. ' +
    'Return ALL fields using Israeli market pricing (ILS).',
  input_schema: {
    type: 'object',
    properties: {
      diagnosis: {
        type: 'string',
        description: 'Full diagnostic assessment in Hebrew. Be specific about likely root cause.',
      },
      confidence: {
        type: 'number',
        description:
          'Confidence score 0.0–1.0. Use 0.5–0.7 for vague complaints, 0.75–0.9 for clear symptoms.',
      },
      urgency: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description:
          'critical = safety risk (brakes/steering). high = affects drivability. medium = should fix soon. low = cosmetic/minor.',
      },
      laborOperations: {
        type: 'array',
        description: 'Required labor operations in order of execution.',
        items: {
          type: 'object',
          properties: {
            name:           { type: 'string', description: 'Short Hebrew name, e.g. "החלפת רפידות בלמים"' },
            description:    { type: 'string', description: 'Technical detail for the mechanic' },
            estimatedHours: { type: 'number', description: 'Realistic hours for Israeli garage' },
          },
          required: ['name', 'description', 'estimatedHours'],
        },
      },
      partsRecommended: {
        type: 'array',
        description: 'Parts required. Include realistic Israeli retail prices WITH typical 30% garage markup.',
        items: {
          type: 'object',
          properties: {
            name:              { type: 'string',  description: 'Hebrew part name as used in Israeli garages' },
            category:          {
              type: 'string',
              enum: ['brakes','engine','suspension','electrical','ac','tires','fluid','filter','body','other'],
            },
            quantity:          { type: 'integer' },
            estimatedPriceILS: { type: 'number',  description: 'Price per unit in ILS, pre-VAT, with markup' },
            isOptional:        { type: 'boolean', description: 'true = recommended but not strictly required' },
            notes:             { type: 'string',  description: 'Optional: brand recommendation or fitment note' },
          },
          required: ['name', 'category', 'quantity', 'estimatedPriceILS', 'isOptional'],
        },
      },
      additionalChecks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional items mechanic should inspect while the car is in. Hebrew.',
      },
      safetyWarning: {
        type: ['string', 'null'],
        description: 'MUST set for brakes/steering/tyres issues. Null if no safety concern.',
      },
      aiNotes: {
        type: 'string',
        description: 'Any caveats, assumptions, or useful context for the service advisor. Hebrew.',
      },
    },
    required: [
      'diagnosis', 'confidence', 'urgency',
      'laborOperations', 'partsRecommended',
      'additionalChecks', 'safetyWarning', 'aiNotes',
    ],
  },
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `אתה מערכת אבחון וציטוט רכבים מומחית עבור מוסך ישראלי.

תפקידך: לנתח תלונות לקוחות ולהחזיר הערכת אבחון מפורטת עם רשימת עבודות וחלקים.

עקרונות:
- כל האבחנות והתיאורים בעברית
- מחירי חלקים בשקלים ישראליים (₪) כולל רווח מוסך של ~30%
- שעות עבודה לפי תקן מוסך ישראלי (לא מפעל)
- היה שמרני עם ציוני ביטחון — אל תבטיח אם יש אפשרויות מרובות
- תמיד כלול בדיקות נוספות רלוונטיות
- סמן אזהרות בטיחות כאשר מעורבים בלמים, הגה, צמיגים, ומתלים

טווחי מחירים ישראלים אופייניים (כולל רווח):
- שמן מנוע (5L): 120–200 ₪ | פילטר שמן: 35–70 ₪
- רפידות בלמים קדמיות (סט): 180–400 ₪ | דיסקיות: 200–450 ₪
- פילטר אוויר: 50–120 ₪ | פילטר מזגן: 60–120 ₪
- מצבר: 300–600 ₪ | מצתים (סט): 80–200 ₪
- רצועת טיימינג + ערכה: 400–900 ₪
- תרמוסטט: 120–250 ₪ | משאבת מים: 250–500 ₪
- זרוע הגה/קצה הגה: 150–400 ₪ | בולם זעזועים: 300–600 ₪
- גז פריאון R-134a (1kg): 120–200 ₪

Use the create_quote_analysis tool to return your analysis.`

// ─── Message builder ──────────────────────────────────────────────────────────

function buildUserContent(input: AiQuoteInput): Anthropic.MessageParam['content'] {
  const lines: string[] = []

  // Vehicle context
  if (input.vehicleMake || input.vehiclePlate) {
    lines.push('── פרטי הרכב ──────────────────────────────────')
    if (input.vehiclePlate)  lines.push(`לוחית: ${input.vehiclePlate}`)
    if (input.vehicleMake)   lines.push(`יצרן:  ${input.vehicleMake}`)
    if (input.vehicleModel)  lines.push(`דגם:   ${input.vehicleModel}`)
    if (input.vehicleYear)   lines.push(`שנה:   ${input.vehicleYear}`)
    if (input.vehicleMileage) lines.push(`ק"מ:   ${input.vehicleMileage.toLocaleString('he-IL')}`)
    lines.push('')
  }

  lines.push('── תלונת הלקוח ─────────────────────────────────')
  lines.push(input.complaintText.trim())

  const textBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: lines.join('\n'),
  }

  // No photos → simple text-only message
  if (!input.photoUrls?.length) {
    return [textBlock]
  }

  // With photos — vision-enabled message
  const imageBlocks: Anthropic.ImageBlockParam[] = input.photoUrls
    .slice(0, 5)  // cap at 5 images
    .map(url => ({
      type: 'image' as const,
      source: { type: 'url' as const, url },
    }))

  return [
    textBlock,
    {
      type: 'text',
      text: `\nמצורפות ${imageBlocks.length} תמונות מהרכב — השתמש בהן לאבחון מדויק יותר:`,
    },
    ...imageBlocks,
  ]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeComplaint(input: AiQuoteInput): Promise<AiQuoteResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY_MISSING')
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const laborRate = input.laborRate ?? 295
  const startMs  = Date.now()

  const response = await client.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 2048,
    system:     SYSTEM_PROMPT,
    tools:      [QUOTE_ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'create_quote_analysis' },
    messages: [
      {
        role:    'user',
        content: buildUserContent(input),
      },
    ],
  })

  const processingMs = Date.now() - startMs

  // Extract tool_use block (guaranteed by tool_choice: force)
  const toolBlock = response.content.find(b => b.type === 'tool_use')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('AI_NO_TOOL_RESPONSE')
  }

  const data = toolBlock.input as {
    diagnosis:        string
    confidence:       number
    urgency:          AiUrgency
    laborOperations:  LaborOperation[]
    partsRecommended: PartRecommendation[]
    additionalChecks: string[]
    safetyWarning:    string | null
    aiNotes:          string
  }

  // Cost calculations
  const totalLaborHours = data.laborOperations.reduce(
    (s, op) => s + op.estimatedHours, 0
  )
  const laborTotal = Math.round(totalLaborHours * laborRate * 100) / 100
  const partsTotal = Math.round(
    data.partsRecommended
      .filter(p => !p.isOptional)
      .reduce((s, p) => s + p.quantity * p.estimatedPriceILS, 0) * 100
  ) / 100
  const subtotal     = Math.round((laborTotal + partsTotal) * 100) / 100
  const vatAmount    = Math.round(subtotal * VAT_RATE * 100) / 100
  const totalEstimate = Math.round((subtotal + vatAmount) * 100) / 100

  return {
    diagnosis:        data.diagnosis,
    confidence:       Math.max(0, Math.min(1, data.confidence)),
    urgency:          data.urgency,
    laborOperations:  data.laborOperations,
    totalLaborHours,
    partsRecommended: data.partsRecommended,
    additionalChecks: data.additionalChecks ?? [],
    safetyWarning:    data.safetyWarning ?? null,
    aiNotes:          data.aiNotes ?? '',

    laborRateUsed:    laborRate,
    laborTotal,
    partsTotal,
    subtotal,
    vatAmount,
    totalEstimate,

    modelUsed:    response.model,
    inputTokens:  response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    rawResponse:  data,
    // expose processingMs on rawResponse for DB storage
    ...({ processingMs } as { processingMs: number }),
  } as AiQuoteResult & { processingMs: number }
}
