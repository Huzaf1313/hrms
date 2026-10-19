const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:8000/api/v1";

const TOKEN_KEY = "hrms_access_token";
const REFRESH_TOKEN_KEY = "hrms_refresh_token";

let refreshPromise: Promise<string> | null = null;

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearSession(): void {
  setAccessToken(null);
  setRefreshToken(null);
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

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiError("Session expired. Please log in again.", 401);
  }

  if (!refreshPromise) {
    refreshPromise = requestRaw<{
      access_token: string;
      refresh_token: string;
      token_type: string;
    }>("/auth/refresh", {
      method: "POST",
      body: {
        refresh_token: refreshToken,
      },
    })
      .then((response) => {
        setAccessToken(response.access_token);
        setRefreshToken(response.refresh_token);

        return response.access_token;
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and that the backend is running.",
      0,
    );
  }

  const payload = await response.json().catch(() => null);

if (!response.ok) {
  if (response.status === 401) {
    try {
      const newAccessToken = await refreshAccessToken();

      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newAccessToken}`,
      };

      const retryResponse = await fetch(url.toString(), {
        method,
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const retryPayload = await retryResponse.json().catch(() => null);

      if (!retryResponse.ok) {
        const retryMessage =
          retryPayload?.detail ??
          retryPayload?.message ??
          `Request failed with status ${retryResponse.status}`;

        throw new ApiError(retryMessage, retryResponse.status);
      }

      if (!retryPayload) {
        throw new ApiError(
          "Received an empty response from the server.",
          retryResponse.status,
        );
      }

      if (
        typeof retryPayload === "object" &&
        retryPayload !== null &&
        "data" in retryPayload &&
        "success" in retryPayload
      ) {
        return retryPayload.data as T;
      }

      return retryPayload as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        "Session expired. Please log in again.",
        401,
      );
    }
  }

  const message =
    payload?.detail ??
    payload?.message ??
    `Request failed with status ${response.status}`;

  throw new ApiError(message, response.status);
}

if (!payload) {
  throw new ApiError(
    "Received an empty response from the server.",
    response.status,
  );
}

// Support both API envelope responses and direct FastAPI responses.
if (
  typeof payload === "object" &&
  payload !== null &&
  "data" in payload &&
  "success" in payload
) {
  return payload.data as T;
}

return payload as T;
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (payload !== null && typeof payload === "object" && "data" in payload && "success" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

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

async function requestForm<T>(
  path: string,
  options: FormRequestOptions,
): Promise<T> {
  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      return await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? "POST",
        headers,
        body: options.body,
      });
    } catch {
      throw new ApiError(
        "Could not reach the server. Check your connection and that the backend is running.",
        0,
      );
    }
  };

  let response: Response = await send(getAccessToken());

  // Access tokens are short lived. Refresh once and replay, matching the
  // behaviour of request(), so an expired token never blocks a multipart post.
  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();

    response = await send(newAccessToken);
  }

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
// a refresh token there throws "Session expired" and throws away the real
// message the server sent.
async function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = getAccessToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and that the backend is running.",
      0,
    );
  }

  const payload = await response.json().catch(() => null);
  
  if (!response.ok) {
    const message = errorMessage(payload, response.status);
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const apiRaw = {
  post: <T>(path: string, body?: unknown) =>
    requestRaw<T>(path, { method: "POST", body }),
};

export async function downloadFile(path: string): Promise<Blob> {
  const url = new URL(`${API_BASE_URL}${path}`);

  const makeRequest = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      return await fetch(url.toString(), {
        method: "GET",
        headers,
      });
    } catch {
      throw new ApiError(
        "Could not reach the server. Check your connection and that the backend is running.",
        0,
      );
    }
  };

  let response = await makeRequest(getAccessToken());

  if (response.status === 401) {
    try {
      const newAccessToken = await refreshAccessToken();
      response = await makeRequest(newAccessToken);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        "Session expired. Please log in again.",
        401,
      );
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    const message =
      payload?.detail ??
      payload?.message ??
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status);
  }

  return response.blob();
}
