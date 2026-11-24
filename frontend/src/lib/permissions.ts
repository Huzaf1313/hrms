/**
 * Role-Based Access Control (RBAC) & Permissions Engine
 * Roles: employee | manager | hr_admin | super_admin
 */

export type UserRole = "employee" | "manager" | "hr_admin" | "super_admin";

export type PermissionAction =
  // Attendance actions
  | "attendance:check_in"
  | "attendance:check_out"
  | "attendance:view_own"
  | "attendance:view_team"
  | "attendance:view_org"
  | "attendance:regularize_own"
  | "attendance:approve_regularization"
  | "attendance:reject_regularization"
  | "attendance:override"
  | "attendance:bulk_mark"
  | "attendance:export_reports"
  | "attendance:manage_shifts"
  // Leave actions
  | "leave:apply_own"
  | "leave:cancel_own"
  | "leave:view_own"
  | "leave:view_team"
  | "leave:view_org"
  | "leave:approve"
  | "leave:reject"
  | "leave:bulk_approve"
  | "leave:manage_types"
  | "leave:manage_balances"
  | "leave:export";

const ROLE_PERMISSIONS: Record<UserRole, Set<PermissionAction>> = {
  employee: new Set([
    "attendance:check_in",
    "attendance:check_out",
    "attendance:view_own",
    "attendance:regularize_own",
    "leave:apply_own",
    "leave:cancel_own",
    "leave:view_own",
  ]),

  manager: new Set([
    // Employee self-service actions
    "attendance:check_in",
    "attendance:check_out",
    "attendance:view_own",
    "attendance:regularize_own",
    "leave:apply_own",
    "leave:cancel_own",
    "leave:view_own",
    // Manager team actions (direct reports)
    "attendance:view_team",
    "attendance:approve_regularization",
    "attendance:reject_regularization",
    "leave:view_team",
    "leave:approve",
    "leave:reject",
    "leave:bulk_approve",
  ]),

  hr_admin: new Set([
    // Full attendance capabilities
    "attendance:check_in",
    "attendance:check_out",
    "attendance:view_own",
    "attendance:view_team",
    "attendance:view_org",
    "attendance:regularize_own",
    "attendance:approve_regularization",
    "attendance:reject_regularization",
    "attendance:override",
    "attendance:bulk_mark",
    "attendance:export_reports",
    "attendance:manage_shifts",
    // Full leave capabilities
    "leave:apply_own",
    "leave:cancel_own",
    "leave:view_own",
    "leave:view_team",
    "leave:view_org",
    "leave:approve",
    "leave:reject",
    "leave:bulk_approve",
    "leave:manage_types",
    "leave:manage_balances",
    "leave:export",
  ]),

  super_admin: new Set([
    // Super admin has every permission
    "attendance:check_in",
    "attendance:check_out",
    "attendance:view_own",
    "attendance:view_team",
    "attendance:view_org",
    "attendance:regularize_own",
    "attendance:approve_regularization",
    "attendance:reject_regularization",
    "attendance:override",
    "attendance:bulk_mark",
    "attendance:export_reports",
    "attendance:manage_shifts",
    "leave:apply_own",
    "leave:cancel_own",
    "leave:view_own",
    "leave:view_team",
    "leave:view_org",
    "leave:approve",
    "leave:reject",
    "leave:bulk_approve",
    "leave:manage_types",
    "leave:manage_balances",
    "leave:export",
  ]),
};

/**
 * Single source of truth for authorization.
 * Returns true if the given role is allowed to perform the given action.
 */
export function can(role: string | null | undefined, action: PermissionAction): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase() as UserRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.has(action);
}

/**
 * Helper to fetch current user's role from localStorage session.
 */
export function getCurrentRole(): UserRole {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "employee";
    const parsed = JSON.parse(raw) as { role?: string };
    const role = (parsed.role ?? "employee").toLowerCase();
    if (["employee", "manager", "hr_admin", "super_admin"].includes(role)) {
      return role as UserRole;
    }
    return "employee";
  } catch {
    return "employee";
  }
}

/**
 * Convenient shorthand for checking permissions on the currently logged-in user.
 */
export function canCurrentUser(action: PermissionAction): boolean {
  return can(getCurrentRole(), action);
}

/**
 * Route access validation for attendance and leave modules.
 */
export function canAccessRoute(role: string | null | undefined, pathname: string): boolean {
  if (!role) return false;
  const r = role.toLowerCase() as UserRole;

  if (pathname.startsWith("/employee/")) {
    // All logged in roles can access self-service employee portal
    return true;
  }

  if (pathname.startsWith("/dashboard/attendance") || pathname.startsWith("/dashboard/leave") || pathname.startsWith("/dashboard/regularization")) {
    // Only manager, hr_admin, super_admin can access the dashboard management views
    return r === "manager" || r === "hr_admin" || r === "super_admin";
  }

  return true;
}
