import { api } from "./api";

export interface ManagerAccount {
  id: string;
  full_name: string;
  email: string;
  role: "hr_admin" | "manager";
}

/** Roles the super admin can create and manage. */
export type ManagedAdminRole = "hr_admin" | "manager";

/** An HR admin or manager account as the super admin sees it. */
export interface AdminAccount {
  id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  role: ManagedAdminRole;
  /** False after deactivation: the account cannot sign in. */
  is_active: boolean;
  /** Set by the super admin or by repeated failed logins. Blocks sign-in
   *  until unlocked. */
  is_locked: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** Only present on the create response. */
  welcome_email_sent?: boolean | null;
}

/** Body of POST /users/admin-accounts. The role cannot be super_admin; the
 *  server only accepts these two. */
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
  /** Seconds to wait before asking for another code. */
  cooldown_seconds: number;
}

export interface AdminEmailOtpVerifyResponse {
  message: string;
  email: string;
  /** Proof the email was verified. Pass it as email_verification_token on
   *  the create; it is tied to this email and used up by that create. */
  verification_token: string;
  expires_in_minutes: number;
}

/** Send only the field being changed; omitted fields are left as they are. */
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

  /** Step 1 of creating an account: email a code to the new address. Fails
   *  if an account already uses that email. */
  requestAdminEmailOtp(email: string) {
    return api.post<AdminEmailOtpRequestResponse>(
      "/users/admin-accounts/request-email-otp",
      { email },
    );
  },

  /** Step 2: exchange the code for a verification token. */
  verifyAdminEmailOtp(email: string, otp: string) {
    return api.post<AdminEmailOtpVerifyResponse>(
      "/users/admin-accounts/verify-email-otp",
      { email, otp },
    );
  },

  /** Step 3: create the account. The server also sends a welcome email
   *  (sign-in link only, no password) and reports whether it went out. */
  createAdminAccount(data: AdminAccountCreate) {
    return api.post<AdminAccount>("/users/admin-accounts", data);
  },

  /** Lock / unlock or deactivate / activate. Locking or deactivating revokes
   *  every session of that account on the server. */
  updateAdminAccountStatus(id: string, data: AdminAccountStatusUpdate) {
    return api.patch<AdminAccount>(`/users/admin-accounts/${id}/status`, data);
  },
};
