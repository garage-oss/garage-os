import { MemberRole } from '@prisma/client'

// ─── Module / Permission types ────────────────────────────────────────────────

export type AppModule =
  | 'customers'
  | 'vehicles'
  | 'workOrders'
  | 'inventory'
  | 'suppliers'
  | 'quotes'
  | 'diagnostics'
  | 'media'
  | 'reports'
  | 'settings'
  | 'users'
  | 'audit'
  | 'kpi'
  | 'intake'
  | 'mobile'
  | 'clock'

export type AppPermission = 'read' | 'create' | 'update' | 'delete'

type ModulePermissions = Partial<Record<AppModule, AppPermission[]>>

// ─── Permissions matrix ───────────────────────────────────────────────────────
// Rows = roles, Columns = modules, Values = allowed actions

const FULL: AppPermission[] = ['read', 'create', 'update', 'delete']
const RCU:  AppPermission[] = ['read', 'create', 'update']
const RU:   AppPermission[] = ['read', 'update']
const RC:   AppPermission[] = ['read', 'create']
const R:    AppPermission[] = ['read']
const NONE: AppPermission[] = []

export const ROLE_PERMISSIONS: Record<MemberRole, ModulePermissions> = {
  // ── Owner: unrestricted access to everything ──────────────────────────────
  OWNER: {
    customers:   FULL,
    vehicles:    FULL,
    workOrders:  FULL,
    inventory:   FULL,
    suppliers:   FULL,
    quotes:      FULL,
    diagnostics: FULL,
    media:       FULL,
    reports:     R,
    settings:    ['read', 'update'],
    users:       FULL,
    audit:       R,
    kpi:         R,
    intake:      RC,
    mobile:      R,
    clock:       FULL,
  },

  // ── Manager: full ops, can invite/manage team (not delete members) ─────────
  MANAGER: {
    customers:   FULL,
    vehicles:    FULL,
    workOrders:  FULL,
    inventory:   RCU,
    suppliers:   RCU,
    quotes:      FULL,
    diagnostics: FULL,
    media:       FULL,
    reports:     R,
    settings:    ['read', 'update'],
    users:       RCU,
    audit:       R,
    kpi:         R,
    intake:      RC,
    mobile:      R,
    clock:       FULL,
  },

  // ── Service Advisor: customer-facing, no finance/settings ────────────────
  SERVICE_ADVISOR: {
    customers:   RCU,
    vehicles:    RCU,
    workOrders:  RCU,
    inventory:   R,
    suppliers:   NONE,
    quotes:      RCU,
    diagnostics: RC,
    media:       RC,
    reports:     NONE,
    settings:    NONE,
    users:       NONE,
    audit:       NONE,
    kpi:         NONE,
    intake:      RC,
    mobile:      NONE,
    clock:       RC,
  },

  // ── Technician: shop floor — work orders, diagnostics, media only ─────────
  TECHNICIAN: {
    customers:   R,
    vehicles:    RU,
    workOrders:  RU,
    inventory:   R,
    suppliers:   NONE,
    quotes:      NONE,
    diagnostics: RC,
    media:       RC,
    reports:     NONE,
    settings:    NONE,
    users:       NONE,
    audit:       NONE,
    kpi:         NONE,
    intake:      NONE,
    mobile:      R,
    clock:       RC,
  },

  // ── Accountant: financial read + quotes, no shop operations ──────────────
  ACCOUNTANT: {
    customers:   R,
    vehicles:    R,
    workOrders:  R,
    inventory:   R,
    suppliers:   R,
    quotes:      RCU,
    diagnostics: NONE,
    media:       R,
    reports:     R,
    settings:    NONE,
    users:       NONE,
    audit:       R,
    kpi:         R,
    intake:      NONE,
    mobile:      NONE,
    clock:       NONE,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the role has the given permission on a module. */
export function hasPermission(
  role: MemberRole,
  module: AppModule,
  permission: AppPermission
): boolean {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(permission) ?? false
}

/** Returns true if the role has any access to the module (at least read). */
export function canAccess(role: MemberRole, module: AppModule): boolean {
  return (ROLE_PERMISSIONS[role]?.[module]?.length ?? 0) > 0
}

/** Returns true if the role is administrative (OWNER or MANAGER). */
export function isAdmin(role: MemberRole): boolean {
  return role === 'OWNER' || role === 'MANAGER'
}

/** Returns all modules a role can read. Useful for sidebar generation. */
export function accessibleModules(role: MemberRole): AppModule[] {
  return (Object.keys(ROLE_PERMISSIONS[role]) as AppModule[]).filter((m) =>
    canAccess(role, m)
  )
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const MODULE_LABELS: Record<AppModule, string> = {
  customers:   'לקוחות',
  vehicles:    'רכבים',
  workOrders:  'פקודות עבודה',
  inventory:   'מלאי',
  suppliers:   'ספקים',
  quotes:      'הצעות מחיר',
  diagnostics: 'אבחון AI',
  media:       'מדיה',
  reports:     'דוחות',
  settings:    'הגדרות',
  users:       'צוות',
  audit:       'יומן פעולות',
  kpi:         'לוח KPI',
  intake:      'קבלת רכב',
  mobile:      'מצב טכנאי',
  clock:       'שעון נוכחות',
}

export const PERMISSION_LABELS: Record<AppPermission, string> = {
  read:   'צפייה',
  create: 'יצירה',
  update: 'עריכה',
  delete: 'מחיקה',
}
