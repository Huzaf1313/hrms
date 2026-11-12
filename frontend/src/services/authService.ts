import { apiRaw, clearSession, setAccessToken } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

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

    setAccessToken(tokens.access_token);

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