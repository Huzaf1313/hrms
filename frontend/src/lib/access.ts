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

export function isHrAdmin(): boolean {
  return currentRole() === "hr_admin";
}

export function isAdminRole(): boolean {
  return currentRole() === "hr_admin" || currentRole() === "manager";
}

export function canAccessPage(page: string): boolean {
  return !HR_ONLY_PAGES.includes(page) || isHrAdmin();
}