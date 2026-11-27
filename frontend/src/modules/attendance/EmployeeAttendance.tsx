import React, { useState, useEffect, useMemo } from "react";
import { TodayPunchCard } from "./components/TodayPunchCard";
import { AttendanceStatRow } from "./components/AttendanceStatRow";
import { AttendanceHistoryView } from "./components/AttendanceHistoryView";
import { AttendanceDayDrawer } from "./components/AttendanceDayDrawer";
import { EmployeeAttendanceRegularizationModal } from "./EmployeeAttendanceRegularizationModal";
import { EmployeeRegularizationHistory } from "./components/EmployeeRegularizationHistory";
import { ErrorState } from "../../components/ui/ErrorState";
import { StatCardSkeleton, TableSkeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { employeeAttendance } from "./attendanceService";
import { currentSessionUser } from "../../lib/session";
import { FileEdit, Calendar, ClipboardList } from "lucide-react";
import type { EmployeeAttendanceRecord } from "./types";

export const EmployeeAttendance: React.FC = () => {
  const user = currentSessionUser();
  const employeeId = user?.employee_id || "AAR001";

  const [records, setRecords] = useState<EmployeeAttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSampleData, setIsSampleData] = useState(false);
  const [viewTab, setViewTab] = useState<"calendar" | "regularization">("calendar");

  // Day detail drawer
  const [selectedRecord, setSelectedRecord] = useState<EmployeeAttendanceRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Regularization modal
  const [isRegularizationOpen, setIsRegularizationOpen] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

    employeeAttendance
      .month(employeeId, startDate, endDate)
      .then((data) => {
        if (!isCurrent) return;
        if (Array.isArray(data)) {
          setRecords(data);
          setIsSampleData(false);
        } else {
          setRecords([]);
          setIsSampleData(false);
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        setRecords([]);
        setIsSampleData(false);
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [employeeId, refreshKey, selectedMonth]);

  // Derived personal statistics
  const stats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let onLeave = 0;
    let totalHours = 0;
    let countWithHours = 0;

    records.forEach((r) => {
      const s = r.status.toLowerCase();
      if (s === "present" || s === "working") {
        present++;
      } else if (s === "late" || s === "half_day") {
        late++;
      } else if (s === "absent" || s === "missing_punch") {
        absent++;
      } else if (s === "on_leave") {
        onLeave++;
      }

      if (r.total_hours != null && r.total_hours > 0) {
        totalHours += r.total_hours;
        countWithHours++;
      }
    });

    const avg = countWithHours > 0 ? (totalHours / countWithHours).toFixed(1) + "h" : "0.0h";

    return {
      present,
      late,
      absent,
      onLeave,
      avgHours: avg,
    };
  }, [records]);

  function handleMonthChange(nextMonth: Date) {
    setIsLoading(true);
    setSelectedMonth(nextMonth);
  }

  function handleRefreshAttendance() {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }

  function handleSelectDay(record: EmployeeAttendanceRecord) {
    setSelectedRecord(record);
    setIsDrawerOpen(true);
  }

  function handleRequestRegularization(record?: EmployeeAttendanceRecord) {
    if (record) {
      setSelectedRecord(record);
    }
    setIsRegularizationOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top action bar with view switcher tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1 bg-[#F0F1EE] p-0.5 rounded-[6px]">
          <button
            type="button"
            onClick={() => setViewTab("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[5px] transition-colors ${
              viewTab === "calendar"
                ? "bg-white text-[#2F5FD0] border border-[#E4E6E1] font-semibold"
                : "text-[#52606D] hover:text-[#1F2933]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Attendance Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewTab("regularization")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-[5px] transition-colors ${
              viewTab === "regularization"
                ? "bg-white text-[#2F5FD0] border border-[#E4E6E1] font-semibold"
                : "text-[#52606D] hover:text-[#1F2933]"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            My Regularization Requests
          </button>
        </div>

        {/* Right: Sample Data badge & Action button */}
        <div className="flex items-center gap-2 shrink-0">
          {isSampleData && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Sample data
            </span>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={() => handleRequestRegularization()}
            leftIcon={<FileEdit className="w-3.5 h-3.5" />}
            className="h-8 text-xs font-medium"
          >
            Request Regularization
          </Button>
        </div>
      </div>

      {viewTab === "calendar" ? (
        <div className="flex flex-col gap-4 w-full">
          {/* Full-width Today Punch Card */}
          <TodayPunchCard
            shiftName="General Shift"
            shiftTiming="09:30 AM - 06:30 PM"
            gracePeriod={15}
            onPunchSuccess={handleRefreshAttendance}
          />

          {/* Full-width Personal Stats Strip */}
          {isLoading ? (
            <StatCardSkeleton count={5} />
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={handleRefreshAttendance}
            />
          ) : (
            <AttendanceStatRow
              isPersonal
              presentCount={stats.present}
              lateCount={stats.late}
              onLeaveCount={stats.onLeave}
              absentCount={stats.absent}
              avgHours={stats.avgHours}
            />
          )}

          {/* Full-width Calendar / History View */}
          {isLoading ? (
            <TableSkeleton rows={8} columns={7} />
          ) : (
            <AttendanceHistoryView
              records={records}
              currentDate={selectedMonth}
              onMonthChange={handleMonthChange}
              onSelectDay={handleSelectDay}
              onRequestRegularization={handleRequestRegularization}
            />
          )}
        </div>
      ) : (
        /* Regularization History View */
        <EmployeeRegularizationHistory
          employeeId={employeeId}
          onRequestNew={() => handleRequestRegularization()}
        />
      )}

      {/* Detail Drawer */}
      <AttendanceDayDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
        onRequestRegularization={handleRequestRegularization}
      />

      {/* Regularization Request Modal */}
      <EmployeeAttendanceRegularizationModal
        key={isRegularizationOpen ? (selectedRecord?.date ?? "new") : "closed"}
        isOpen={isRegularizationOpen}
        onClose={() => {
          setIsRegularizationOpen(false);
          setSelectedRecord(null);
        }}
        attendanceRecords={records}
        initialDate={selectedRecord?.date ?? null}
        onSuccess={handleRefreshAttendance}
      />
    </div>
  );
};

export default EmployeeAttendance;
