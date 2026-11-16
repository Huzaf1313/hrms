import { apiRaw, clearSession, markSessionActive } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
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

export const authService = {
  async login(data: LoginPayload) {
    const tokens = await apiRaw.post<TokenResponse>("/auth/login", data);

    // The session lives in HttpOnly cookies the server just set.
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

};