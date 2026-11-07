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
}

export interface AdminAccountCreate {
  full_name: string;
  email: string;
  password: string;
  role: ManagedAdminRole;
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

  createAdminAccount(data: AdminAccountCreate) {
    return api.post<AdminAccount>("/users/admin-accounts", data);
  },

  updateAdminAccountStatus(id: string, data: AdminAccountStatusUpdate) {
    return api.patch<AdminAccount>(`/users/admin-accounts/${id}/status`, data);
  },
};
