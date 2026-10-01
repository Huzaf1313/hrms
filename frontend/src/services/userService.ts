import { api } from "./api";

export interface ManagerAccount {
  id: string;
  full_name: string;
  email: string;
  role: "hr_admin" | "manager";
}

export const userService = {
  listManagers() {
    return api.get<ManagerAccount[]>("/users/managers");
  },
};
