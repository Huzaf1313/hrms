/**
 * Client-side role helpers.
 *
 * These drive what the UI shows. They are not a security boundary - every
 * route is also enforced on the backend by permission checks, and a manager
 * hitting an HR-only endpoint directly gets a 403.
 */

export const HR_ONLY_PAGES = ["Recruitment", "Payroll", "Exit Requests"];

export function currentRole(): string | null {
  try {
    const raw = localStorage.getItem("user");

    if (!raw) return null;

    return (JSON.parse(raw) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

/** Pages only the super admin may open. */
export const SUPER_ADMIN_ONLY_PAGES = ["Admin Accounts"];

/** Roles that use the admin portal. */
export const ADMIN_ROLES = ["super_admin", "hr_admin", "manager"];

/** The one account that manages the HR admin and manager accounts. The
 *  matching endpoints check require_super_admin on the server. */
export function isSuperAdmin(): boolean {
  return currentRole() === "super_admin";
}

/**
 * HR-level access: HR itself, and the super admin, who holds every HR
 * permission on top of managing the HR and manager accounts.
 */
export function isHrAdmin(): boolean {
  const role = currentRole();

  return role === "hr_admin" || role === "super_admin";
}

/** May open the admin portal at all (AdminRoute). */
export function isAdminRole(): boolean {
  return ADMIN_ROLES.includes(currentRole() ?? "");
}

/**
 * Whether the current account may open an admin-portal page, by its sidebar
 * label. Used to filter the sidebar and to bounce a typed URL back to the
 * dashboard.
 */
export function canAccessPage(page: string): boolean {
  // Checked first: super admin pages are closed even to HR.
  if (SUPER_ADMIN_ONLY_PAGES.includes(page)) return isSuperAdmin();

  return !HR_ONLY_PAGES.includes(page) || isHrAdmin();
}

/** Human label for a stored role value. */
export function roleLabel(role?: string | null): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "hr_admin":
      return "HR";
    case "manager":
      return "Manager";
    case "employee":
      return "Employee";
    default:
      // An unknown role still reads as words rather than a snake_case key.
      return role ? role.replaceAll("_", " ") : "";
  }
}