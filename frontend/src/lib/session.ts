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

/**
 * One-shot flag telling login.tsx to greet the user with a specific notice
 * after a redirect, e.g. "your password was changed, please log in again".
 * Read once and immediately forgotten, so the message never lingers across
 * unrelated navigations back to /login.
 */
export type LoginRedirectNotice =
  | "password_changed"
  | "session_expired";

const LOGIN_NOTICE_KEY = "hrms_login_notice";

export function setLoginRedirectNotice(notice: LoginRedirectNotice): void {
  sessionStorage.setItem(LOGIN_NOTICE_KEY, notice);
}

export function consumeLoginRedirectNotice(): LoginRedirectNotice | null {
  const notice = sessionStorage.getItem(LOGIN_NOTICE_KEY);

  sessionStorage.removeItem(LOGIN_NOTICE_KEY);

  return notice === "password_changed" || notice === "session_expired"
    ? notice
    : null;
}

export function clearPendingPasswordRedirect(): void {
  sessionStorage.removeItem(LOGIN_NOTICE_KEY);
}
