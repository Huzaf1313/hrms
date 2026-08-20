import { api } from "./api";
import type { Department } from "../types/department";

export const departmentService = {
  list() {
    return api.get<Department[]>("/departments");
  },
};