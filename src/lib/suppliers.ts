import { prisma } from '@/lib/prisma'
import { toNum } from '@/lib/utils'

export type SupplierSummary = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  _count: { parts: number }
}

export type SupplierDetail = SupplierSummary & {
  notes: string | null
  createdAt: Date
  parts: {
    id: string
    sku: string
    name: string
    category: string | null
    quantity: number
    minQuantity: number
    salePrice: number
    isLowStock: boolean
  }[]
}

export async function getSuppliers(search?: string): Promise<SupplierSummary[]> {
  const suppliers = await prisma.supplier.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { contactName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: { _count: { select: { parts: true } } },
    orderBy: { name: 'asc' },
  })
  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    address: s.address,
    _count: s._count,
  }))
}

export async function getSupplier(id: string): Promise<SupplierDetail | null> {
  const s = await prisma.supplier.findUnique({
    where: { id },
    include: {
      parts: { orderBy: { name: 'asc' } },
      _count: { select: { parts: true } },
    },
  })
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    address: s.address,
    notes: s.notes,
    createdAt: s.createdAt,
    _count: s._count,
    parts: s.parts.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      minQuantity: p.minQuantity,
      salePrice: toNum(p.salePrice),
      isLowStock: p.quantity <= p.minQuantity,
    })),
  }
}
