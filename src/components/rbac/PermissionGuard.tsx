'use client'

import { MemberRole } from '@prisma/client'
import { hasPermission, canAccess, isAdmin, AppModule, AppPermission } from '@/lib/rbac'

interface PermissionGuardProps {
  role:       MemberRole
  module:     AppModule
  permission: AppPermission
  children:   React.ReactNode
  fallback?:  React.ReactNode
}

/**
 * Client-side conditional renderer based on RBAC permissions.
 * Renders children only if the role has the given permission on the module.
 */
export function PermissionGuard({ role, module, permission, children, fallback = null }: PermissionGuardProps) {
  if (!hasPermission(role, module, permission)) return <>{fallback}</>
  return <>{children}</>
}

// ── Convenience components ────────────────────────────────────────────────────

interface AdminGuardProps {
  role:      MemberRole
  children:  React.ReactNode
  fallback?: React.ReactNode
}

/** Renders children only for OWNER or MANAGER. */
export function AdminGuard({ role, children, fallback = null }: AdminGuardProps) {
  if (!isAdmin(role)) return <>{fallback}</>
  return <>{children}</>
}

interface OwnerGuardProps {
  role:      MemberRole
  children:  React.ReactNode
  fallback?: React.ReactNode
}

/** Renders children only for OWNER. */
export function OwnerGuard({ role, children, fallback = null }: OwnerGuardProps) {
  if (role !== 'OWNER') return <>{fallback}</>
  return <>{children}</>
}
