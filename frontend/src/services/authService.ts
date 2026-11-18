import { api, apiRaw, clearSession, markSessionActive } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone_number: string;
  password: string;
  company_name?: string;
  company_address?: string;
  reference?: string;
}

/** Body of POST /auth/login. The access token is echoed here for API
 *  clients such as Swagger; the web app relies on the cookies instead, and
 *  the refresh token is never in the body. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UserSession {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_used_at: string;
  is_current: boolean;
}

export interface LoginHistoryRecord {
  id: string;
  email: string;
  ip_address: string | null;
  user_agent: string | null;
  status: "success" | "failed" | "blocked";
  failure_reason: string | null;
  created_at: string;
}

export const authService = {
  async login(data: LoginPayload) {
    const tokens = await apiRaw.post<TokenResponse>("/auth/login", data);

    // The session lives in HttpOnly cookies the server just set.
    markSessionActive();

    return tokens;
  },

  async register(data: RegisterPayload) {
    const tokens = await apiRaw.post<TokenResponse>("/auth/register", data);

    markSessionActive();

    return tokens;
  },

  /** Revokes the session and clears its cookie on the server. */
  async logout() {
    try {
      await apiRaw.post("/auth/logout");
    } catch {
      // Signing out locally must work even when the server is unreachable.
    } finally {
      clearSession();
    }
  },

  async changePassword(data: ChangePasswordPayload) {
    return apiRaw.post("/auth/change-password", data);
  },

  async getSessions(): Promise<UserSession[]> {
    return api.get<UserSession[]>("/auth/sessions");
  },

  async revokeSession(sessionId: string): Promise<void> {
    return api.delete(`/auth/sessions/${sessionId}`);
  },

  async revokeOtherSessions(): Promise<void> {
    return api.post("/auth/sessions/revoke-others", {});
  },

  async getLoginHistory(): Promise<LoginHistoryRecord[]> {
    return api.get<LoginHistoryRecord[]>("/auth/login-history");
  },
};