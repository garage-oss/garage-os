import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffMember = {
  membershipId: string
  memberRole:   string
  isActive:     boolean
  joinedAt:     Date | null
  createdAt:    Date
  userId:       string
  name:         string
  email:        string
  avatarUrl:    string | null
  phone:        string | null
  department:   string | null
  position:     string | null
  lastLoginAt:  Date | null
  userIsActive: boolean
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getStaffMembers(orgId: string): Promise<StaffMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          phone: true, department: true, position: true,
          lastLoginAt: true, isActive: true,
        },
      },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  })

  return memberships.map((m) => ({
    membershipId: m.id,
    memberRole:   m.role,
    isActive:     m.isActive,
    joinedAt:     m.joinedAt,
    createdAt:    m.createdAt,
    userId:       m.user.id,
    name:         m.user.name,
    email:        m.user.email,
    avatarUrl:    m.user.avatarUrl,
    phone:        m.user.phone,
    department:   m.user.department,
    position:     m.user.position,
    lastLoginAt:  m.user.lastLoginAt,
    userIsActive: m.user.isActive,
  }))
}

export async function getStaffMember(orgId: string, membershipId: string): Promise<StaffMember | null> {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: orgId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          phone: true, department: true, position: true,
          lastLoginAt: true, isActive: true,
        },
      },
    },
  })
  if (!m) return null

  return {
    membershipId: m.id,
    memberRole:   m.role,
    isActive:     m.isActive,
    joinedAt:     m.joinedAt,
    createdAt:    m.createdAt,
    userId:       m.user.id,
    name:         m.user.name,
    email:        m.user.email,
    avatarUrl:    m.user.avatarUrl,
    phone:        m.user.phone,
    department:   m.user.department,
    position:     m.user.position,
    lastLoginAt:  m.user.lastLoginAt,
    userIsActive: m.user.isActive,
  }
}

export async function getTechnicianWorkload(orgId: string) {
  const workOrders = await prisma.workOrder.groupBy({
    by: ['assignedTechnician', 'status'],
    where: {
      organizationId: orgId,
      assignedTechnician: { not: null },
      status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_PARTS'] },
    },
    _count: { id: true },
  })

  // Aggregate by technician
  const map = new Map<string, { pending: number; inProgress: number; waitingParts: number; total: number }>()
  for (const row of workOrders) {
    const tech = row.assignedTechnician!
    if (!map.has(tech)) map.set(tech, { pending: 0, inProgress: 0, waitingParts: 0, total: 0 })
    const entry = map.get(tech)!
    const count = row._count.id
    entry.total += count
    if (row.status === 'PENDING')       entry.pending += count
    if (row.status === 'IN_PROGRESS')   entry.inProgress += count
    if (row.status === 'WAITING_PARTS') entry.waitingParts += count
  }

  return Array.from(map.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total)
}
