import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { departmentService, type DepartmentCreate } from "../services/departmentService";
import type { Department } from "../types/department";
import { queryKeys } from "../lib/queryKeys";

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: queryKeys.reference.departments(),
    queryFn: () => departmentService.listAll(),
    staleTime: 10 * 60 * 1000, // 10 minutes (static reference data)
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DepartmentCreate) => departmentService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.departments(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboardMetrics(),
      });
    },
  });
}
