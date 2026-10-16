import { apiRaw, clearSession, setAccessToken, setRefreshToken } from "./api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
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

export const authService = {
  async login(data: LoginPayload) {
    const tokens = await apiRaw.post<TokenResponse>("/auth/login", data);

    setAccessToken(tokens.access_token);
    setRefreshToken(tokens.refresh_token);

    return tokens;
  },

  async logout(refreshToken: string) {
    try {
      await apiRaw.post("/auth/logout", { refresh_token: refreshToken });
    } finally {
      clearSession();
    }
  },
};