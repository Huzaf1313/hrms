import { api } from "./api";

export interface ManagerAccount {
  id: string;
  full_name: string;
  email: string;
  role: "hr_admin" | "manager";
}

/** Roles the super admin can create and manage. */
export type ManagedAdminRole = "hr_admin" | "manager";

export interface AdminAccount {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  role: ManagedAdminRole;
  is_active: boolean;
  is_locked: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** Only present on the create response. */
  welcome_email_sent?: boolean | null;
}

export interface AdminAccountCreate {
  full_name: string;
  email: string;
  password: string;
  role: ManagedAdminRole;
  /** From verifyAdminEmailOtp. The server rejects a create without it. */
  email_verification_token?: string;
}

export interface AdminEmailOtpRequestResponse {
  message: string;
  expires_in_minutes: number;
  cooldown_seconds: number;
}

export interface AdminEmailOtpVerifyResponse {
  message: string;
  email: string;
  verification_token: string;
  expires_in_minutes: number;
}

export interface AdminAccountStatusUpdate {
  is_active?: boolean;
  is_locked?: boolean;
}

export const userService = {
  listManagers() {
    return api.get<ManagerAccount[]>("/users/managers");
  },

  // Super admin only.
  listAdminAccounts() {
    return api.get<AdminAccount[]>("/users/admin-accounts");
  },

  requestAdminEmailOtp(email: string) {
    return api.post<AdminEmailOtpRequestResponse>(
      "/users/admin-accounts/request-email-otp",
      { email },
    );
  },

  verifyAdminEmailOtp(email: string, otp: string) {
    return api.post<AdminEmailOtpVerifyResponse>(
      "/users/admin-accounts/verify-email-otp",
      { email, otp },
    );
  },

  createAdminAccount(data: AdminAccountCreate) {
    return api.post<AdminAccount>("/users/admin-accounts", data);
  },

  updateAdminAccountStatus(id: string, data: AdminAccountStatusUpdate) {
    return api.patch<AdminAccount>(`/users/admin-accounts/${id}/status`, data);
  },
};
