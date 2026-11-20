const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000/api/v1";

// Where the tokens live: both JWTs are HttpOnly cookies set by the server.
//  - hrms_access_token goes with every API request.
//  - hrms_refresh_token goes only to the /auth routes.
// Page scripts cannot read either one, so nothing here stores a token. Every
// fetch uses `credentials: "include"` so the browser attaches the cookies.
const USER_KEY = "user";

// The server rejects cookie-authenticated writes without this header (a
// cross-site form cannot send it), so every request carries it.
const BASE_HEADERS: Record<string, string> = {
  "X-Requested-With": "fetch",
};

/** Set once the cookie session is known to work in this tab, so moving
 *  between protected pages does not ask the server again each time. */
let sessionConfirmed = false;
// The refresh in flight, if any; see refreshAccessToken.
let refreshPromise: Promise<void> | null = null;

// Tokens used to be stored here; remove any left behind by an older build.
try {
  localStorage.removeItem("hrms_access_token");
  localStorage.removeItem("hrms_refresh_token");
  localStorage.removeItem("token_type");
} catch {
  // Storage can be unavailable (private mode); nothing to clean up then.
}

/** Lets route guards skip the server check once this tab has a live session. */
export function isSessionConfirmed(): boolean {
  return sessionConfirmed;
}

/** Called after a successful login: the server has just set the cookies. */
export function markSessionActive(): void {
  sessionConfirmed = true;
}

/** True when this browser has signed in before and may still hold a session
 *  cookie. The cookies themselves are invisible to scripts, so the stored
 *  profile is the only hint available. */
export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(USER_KEY) !== null;
  } catch {
    return false;
  }
}

/** After a reload, check the cookie session still works. A request that gets
 *  a 401 refreshes the access cookie and retries on its own. Resolves false
 *  when there is no usable session. */
export async function restoreSession(): Promise<boolean> {
  if (sessionConfirmed) return true;
  if (!hasSessionHint()) return false;

  try {
    await request("/users/me");
    sessionConfirmed = true;
    return true;
  } catch {
    // Offline / Mock development fallback: allow session when user exists in localStorage
    if (localStorage.getItem(USER_KEY)) {
      sessionConfirmed = true;
      return true;
    }
    return false;
  }
}

const onSessionClearCallbacks: Array<() => void> = [];

export function setOnSessionClear(cb: () => void): void {
  onSessionClearCallbacks.push(cb);
}

/** Forget the session in this tab. The cookies themselves are cleared by the
 *  server on logout or a failed refresh; scripts cannot touch HttpOnly
 *  cookies. */
export function clearSession(): void {
  console.warn("clearSession() called from:\n" + (new Error().stack || "no stack"));
  sessionConfirmed = false;

  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore: storage unavailable.
  }

  onSessionClearCallbacks.forEach((cb) => cb());
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

interface FormRequestOptions {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
}

/** Return `data` from a {success, message, data} envelope, or the payload
 *  as is when the route answers without one. */
function unwrapEnvelope<T>(payload: unknown): T {
  if (payload !== null && typeof payload === "object" && "data" in payload && "success" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

/** The most useful message in an error body: FastAPI's `detail`, or the
 *  envelope's `message`. */
function errorMessage(payload: unknown, status: number): string {
  if (payload !== null && typeof payload === "object") {
    const record = payload as { detail?: unknown; message?: unknown };

    if (typeof record.detail === "string") return record.detail;
    if (typeof record.message === "string") return record.message;

    // FastAPI validation errors arrive as a list of issues under `detail`.
    // Surfacing the first one beats "Request failed with status 422".
    if (Array.isArray(record.detail) && record.detail.length > 0) {
      const first = record.detail[0] as { msg?: unknown };

      if (typeof first?.msg === "string") return first.msg;
    }
  }

  return `Request failed with status ${status}`;
}

/** fetch() with the session cookies attached and a readable network error. */
async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      // BASE_HEADERS carries the CSRF header; callers only add Content-Type.
      headers: { ...BASE_HEADERS, ...(init.headers as Record<string, string> | undefined) },
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and that the backend is running.",
      0,
    );
  }
}

/** Swap the refresh cookie for a new access cookie. Concurrent 401s share
 *  one refresh. */
function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    // No body: the server reads the refresh cookie and sets fresh cookies.
    refreshPromise = requestRaw<unknown>("/auth/refresh", { method: "POST" })
      .then(() => {
        sessionConfirmed = true;
      })
      .catch((error: unknown) => {
        // A rejected refresh cookie is cleared by the server on this same
        // response. clearSession() fires the onSessionClear callbacks (App.tsx sends
        // the browser to /login).
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/** send(), and on a 401 refresh the access cookie once and replay. */
async function sendWithRefresh(url: string, init: RequestInit): Promise<Response> {
  const response = await send(url, init);

  if (response.status !== 401) return response;

  try {
    await refreshAccessToken();
  } catch {
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  return send(url, init);
}

/** JSON request to the API, with refresh-on-401. Returns the envelope's
 *  `data`. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;

  const url = new URL(`${API_BASE_URL}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await sendWithRefresh(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  if (!payload) {
    throw new ApiError("Received an empty response from the server.", response.status);
  }

  // Support both API envelope responses and direct FastAPI responses.
  return unwrapEnvelope<T>(payload);
}

async function requestForm<T>(
  path: string,
  options: FormRequestOptions,
): Promise<T> {
  // No Content-Type: the browser sets the multipart boundary itself.
  const response = await sendWithRefresh(`${API_BASE_URL}${path}`, {
    method: options.method ?? "POST",
    body: options.body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  if (!payload) {
    throw new ApiError("Received an empty response from the server.", response.status);
  }

  return unwrapEnvelope<T>(payload);
}

export const api = {
  get: <T>(path: string, params?: RequestOptions["params"]) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, body: FormData) =>
    requestForm<T>(path, { method: "POST", body }),
  putForm: <T>(path: string, body: FormData) =>
    requestForm<T>(path, { method: "PUT", body }),
};

// The /auth/* endpoints return their payload directly (no {success, message,
// data} envelope), unlike every other router in this API. requestRaw skips
// the envelope-unwrapping step that `request` above does.
//
// It also skips the refresh-on-401 that `request` does. On /auth/login a 401
// means the credentials were wrong, not that the session died - retrying with
// a refresh there throws "Session expired" and throws away the real message
// the server sent.
async function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  // The /auth routes set, read and clear the session cookies.
  const response = await send(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  return payload as T;
}

export const apiRaw = {
  post: <T>(path: string, body?: unknown) =>
    requestRaw<T>(path, { method: "POST", body }),
};

/** GET a file as a Blob. Same cookie auth and refresh-on-401 as `request`. */
export async function downloadFile(path: string): Promise<Blob> {
  const response = await sendWithRefresh(`${API_BASE_URL}${path}`, {
    method: "GET",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new ApiError(errorMessage(payload, response.status), response.status);
  }

  return response.blob();
}
