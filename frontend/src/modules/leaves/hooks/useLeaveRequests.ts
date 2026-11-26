import { useState, useEffect, useCallback, useMemo } from "react";
import { leaveService, type LeaveRequest, type LeaveStatus } from "../services/leaveService";
import { useToast } from "../../../components/ui/useToast";

export function useLeaveRequests(employeeId: string) {
  const { success, error: showError } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("2026");

  const reload = useCallback(() => {
    setIsLoading(true);
    leaveService
      .getEmployeeRequests(employeeId)
      .then((res) => {
        setRequests(res.items);
        setIsSampleData(res.isSampleData);
      })
      .catch(() => {
        // Handled in service fallback
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [employeeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchType = typeFilter === "all" || r.leave_type.toLowerCase() === typeFilter.toLowerCase();
      const matchYear = yearFilter === "all" || r.start_date.startsWith(yearFilter);
      return matchStatus && matchType && matchYear;
    });
  }, [requests, statusFilter, typeFilter, yearFilter]);

  const pendingCount = useMemo(() => {
    return requests.filter((r) => r.status.toLowerCase() === "pending").length;
  }, [requests]);

  const cancelRequest = async (requestId: string) => {
    try {
      await leaveService.cancelRequest(requestId);
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "cancelled" as LeaveStatus } : r))
      );
      success("Leave request cancelled successfully.", "Request Cancelled");
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to cancel leave request.";
      showError(msg, "Cancellation Failed");
      return false;
    }
  };

  return {
    requests: filteredRequests,
    allRequests: requests,
    pendingCount,
    isLoading,
    isSampleData,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    yearFilter,
    setYearFilter,
    reload,
    cancelRequest,
  };
}
