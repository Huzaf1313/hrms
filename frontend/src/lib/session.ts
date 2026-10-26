/**
 * The signed-in account, as cached at login.
 *
 * `login.tsx` writes the `GET /users/me` payload to `localStorage["user"]`, so
 * the full name and the employee code of whoever is logged in are already in
 * the browser. Reading them from here keeps pages from having to reach into
 * localStorage on their own.
 *
 * This is a convenience, not a security boundary - the backend still checks
 * every request.
 */
export interface SessionUser {
  id?: string;
  /** Employee code such as EMP001. Absent for admin-only accounts. */
  employee_id?: string | null;
  full_name?: string;
  email?: string;
  role?: string;
}

const USER_KEY = "user";

export function currentSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SessionUser;

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
