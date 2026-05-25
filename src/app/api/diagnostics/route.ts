import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { DiagnosticAIResponse } from '@/lib/diagnostics'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function urgencyToEnum(u: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL',
  }
  return map[u?.toUpperCase()] ?? 'MEDIUM'
}

export async function POST(req: NextRequest) {
  try {
    const { complaint, obdCodes, symptoms, vehicleId, workOrderId, vehicleInfo } = await req.json()

    if (!complaint?.trim()) {
      return NextResponse.json({ error: 'תיאור תקלה הוא שדה חובה' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'מפתח AI לא מוגדר — הוסף ANTHROPIC_API_KEY ל-.env' }, { status: 503 })
    }

    const prompt = `אתה עוזר מומחה לאבחון רכבים. נתח את התסמינים הבאים וספק דוח אבחון מובנה.

${vehicleInfo ? `רכב: ${vehicleInfo}` : ''}
תלונת הלקוח: ${complaint}
קודי OBD: ${obdCodes || 'לא צוינו'}
תסמינים: ${symptoms || 'לא צוינו'}

הגב אך ורק ב-JSON תקני בפורמט הבא (ללא טקסט נוסף):
{
  "possibleCauses": ["סיבה 1", "סיבה 2", "סיבה 3"],
  "recommendedTests": ["בדיקה 1", "בדיקה 2", "בדיקה 3"],
  "commonFixes": ["תיקון 1", "תיקון 2"],
  "estimatedDifficulty": "LOW",
  "estimatedTime": "1-2 שעות",
  "urgencyLevel": "MEDIUM",
  "additionalNotes": "הערות נוספות"
}

כללים: estimatedDifficulty יכול להיות LOW/MEDIUM/HIGH בלבד. urgencyLevel יכול להיות LOW/MEDIUM/HIGH/CRITICAL בלבד. השתמש בעברית לכל הערכים. היה תמציתי.`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    let aiData: DiagnosticAIResponse

    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim()
      aiData = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ error: 'שגיאה בפענוח תשובת ה-AI' }, { status: 500 })
    }

    const urgency = urgencyToEnum(aiData.urgencyLevel)

    const session = await prisma.diagnosticSession.create({
      data: {
        complaint,
        obdCodes: obdCodes || null,
        symptoms: symptoms || null,
        aiResponse: JSON.stringify(aiData),
        urgency,
        vehicleId: vehicleId || null,
        workOrderId: workOrderId || null,
      },
    })

    return NextResponse.json({ id: session.id, aiData })
  } catch (err) {
    console.error('Diagnostic error:', err)
    return NextResponse.json({ error: 'שגיאה בעיבוד האבחון' }, { status: 500 })
  }
}
