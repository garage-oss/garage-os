import { prisma } from '@/lib/prisma'
import { DiagnosticUrgency } from '@prisma/client'

export type DiagnosticAIResponse = {
  possibleCauses: string[]
  recommendedTests: string[]
  commonFixes: string[]
  estimatedDifficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  estimatedTime: string
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  additionalNotes: string
}

export type DiagnosticSessionData = {
  id: string
  complaint: string
  obdCodes: string | null
  symptoms: string | null
  urgency: DiagnosticUrgency
  aiResponse: DiagnosticAIResponse | null
  createdAt: Date
  vehicle: { id: string; plate: string; make: string; model: string; year: number } | null
  workOrder: { id: string; workOrderNumber: string } | null
}

export async function getDiagnosticSessions(vehicleId?: string): Promise<DiagnosticSessionData[]> {
  const sessions = await prisma.diagnosticSession.findMany({
    where: vehicleId ? { vehicleId } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
      workOrder: { select: { id: true, workOrderNumber: true } },
    },
  })

  return sessions.map((s) => ({
    ...s,
    aiResponse: s.aiResponse ? (JSON.parse(s.aiResponse) as DiagnosticAIResponse) : null,
  }))
}

export async function getDiagnosticSession(id: string): Promise<DiagnosticSessionData | null> {
  const s = await prisma.diagnosticSession.findUnique({
    where: { id },
    include: {
      vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
      workOrder: { select: { id: true, workOrderNumber: true } },
    },
  })
  if (!s) return null
  return {
    ...s,
    aiResponse: s.aiResponse ? (JSON.parse(s.aiResponse) as DiagnosticAIResponse) : null,
  }
}
