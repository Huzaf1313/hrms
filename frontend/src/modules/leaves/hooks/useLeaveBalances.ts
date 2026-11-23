import { useState, useEffect, useCallback } from "react";
import { leaveService, type EmployeeLeaveBalance } from "../services/leaveService";

export function useLeaveBalances(employeeId: string) {
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    leaveService
      .getEmployeeBalances(employeeId)
      .then((res) => {
        setBalances(res.data);
        setIsSampleData(res.isSampleData);
      })
      .catch((err: Error) => {
        setError(err.message || "Failed to load leave balances");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [employeeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { balances, isLoading, isSampleData, error, reload };
}
