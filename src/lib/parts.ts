import { prisma } from '@/lib/prisma'
import { toNum } from '@/lib/utils'

export type PartSummary = {
  id: string
  sku: string
  name: string
  category: string | null
  manufacturer: string | null
  costPrice: number
  salePrice: number
  quantity: number
  minQuantity: number
  location: string | null
  isLowStock: boolean
  supplier: { id: string; name: string } | null
}

export type PartDetail = PartSummary & {
  notes: string | null
  stockMovements: {
    id: string
    type: string
    quantity: number
    reason: string | null
    createdAt: Date
  }[]
  _count: { items: number }
}

export async function getParts(filters?: { search?: string; category?: string; lowStock?: boolean }) {
  const parts = await prisma.part.findMany({
    where: {
      AND: [
        filters?.search
          ? {
              OR: [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { sku: { contains: filters.search, mode: 'insensitive' } },
                { manufacturer: { contains: filters.search, mode: 'insensitive' } },
              ],
            }
          : {},
        filters?.category ? { category: filters.category } : {},
      ],
    },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })

  return parts
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      manufacturer: p.manufacturer,
      costPrice: toNum(p.costPrice),
      salePrice: toNum(p.salePrice),
      quantity: p.quantity,
      minQuantity: p.minQuantity,
      location: p.location,
      isLowStock: p.quantity <= p.minQuantity,
      supplier: p.supplier,
    }))
    .filter((p) => (filters?.lowStock ? p.isLowStock : true))
}

export async function getPart(id: string): Promise<PartDetail | null> {
  const p = await prisma.part.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 50 },
      _count: { select: { items: true } },
    },
  })
  if (!p) return null
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    manufacturer: p.manufacturer,
    costPrice: toNum(p.costPrice),
    salePrice: toNum(p.salePrice),
    quantity: p.quantity,
    minQuantity: p.minQuantity,
    location: p.location,
    isLowStock: p.quantity <= p.minQuantity,
    notes: p.notes,
    supplier: p.supplier,
    stockMovements: p.stockMovements,
    _count: p._count,
  }
}

export async function getLowStockParts() {
  const parts = await prisma.part.findMany({
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { quantity: 'asc' },
  })
  return parts
    .filter((p) => p.quantity <= p.minQuantity)
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      minQuantity: p.minQuantity,
      salePrice: toNum(p.salePrice),
      supplier: p.supplier,
    }))
}

export async function getInventoryValue() {
  const parts = await prisma.part.findMany({ select: { quantity: true, costPrice: true, salePrice: true } })
  const costValue = parts.reduce((s, p) => s + p.quantity * toNum(p.costPrice), 0)
  const saleValue = parts.reduce((s, p) => s + p.quantity * toNum(p.salePrice), 0)
  return { costValue, saleValue, partsCount: parts.length }
}

export async function getPartCategories() {
  const cats = await prisma.part.findMany({ select: { category: true }, distinct: ['category'] })
  return cats.map((c) => c.category).filter(Boolean) as string[]
}
