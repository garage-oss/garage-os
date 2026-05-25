'use server'

import { prisma } from '@/lib/prisma'
import { requireOrg } from '@/lib/org'
import { revalidatePath } from 'next/cache'
import { FuelType, Transmission } from '@prisma/client'

export type ActionResult = { error: string } | { success: true; id: string }

export async function createVehicle(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  const customerId = (formData.get('customerId') as string)?.trim()
  const plate = (formData.get('plate') as string)?.trim().toUpperCase()
  const make = (formData.get('make') as string)?.trim()
  const model = (formData.get('model') as string)?.trim()
  const year = parseInt(formData.get('year') as string)
  const color = (formData.get('color') as string)?.trim() || null
  const vin = (formData.get('vin') as string)?.trim() || null
  const engine = (formData.get('engine') as string)?.trim() || null
  const fuelTypeRaw = formData.get('fuelType') as string
  const fuelType = fuelTypeRaw ? (fuelTypeRaw as FuelType) : null
  const transmissionRaw = formData.get('transmission') as string
  const transmission = transmissionRaw ? (transmissionRaw as Transmission) : null
  const mileage = formData.get('mileage') ? parseInt(formData.get('mileage') as string) : null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!customerId) return { error: 'יש לבחור לקוח' }
  if (!plate) return { error: 'לוחית רישוי היא שדה חובה' }
  if (!make) return { error: 'יצרן הוא שדה חובה' }
  if (!model) return { error: 'דגם הוא שדה חובה' }
  if (!year || isNaN(year)) return { error: 'שנה היא שדה חובה' }

  try {
    const vehicle = await prisma.vehicle.create({
      data: { organizationId: orgId, customerId, plate, make, model, year, color, vin, engine, fuelType, transmission, mileage, notes },
    })
    revalidatePath('/dashboard/vehicles')
    revalidatePath(`/dashboard/customers/${customerId}`)
    return { success: true, id: vehicle.id }
  } catch (e: unknown) {
    console.error(e)
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return { error: 'לוחית רישוי זו כבר קיימת במערכת' }
    }
    return { error: 'שגיאה ביצירת רכב' }
  }
}

export async function updateVehicle(id: string, formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg()

  const plate = (formData.get('plate') as string)?.trim().toUpperCase()
  const make = (formData.get('make') as string)?.trim()
  const model = (formData.get('model') as string)?.trim()
  const year = parseInt(formData.get('year') as string)
  const color = (formData.get('color') as string)?.trim() || null
  const vin = (formData.get('vin') as string)?.trim() || null
  const engine = (formData.get('engine') as string)?.trim() || null
  const fuelTypeRaw = formData.get('fuelType') as string
  const fuelType = fuelTypeRaw ? (fuelTypeRaw as FuelType) : null
  const transmissionRaw = formData.get('transmission') as string
  const transmission = transmissionRaw ? (transmissionRaw as Transmission) : null
  const mileage = formData.get('mileage') ? parseInt(formData.get('mileage') as string) : null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!plate) return { error: 'לוחית רישוי היא שדה חובה' }
  if (!make) return { error: 'יצרן הוא שדה חובה' }
  if (!model) return { error: 'דגם הוא שדה חובה' }
  if (!year || isNaN(year)) return { error: 'שנה היא שדה חובה' }

  try {
    const vehicle = await prisma.vehicle.findFirst({ where: { id, organizationId: orgId }, select: { customerId: true } })
    await prisma.vehicle.update({
      where: { id },
      data: { plate, make, model, year, color, vin, engine, fuelType, transmission, mileage, notes },
    })
    revalidatePath('/dashboard/vehicles')
    revalidatePath(`/dashboard/vehicles/${id}`)
    if (vehicle) revalidatePath(`/dashboard/customers/${vehicle.customerId}`)
    return { success: true, id }
  } catch (e: unknown) {
    console.error(e)
    if (e instanceof Error && e.message.includes('Unique constraint')) {
      return { error: 'לוחית רישוי זו כבר קיימת במערכת' }
    }
    return { error: 'שגיאה בעדכון רכב' }
  }
}

export async function deleteVehicle(id: string): Promise<{ error?: string }> {
  const { orgId } = await requireOrg()
  try {
    const v = await prisma.vehicle.findFirst({ where: { id, organizationId: orgId }, select: { customerId: true } })
    if (!v) return { error: 'רכב לא נמצא' }
    await prisma.vehicle.delete({ where: { id } })
    revalidatePath('/dashboard/vehicles')
    revalidatePath(`/dashboard/customers/${v.customerId}`)
    return {}
  } catch (e) {
    console.error(e)
    return { error: 'לא ניתן למחוק רכב עם פקודות עבודה קיימות' }
  }
}
