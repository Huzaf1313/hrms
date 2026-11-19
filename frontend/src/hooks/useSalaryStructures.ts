import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  salaryStructureService,
  type SalaryStructure,
  type SalaryStructureInput,
} from "../modules/payroll/admin_salary_structure_service";
import { queryKeys } from "../lib/queryKeys";

export function useSalaryStructures() {
  return useQuery<SalaryStructure[]>({
    queryKey: queryKeys.reference.salaryStructures(),
    queryFn: () => salaryStructureService.list(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCreateSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SalaryStructureInput) =>
      salaryStructureService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.salaryStructures(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SalaryStructureInput>;
    }) => salaryStructureService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.salaryStructures(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}

export function useDeleteSalaryStructure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => salaryStructureService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reference.salaryStructures(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
    },
  });
}
