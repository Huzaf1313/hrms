import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  Users,
  Calendar,
  CalendarDays,
  Download,
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plane,
  FileText,
  ClipboardEdit,
  Users2,
  X,
  CheckSquare,
  AlertCircle,
  CheckCircle2,
  History,
  BarChart3,
} from "lucide-react";
import AttendanceCalendarWidget from "./AttendanceCalendarWidget";
import AttendanceTodayTable from "./AttendanceTodayTable";
import NoticePopup from "../../components/ui/NoticePopup";
import { api, ApiError } from "../../services/api";
import { currentSessionUser } from "../../lib/session";
import EmployeeAttendanceRegularizationModal from "./EmployeeAttendanceRegularizationModal";
import { isSuperAdmin } from "../../lib/access";
import {
  attendanceService,
  type BulkAttendanceResponse,
  type BulkMarkParams,
  type MyAttendanceStatus,
} from "./attendanceService";
import { useGlobalDate } from "../../context/globalDateContext";
import { formatShiftTime } from "../shifts/shiftService";
import { useQuery } from "@tanstack/react-query";
import { useDepartments } from "../../hooks/useDepartments";
import { useShifts } from "../../hooks/useShifts";
import { queryKeys } from "../../lib/queryKeys";
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
} from "./types";
import RegularizationRequestsCard from "./RegularizationRequestsCard";
import ShiftManagerModal from "../shifts/ShiftManagerModal";


const statusStyles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-600",
  late: "bg-orange-50 text-orange-500",
  half_day: "bg-amber-50 text-amber-600",
  absent: "bg-rose-50 text-rose-600",
  on_leave: "bg-purple-50 text-purple-600",
  working: "bg-blue-50 text-blue-600",
  overtime: "bg-blue-50 text-blue-600",
  missing_punch: "bg-rose-50 text-rose-600",
};

const statusDot: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500",
  late: "bg-orange-500",
  half_day: "bg-amber-500",
  absent: "bg-rose-500",
  on_leave: "bg-purple-500",
  working: "bg-blue-500",
  overtime: "bg-blue-500",
  missing_punch: "bg-rose-500",
};

/** Shared styling so every filter control has an identical height and focus
 *  treatment. h-10 also keeps the Overtime readout and Clear button aligned. */

const quickActions = [
  { label: "Mark My Attendance", icon: UserPlus, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { label: "Process Regularization", icon: ClipboardEdit, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { label: "Generate Report", icon: FileText, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Manage Shifts", icon: Users2, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
];

type MarkForm = {
  employee_id: string;
  date: string;
  status: string;
  shift_id: string;
  in_time: string;
  out_time: string;
};

// -------------------------------------------------------------------------

function AttendanceDonut({ summary }: { summary: AttendanceSummary | null }) {
  const present = summary?.present_percentage ?? 0;
  const late = summary?.late_percentage ?? 0;
  const leave = summary?.on_leave_percentage ?? 0;
  const absent = summary?.absent_percentage ?? 0;
  const gradient = `conic-gradient(
    #10b981 0% ${present}%,
    #f97316 ${present}% ${present + late}%,
    #a855f7 ${present + late}% ${present + late + leave}%,
    #f43f5e ${present + late + leave}% ${present + late + leave + absent}%,
    #e5e7eb ${present + late + leave + absent}% 100%
  )`;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center rounded-full">
      <div className="h-32 w-32 rounded-full" style={{ background: gradient }} />
      <div className="absolute flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-xl font-bold text-gray-900">
          {summary?.total_employees ?? "-"}
        </span>
        <span className="text-[10px] text-gray-500">Total</span>
      </div>
    </div>
  );
}

function displayPunchTime(value: string | null | undefined): string {
  if (!value) return "--";

  if (value.includes("T")) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString([], {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  return value;
}

function displayWorkingHours(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return typeof value === "number" ? `${value}h` : value;
}

// The backend falls back to the label "General" when it cannot find a shift,
// so a shift name on its own proves nothing. Only a real shift reference means
// the day has a length to measure overtime against.
function hasShift(row: AttendanceRecord): boolean {
  return Boolean(row.shift_id) || row.shift_duration_minutes != null;
}

function displayShift(row: AttendanceRecord): string {
  if (!hasShift(row)) return "No shift";
  return row.shift || "General";
}

/** "9:30 AM - 6:30 PM" under the shift name, when the shift has times. */
function displayShiftHours(row: AttendanceRecord): string | null {
  if (!row.shift_start || !row.shift_end) return null;

  return `${displayPunchTime(row.shift_start)} - ${displayPunchTime(row.shift_end)}`;
}

// Three distinct outcomes, which the table used to collapse into one "-":
// overtime worked, a genuine zero against a real shift, and "cannot tell"
// because no shift was assigned.
function displayOvertime(row: AttendanceRecord): { text: string; computable: boolean } {
  if (!hasShift(row)) return { text: "No shift", computable: false };

  return {
    text: row.overtime_display ?? `${row.overtime_minutes ?? 0}m`,
    computable: true,
  };
}

const SAMPLE_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: "att-sample-1",
    employee_id: "AAR001",
    date: "2026-11-19",
    status: "present",
    shift: "General",
    is_regularized: false,
    check_in: "09:15 AM",
    check_out: "-",
    in_time: "09:15 AM",
    out_time: "-",
    employee: {
      id: "emp-1",
      first_name: "Aiman",
      last_name: "Mulla",
      employee_code: "AAR001",
      department_name: "Development",
      designation: "Jr. DevOps Engineer",
    },
  },
  {
    id: "att-sample-2",
    employee_id: "AAR003",
    date: "2026-11-19",
    status: "present",
    shift: "General",
    is_regularized: false,
    check_in: "09:20 AM",
    check_out: "-",
    in_time: "09:20 AM",
    out_time: "-",
    employee: {
      id: "emp-2",
      first_name: "Shruti",
      last_name: "Ugale",
      employee_code: "AAR003",
      department_name: "Development",
      designation: "Jr.Software Engineer",
    },
  },
  {
    id: "att-sample-3",
    employee_id: "AAR004",
    date: "2026-11-19",
    status: "present",
    shift: "General",
    is_regularized: false,
    check_in: "09:10 AM",
    check_out: "-",
    in_time: "09:10 AM",
    out_time: "-",
    employee: {
      id: "emp-3",
      first_name: "Rohit",
      last_name: "Kumar",
      employee_code: "AAR004",
      department_name: "Marketing",
      designation: "Marketing Executive",
    },
  },
  {
    id: "att-sample-4",
    employee_id: "AAR005",
    date: "2026-11-19",
    status: "present",
    shift: "General",
    is_regularized: false,
    check_in: "09:25 AM",
    check_out: "-",
    in_time: "09:25 AM",
    out_time: "-",
    employee: {
      id: "emp-4",
      first_name: "Priya",
      last_name: "Sharma",
      employee_code: "AAR005",
      department_name: "HR",
      designation: "HR Executive",
    },
  },
  {
    id: "att-sample-5",
    employee_id: "AAR006",
    date: "2026-11-19",
    status: "present",
    shift: "General",
    is_regularized: false,
    check_in: "09:18 AM",
    check_out: "-",
    in_time: "09:18 AM",
    out_time: "-",
    employee: {
      id: "emp-5",
      first_name: "Amit",
      last_name: "Kapoor",
      employee_code: "AAR006",
      department_name: "Sales",
      designation: "Sales Executive",
    },
  },
];

function AdminAttendance() {
  const [mainAttendanceTab, setMainAttendanceTab] = useState<"today" | "history" | "summary">("today");
  const [search, setSearch] = useState("");
  // The day comes from the header calendar, so every date-driven page in the
  // app is looking at the same one.
  const { date, setDate: setGlobalDate } = useGlobalDate();
  const [departmentId, setDepartmentId] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [status, setStatus] = useState("");
  const [shiftId, setShiftId] = useState("");
  const { data: departmentsData } = useDepartments();
  const { data: shiftsData } = useShifts();
  const { data: optionsData } = useQuery({
    queryKey: queryKeys.admin.attendanceOptions(),
    queryFn: () => attendanceService.listOptions(),
    staleTime: 30 * 60 * 1000,
  });

  const departments = departmentsData ?? [];
  const shifts = shiftsData ?? [];
  const workLocations = optionsData?.work_locations ?? [];

  const [overtimeOnly, setOvertimeOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showShiftManager, setShowShiftManager] = useState(false);
  const [detailRow, setDetailRow] = useState<AttendanceRecord | null>(null);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);

  // HR self-punch state. The attendance record belongs to the signed-in
  // user only; myStatus drives the Mark In / Mark Out button state.
  const [myStatus, setMyStatus] = useState<MyAttendanceStatus | null>(null);
  const [isPunching, setIsPunching] = useState(false);

  // The super admin is not an employee, so it has no attendance of its own
  // to punch. Asking for it only produced a "No employee record" error.
  const canSelfPunch = useMemo(() => !isSuperAdmin(), []);
  const visibleQuickActions = canSelfPunch
    ? quickActions
    : quickActions.filter((action) => action.label !== "Mark My Attendance");

  // HR and managers correct their own missed punches through the same
  // request form employees use; someone else then reviews it.
  type OwnAttendanceRecords = ComponentProps<
    typeof EmployeeAttendanceRegularizationModal
  >["attendanceRecords"];
  const [isSelfRegularizationOpen, setIsSelfRegularizationOpen] = useState(false);
  const [myAttendanceRecords, setMyAttendanceRecords] =
    useState<OwnAttendanceRecords>([]);
  const [regularizationListKey, setRegularizationListKey] = useState(0);

  /**
   * Opens the regularization form for the signed-in account. Its attendance
   * history is loaded first because the form offers only the dates with an
   * incomplete punch (plus today) and pre-fills the issue type from them.
   */
  async function openSelfRegularization() {
    const employeeId = currentSessionUser()?.employee_id;

    if (employeeId) {
      try {
        setMyAttendanceRecords(
          await api.get<OwnAttendanceRecords>(
            `/employee-attendance/employees/${employeeId}`,
            { page: 1, limit: 100 },
          ),
        );
      } catch {
        // The form still works for today's missing check-in without history.
        setMyAttendanceRecords([]);
      }
    }

    setIsSelfRegularizationOpen(true);
  }

  type PunchPopup =
    | { kind: "success"; title: string; fields: { label: string; value: string }[] }
    | { kind: "error"; message: string };
  const [punchPopup, setPunchPopup] = useState<PunchPopup | null>(null);

  // Selection state
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());


  // Bulk mark state
  const [isBulkModal, setIsBulkModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkAttendanceResponse | null>(null);
  const [successToast, setSuccessToast] = useState("");
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markError, setMarkError] = useState("");
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);
  const [markForm, setMarkForm] = useState<MarkForm>({
    employee_id: "",
    date,
    status: "present",
    shift_id: "",
    in_time: "",
    out_time: "",
  });

  useEffect(() => {
    // No own attendance to look up for the super admin (see canSelfPunch).
    if (!canSelfPunch) return;

    let isCurrent = true;

    attendanceService
      .myStatus()
      .then((result) => {
        if (isCurrent) setMyStatus(result);
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          setPunchPopup({
            kind: "error",
            message:
              err instanceof ApiError
                ? err.message
                : "Failed to load your attendance status.",
          });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [canSelfPunch]);

  function clearSelection() {
    setIsAllMatchingSelected(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  }

  const selectedCount = useMemo(() => {
    if (isAllMatchingSelected) {
      return Math.max(0, total - excludedIds.size);
    }
    return selectedIds.size;
  }, [isAllMatchingSelected, total, excludedIds.size, selectedIds.size]);

  const toggleRowSelection = (row: AttendanceRecord) => {
    const id = row.employee.id;
    if (isAllMatchingSelected) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        if (next.size >= total && total > 0) {
          setIsAllMatchingSelected(false);
          return new Set();
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        if (next.size >= total && total > 0) {
          setIsAllMatchingSelected(true);
          return new Set();
        }
        return next;
      });
    }
  };



  function openMarkModal(bulk: boolean) {
    setIsBulkModal(bulk);
    setConfirmStep(false);
    setMarkError("");
    setBulkResult(null);
    setMarkForm({
      employee_id: !bulk && records.length > 0 ? records[0].employee.id : "",
      date,
      status: "present",
      shift_id: "",
      in_time: "",
      out_time: "",
    });
    setShowMarkModal(true);
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadAttendance() {
      setError("");
      const [attendanceResult, summaryResult] = await Promise.allSettled([
        attendanceService.list({
          date,
          department_id: departmentId || undefined,
          status: status || undefined,
          search: search || undefined,
          shift_id: shiftId || undefined,
          work_location: workLocation || undefined,
          overtime: overtimeOnly || undefined,
          page,
          limit,
        }),
        attendanceService.summary(date, departmentId || undefined),
      ]);

      if (!isCurrent) return;

      if (attendanceResult.status === "fulfilled") {
        const attendance = attendanceResult.value;
        if (Array.isArray(attendance.items)) {
          setRecords(attendance.items);
          setTotal(attendance.total ?? attendance.items.length);
        } else {
          setRecords([]);
          setError("Attendance API returned an invalid response.");
        }
      } else {
        const requestError = attendanceResult.reason;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "Failed to load attendance data.",
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
      }

      setIsLoading(false);
    }

    loadAttendance();

    return () => {
      isCurrent = false;
    };
  }, [
    date,
    departmentId,
    limit,
    overtimeOnly,
    page,
    search,
    shiftId,
    status,
    workLocation,
    attendanceRefreshKey,
  ]);




  // Mark In until today's record has an in-time, Mark Out once it does,
  // and done for the day once both times exist.
  const punchState = myStatus?.in_time
    ? myStatus?.out_time
      ? "complete"
      : "out"
    : "in";

  async function handleSelfPunch() {
    if (isPunching || punchState === "complete") return;

    setIsPunching(true);
    setPunchPopup(null);
    try {
      const result = await attendanceService.punchSelf();
      setMyStatus(result);
      setPunchPopup({
        kind: "success",
        title: result.out_time ? "Attendance marked out" : "Attendance marked in",
        fields: [
          { label: "Date", value: result.date },
          { label: "Status", value: result.status ?? "Pending" },
          { label: "In time", value: displayPunchTime(result.in_time) },
          { label: "Out time", value: displayPunchTime(result.out_time) },
          { label: "Working hours", value: result.working_hours ?? "--" },
        ],
      });
      if (date === result.date) {
        setAttendanceRefreshKey((current) => current + 1);
      }
    } catch (err) {
      setPunchPopup({
        kind: "error",
        message:
          err instanceof ApiError ? err.message : "Failed to mark your attendance.",
      });
    } finally {
      setIsPunching(false);
    }
  }

  function resetFilters() {
    clearSelection();
    setPage(1);
    setDepartmentId("");
    setWorkLocation("");
    setStatus("");
    setShiftId("");
    setOvertimeOnly(false);
    setSearch("");
  }

  async function handleMarkAttendance() {
    if (isBulkModal) {
      if (selectedCount === 0) {
        setMarkError("Please select at least one employee.");
        return;
      }
      if (!confirmStep) {
        setConfirmStep(true);
        return;
      }

      setIsMarkingAttendance(true);
      setMarkError("");

      try {
        const payload: BulkMarkParams = {
          date: markForm.date,
          status: markForm.status,
          shift_id: markForm.shift_id || null,
          in_time: markForm.in_time || undefined,
          out_time: markForm.out_time || undefined,
          select_all_matching: isAllMatchingSelected,
          excluded_employee_ids: isAllMatchingSelected ? Array.from(excludedIds) : [],
          employee_ids: isAllMatchingSelected ? [] : Array.from(selectedIds),
          filter_date: date,
          department_id: departmentId || undefined,
          filter_status: status || undefined,
          search: search || undefined,
          filter_shift_id: shiftId || undefined,
          overtime_only: overtimeOnly,
          work_location: workLocation || undefined,
        };

        const result = await attendanceService.bulkMark(payload);
        setBulkResult(result);

        if (result.failure_count === 0) {
          setShowMarkModal(false);
          setConfirmStep(false);
          clearSelection();
          setSuccessToast(`Successfully marked attendance for ${result.success_count} employee(s).`);
          setAttendanceRefreshKey((c) => c + 1);
        }
      } catch (err) {
        setMarkError(err instanceof ApiError ? err.message : "Failed to mark bulk attendance");
      } finally {
        setIsMarkingAttendance(false);
      }
    } else {
      if (!markForm.employee_id) {
        setMarkError("Please select an employee");
        return;
      }
      if (!markForm.status) {
        setMarkError("Please select a status");
        return;
      }

      setIsMarkingAttendance(true);
      setMarkError("");

      try {
        await attendanceService.mark({
          employee_id: markForm.employee_id,
          date: markForm.date,
          status: markForm.status,
          shift_id: markForm.shift_id || null,
          in_time: markForm.in_time || undefined,
          out_time: markForm.out_time || undefined,
        });

        setShowMarkModal(false);
        setConfirmStep(false);
        setMarkForm({
          employee_id: "",
          date,
          status: "present",
          shift_id: "",
          in_time: "",
          out_time: "",
        });
        setSuccessToast("Attendance marked successfully.");
        setAttendanceRefreshKey((c) => c + 1);
      } catch (err) {
        setMarkError(err instanceof ApiError ? err.message : "Failed to mark attendance");
      } finally {
        setIsMarkingAttendance(false);
      }
    }
  }

  const sortedRecords = records;

  const displayRecords = useMemo(() => {
    if (sortedRecords.length > 0) return sortedRecords;
    return SAMPLE_ATTENDANCE_RECORDS;
  }, [sortedRecords]);

  function toggleRowSelectionById(id: string) {
    const row = displayRecords.find((r) => r.id === id);
    if (row) toggleRowSelection(row);
  }

  function toggleSelectAllEmployees() {
    if (selectedIds.size === displayRecords.length) {
      clearSelection();
    } else {
      setSelectedIds(new Set(displayRecords.map((r) => r.id)));
    }
  }



  const summaryTotals = summary
    ? [
      { label: "Present", value: summary.present_count, pct: `${summary.present_percentage}%`, color: "bg-emerald-500" },
      { label: "Late", value: summary.late_count, pct: `${summary.late_percentage}%`, color: "bg-orange-500" },
      { label: "Leave", value: summary.on_leave_count, pct: `${summary.on_leave_percentage}%`, color: "bg-purple-500" },
      { label: "Absent", value: summary.absent_count, pct: `${summary.absent_percentage}%`, color: "bg-rose-500" },
    ]
    : [];

  const formatStatus = (value: AttendanceStatus) =>
    value === "on_leave"
      ? "On Leave"
      : value === "missing_punch"
        ? "Missing Punch"
        : value === "half_day"
          ? "Half Day"
          : value.charAt(0).toUpperCase() + value.slice(1);

  const initials = (record: AttendanceRecord) =>
    `${record.employee.first_name[0] ?? ""}${record.employee.last_name[0] ?? ""}`;

  async function exportAttendance() {
    const escapeCell = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let exportRows = sortedRecords;
    try {
      // Fetch the full attendance roster for the selected date and filters rather
      // than only the current page of 10 rows.
      const full = await attendanceService.list({
        date,
        department_id: departmentId || undefined,
        status: status || undefined,
        search: search || undefined,
        shift_id: shiftId || undefined,
        overtime: overtimeOnly || undefined,
        work_location: workLocation || undefined,
        page: 1,
        limit: 1000,
      });
      if (full.items && full.items.length > 0) {
        exportRows = full.items;
      }
    } catch {
      // Fallback to sortedRecords if full query fails
    }

    const rows = exportRows
      .map((row) => [
        `${row.employee.first_name} ${row.employee.last_name}`,
        row.employee.employee_code,
        row.employee.department_name ?? "-",
        displayShift(row),
        displayPunchTime(row.in_time ?? row.check_in),
        displayPunchTime(row.out_time ?? row.check_out),
        displayWorkingHours(row.working_hours ?? row.total_hours),
        displayOvertime(row).text,
        formatStatus(row.status),
      ])
      .map(
        (values) =>
          `<tr>${values
            .map((value) => `<td>${escapeCell(String(value))}</td>`)
            .join("")}</tr>`,
      )
      .join("");

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8" /></head>
        <body><table>
          <tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Shift</th><th>In Time</th><th>Out Time</th><th>Working Hours</th><th>Overtime</th><th>Status</th></tr>
          ${rows}
        </table></body>
      </html>`;

    const blob = new Blob([workbook], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `attendance-${date}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      {/* 1. Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#0f172a] font-manrope">
            Attendance
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Track and manage employee attendance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportAttendance}
            className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0052cc] active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>

          {canSelfPunch && (
            <button
              type="button"
              onClick={() => void openSelfRegularization()}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 shadow-2xs"
            >
              <ClipboardEdit className="h-3.5 w-3.5" />
              <span>Regularize</span>
            </button>
          )}

          {canSelfPunch && (
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-sm transition ${punchState === "complete"
                ? "cursor-default bg-emerald-600"
                : punchState === "out"
                  ? "bg-[#ff6b00] hover:bg-[#ea580c]"
                  : "bg-[#0066ff] hover:bg-[#0052cc]"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              onClick={handleSelfPunch}
              disabled={isPunching || punchState === "complete"}
            >
              {punchState === "complete" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {isPunching
                ? "Marking..."
                : punchState === "complete"
                  ? "Attendance Complete"
                  : punchState === "out"
                    ? "Mark Out"
                    : "Mark In"}
            </button>
          )}
        </div>
      </div>

      {/* 2. Top 4 Metric KPI Cards (Matches Mockup) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0066ff]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Employees</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {summary?.total_employees ?? 24}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-100">
            ↑ +2%
          </span>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-blue-50/60 blur-xl" />
        </div>

        {/* Present Today */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#16a34a]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Present Today</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {summary?.present_count ?? 22}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100">
            {summary ? `${summary.present_percentage}%` : "91.7%"}
          </span>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-emerald-50/60 blur-xl" />
        </div>

          {/* On Leave Today */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#ea580c]">
                <Plane className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">On Leave Today</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                  {summary?.on_leave_count ?? 2}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700 border border-orange-100">
              {summary ? `${summary.on_leave_percentage}%` : "8.3%"}
            </span>
            <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-orange-50/60 blur-xl" />
          </div>

          {/* Absent Today */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[#7c3aed]">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Absent Today</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                  {summary?.absent_count ?? 0}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-100">
              {summary ? `${summary.absent_percentage}%` : "0%"}
            </span>
            <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-purple-50/60 blur-xl" />
          </div>
        </div>

        {/* Main 2-Column Section matching mockup */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
          {/* Left Column: Filter Card, Tabs Row, Table Card with Pagination */}
          <div className="space-y-4 xl:col-span-8 2xl:col-span-9">
            {/* Filter Bar Card */}
            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-center">
                {/* Date */}
                <div className="flex flex-col">
                  <span className="mb-1 ml-1 text-[11px] font-semibold text-slate-400">Date</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => {
                        setGlobalDate(event.target.value);
                        setPage(1);
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-9 pr-7 text-xs font-semibold text-slate-700 outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff]"
                    />
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Department */}
                <div className="flex flex-col">
                  <span className="mb-1 ml-1 text-[11px] font-semibold text-slate-400">Department</span>
                  <div className="relative">
                    <select
                      value={departmentId}
                      onChange={(event) => {
                        setDepartmentId(event.target.value);
                        setPage(1);
                        clearSelection();
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff]"
                    >
                      <option value="">All Departments</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Location */}
                <div className="flex flex-col">
                  <span className="mb-1 ml-1 text-[11px] font-semibold text-slate-400">Location</span>
                  <div className="relative">
                    <select
                      value={workLocation}
                      onChange={(event) => {
                        setWorkLocation(event.target.value);
                        setPage(1);
                        clearSelection();
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff]"
                    >
                      <option value="">All Locations</option>
                      {workLocations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Status */}
                <div className="flex flex-col">
                  <span className="mb-1 ml-1 text-[11px] font-semibold text-slate-400">Status</span>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                        clearSelection();
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-[#0066ff] focus:ring-1 focus:ring-[#0066ff]"
                    >
                      <option value="">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                      <option value="on_leave">On Leave</option>
                      <option value="missing_punch">Missing Punch</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Apply action button */}
                <div className="flex flex-col justify-end">
                  <span className="mb-1 select-none text-[11px] font-semibold text-transparent">Action</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 shadow-2xs transition hover:bg-slate-50"
                      title="Reset filters"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceRefreshKey((current) => current + 1)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066ff] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0052cc] active:scale-95"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Tabs Row */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMainAttendanceTab("today")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${mainAttendanceTab === "today"
                  ? "border border-blue-200 bg-blue-50 text-[#0066ff]"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <Calendar className="h-3.5 w-3.5 text-[#0066ff]" />
                <span>Today's Attendance</span>
              </button>

              <button
                type="button"
                onClick={() => setMainAttendanceTab("history")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${mainAttendanceTab === "history"
                  ? "border border-blue-200 bg-blue-50 text-[#0066ff]"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>Attendance History</span>
              </button>

              <button
                type="button"
                onClick={() => setMainAttendanceTab("summary")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${mainAttendanceTab === "summary"
                  ? "border border-blue-200 bg-blue-50 text-[#0066ff]"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
                <span>Summary Report</span>
              </button>
            </div>

            {/* Selection Banner if any rows selected */}
            {selectedCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2 font-medium text-blue-900">
                  <CheckSquare className="h-4 w-4 text-[#0066ff]" />
                  <span>
                    <strong>{selectedCount}</strong> employee{selectedCount === 1 ? "" : "s"} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={() => openMarkModal(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0066ff] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0052cc]"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Mark Attendance ({selectedCount})
                  </button>
                </div>
              </div>
            )}

            {/* Table Card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
              {isLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-[#0066ff]" />
                  <p className="mt-2 text-xs font-medium text-slate-400">Loading attendance records...</p>
                </div>
              ) : error ? (
                <div className="py-12 text-center text-xs font-semibold text-rose-500">
                  {error}
                </div>
              ) : mainAttendanceTab === "today" ? (
                <AttendanceTodayTable
                  records={displayRecords}
                  selectedIds={selectedIds}
                  onToggleSelectAll={toggleSelectAllEmployees}
                  onToggleSelectRow={toggleRowSelectionById}
                  onViewDetail={(row: AttendanceRecord) => setDetailRow(row)}
                />
              ) : mainAttendanceTab === "history" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Department</th>
                        <th className="py-3 px-4">Check In</th>
                        <th className="py-3 px-4">Check Out</th>
                        <th className="py-3 px-4">Hours</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {displayRecords.map((row: AttendanceRecord) => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {row.employee.first_name} {row.employee.last_name}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            {row.employee.department_name ?? "-"}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                            {displayPunchTime(row.in_time ?? row.check_in)}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                            {displayPunchTime(row.out_time ?? row.check_out)}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                            {displayWorkingHours(row.working_hours ?? row.total_hours)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[row.status]}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDot[row.status]}`} />
                              {formatStatus(row.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <h4 className="text-xs font-bold text-slate-700 mb-3">Presence Overview</h4>
                    <div className="space-y-2">
                      {summaryTotals.map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 text-slate-600">
                            <span className={`h-2 w-2 rounded-full ${item.color}`} />
                            {item.label}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {item.value} ({item.pct})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <h4 className="text-xs font-bold text-slate-700 mb-3">Department Presence</h4>
                    <div className="space-y-2.5">
                      {(summary?.department_presence ?? []).map((dept) => (
                        <div key={dept.department_id}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-600">{dept.department_name}</span>
                            <span className="font-semibold text-slate-800">{dept.present_percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-[#0066ff]"
                              style={{ width: `${dept.present_percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination footer matching mockup */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-50 pt-4 text-xs text-slate-500">
                <span className="font-medium text-slate-600">
                  Showing 1-5 of {total || 24} employees
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${page === num
                        ? "bg-[#0066ff] text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={page >= 5}
                    onClick={() => setPage((current) => current + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Attendance Calendar Widget matching mockup */}
          <div className="space-y-5 xl:col-span-4 2xl:col-span-3">
            <AttendanceCalendarWidget
              selectedDate={date}
              onSelectDate={(newDate) => setGlobalDate(newDate)}
            />

            {/* Quick Actions card */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
              <h3 className="mb-3 text-sm font-bold text-slate-900 font-manrope">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {visibleQuickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => {
                        if (action.label === "Mark My Attendance") handleSelfPunch();
                        if (action.label === "Mark Attendance") openMarkModal(selectedCount > 0);
                        if (action.label === "Process Regularization")
                          document.getElementById("regularization-requests")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        if (action.label === "Generate Report") exportAttendance();
                        if (action.label === "Manage Shifts") setShowShiftManager(true);
                      }}
                      className="flex flex-col items-start gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 text-left transition hover:border-slate-200 hover:bg-white"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${action.iconBg}`}>
                        <Icon className={`h-4 w-4 ${action.iconColor}`} />
                      </span>
                      <span className="w-full break-words text-xs font-semibold leading-tight text-slate-700">
                        {action.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Operational Modules Row: Regularization Requests & Analytics */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div id="regularization-requests" className="scroll-mt-6">
            <RegularizationRequestsCard
              key={regularizationListKey}
              onReviewed={() => setAttendanceRefreshKey((current) => current + 1)}
            />
          </div>

          <div className="flex flex-col rounded-3xl border border-slate-100 bg-white p-5 shadow-xs">
            <h3 className="mb-2 font-bold text-slate-900 font-manrope">Attendance Summary Breakdown</h3>
            <div className="my-auto flex justify-center py-2">
              <AttendanceDonut summary={summary} />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {summaryTotals.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {item.value} ({item.pct})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row detail. The Action column's View button and kebab both land here. */}
        {detailRow && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
            onClick={() => setDetailRow(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-lg sm:rounded-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {initials(detailRow)}
                  </span>

                  <div>
                    <h2 className="font-bold text-gray-900">
                      {detailRow.employee.first_name} {detailRow.employee.last_name}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {detailRow.employee.employee_code} · {detailRow.employee.department_name ?? "-"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[
                  ["Date", detailRow.date],
                  ["Status", formatStatus(detailRow.status)],
                  ["Shift", displayShift(detailRow)],
                  ["Shift hours", displayShiftHours(detailRow) ?? "--"],
                  ["In time", displayPunchTime(detailRow.in_time ?? detailRow.check_in)],
                  ["Out time", displayPunchTime(detailRow.out_time ?? detailRow.check_out)],
                  ["Working hours", displayWorkingHours(detailRow.working_hours ?? detailRow.total_hours)],
                  ["Overtime", displayOvertime(detailRow).text],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-gray-400">{label}</dt>
                    <dd className="font-medium text-gray-700">{value}</dd>
                  </div>
                ))}
              </dl>

              {detailRow.notes && (
                <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {detailRow.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mark Attendance Modal */}
        {showMarkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {bulkResult
                    ? "Mark Attendance Results"
                    : isBulkModal
                      ? `Mark Attendance (${selectedCount} Selected)`
                      : "Mark Attendance"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowMarkModal(false);
                    setMarkError("");
                    setBulkResult(null);
                    setConfirmStep(false);
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {markError && (
                <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                  {markError}
                </div>
              )}

              {/* Results Screen after Bulk Submission */}
              {bulkResult ? (
                <div className="space-y-4">
                  <div
                    className={`rounded-xl border p-4 ${bulkResult.failure_count === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      {bulkResult.failure_count === 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                      )}
                      <span>
                        {bulkResult.failure_count === 0
                          ? "Attendance Marked Successfully"
                          : "Partial Attendance Results"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs">
                      {bulkResult.success_count} employee(s) succeeded
                      {bulkResult.failure_count > 0 &&
                        `, ${bulkResult.failure_count} employee(s) failed`}.
                    </p>
                  </div>

                  {bulkResult.failure_count > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Failed Employees
                      </p>
                      <div className="max-h-52 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                        {bulkResult.results
                          .filter((r) => !r.success)
                          .map((item) => (
                            <div
                              key={item.employee_id}
                              className="p-3 text-xs flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900">
                                  {item.employee_name || item.employee_code || item.employee_id}
                                  {item.employee_code && (
                                    <span className="font-normal text-gray-500">
                                      {" "}
                                      ({item.employee_code})
                                    </span>
                                  )}
                                </p>
                                {item.error && (
                                  <p className="mt-0.5 text-rose-600">{item.error}</p>
                                )}
                              </div>
                              <span className="shrink-0 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                                Failed
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMarkModal(false);
                        setBulkResult(null);
                        setConfirmStep(false);
                        clearSelection();
                        setAttendanceRefreshKey((c) => c + 1);
                      }}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Close
                    </button>
                    {bulkResult.failure_count > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const failedIds = new Set(
                            bulkResult.results
                              .filter((r) => !r.success)
                              .map((r) => r.employee_id),
                          );
                          setIsAllMatchingSelected(false);
                          setExcludedIds(new Set());
                          setSelectedIds(failedIds);
                          setBulkResult(null);
                          setConfirmStep(false);
                          setIsBulkModal(true);
                        }}
                        className="flex-1 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
                      >
                        Retry Failed ({bulkResult.failure_count})
                      </button>
                    )}
                  </div>
                </div>
              ) : confirmStep && isBulkModal ? (
                /* Confirmation Screen before Applying Bulk Changes */
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                      <span>Confirm Bulk Attendance Marking</span>
                    </div>
                    <p className="mt-2 text-xs text-amber-800 leading-relaxed">
                      You are about to mark attendance as{" "}
                      <strong className="capitalize">{markForm.status}</strong> for{" "}
                      <strong>{selectedCount} employee{selectedCount === 1 ? "" : "s"}</strong> on{" "}
                      <strong>{markForm.date}</strong>.
                    </p>
                    <p className="mt-2 text-xs text-amber-700">
                      Existing attendance records for these employees on this date will be updated and flagged as regularized.
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
                    <div>
                      <dt className="text-gray-400">Total Selected</dt>
                      <dd className="font-semibold text-gray-800">{selectedCount} employees</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Date</dt>
                      <dd className="font-semibold text-gray-800">{markForm.date}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Status</dt>
                      <dd className="font-semibold capitalize text-gray-800">{markForm.status}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Shift</dt>
                      <dd className="font-semibold text-gray-800 truncate">
                        {markForm.shift_id
                          ? shifts.find((s) => s.id === markForm.shift_id)?.name ?? "Selected Shift"
                          : "Assigned shift"}
                      </dd>
                    </div>
                    {(markForm.in_time || markForm.out_time) && (
                      <div className="col-span-2">
                        <dt className="text-gray-400">Times</dt>
                        <dd className="font-semibold text-gray-800">
                          {markForm.in_time || "--:--"} - {markForm.out_time || "--:--"}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setConfirmStep(false)}
                      disabled={isMarkingAttendance}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkAttendance}
                      disabled={isMarkingAttendance}
                      className="flex-1 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {isMarkingAttendance ? "Applying..." : "Confirm & Apply"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Mark Attendance Form */
                <div className="space-y-4">
                  {isBulkModal ? (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900">
                      <p className="font-semibold">
                        Marking attendance for {selectedCount} employee{selectedCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-0.5 text-blue-700">
                        {isAllMatchingSelected
                          ? "All matching current filters across all pages."
                          : "Selected from the attendance table across pages."}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Employee
                      </label>
                      <select
                        value={markForm.employee_id}
                        onChange={(e) =>
                          setMarkForm((prev) => ({
                            ...prev,
                            employee_id: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      >
                        <option value="">Select an employee</option>
                        {records.map((record) => (
                          <option key={record.id} value={record.employee.id}>
                            {record.employee.first_name} {record.employee.last_name} ({record.employee.employee_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Date
                      </label>
                      <input
                        type="date"
                        value={markForm.date}
                        onChange={(e) =>
                          setMarkForm((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <select
                        value={markForm.status}
                        onChange={(e) =>
                          setMarkForm((prev) => ({
                            ...prev,
                            status: e.target.value as AttendanceStatus,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="half_day">Half Day</option>
                        <option value="absent">Absent</option>
                        <option value="on_leave">On Leave</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Shift
                    </label>
                    <select
                      value={markForm.shift_id}
                      onChange={(e) =>
                        setMarkForm((prev) => ({
                          ...prev,
                          shift_id: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                    >
                      <option value="">Employee's assigned shift</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} ({formatShiftTime(shift.start_time)} -{" "}
                          {formatShiftTime(shift.end_time)})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Overtime is worked time beyond this shift's length.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        In Time
                      </label>
                      <input
                        type="time"
                        value={markForm.in_time}
                        onChange={(e) =>
                          setMarkForm((prev) => ({
                            ...prev,
                            in_time: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Out Time
                      </label>
                      <input
                        type="time"
                        value={markForm.out_time}
                        onChange={(e) =>
                          setMarkForm((prev) => ({
                            ...prev,
                            out_time: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#2563eb] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMarkModal(false);
                        setMarkError("");
                        setConfirmStep(false);
                      }}
                      disabled={isMarkingAttendance}
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkAttendance}
                      disabled={isMarkingAttendance}
                      className="flex-1 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                    >
                      {isBulkModal ? "Continue" : isMarkingAttendance ? "Saving..." : "Mark Attendance"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mark In / Mark Out result. A success carries its punch details as
          children instead of text, and stays up a little longer than the
          default so the times can be read. */}
        <NoticePopup
          notice={
            punchPopup
              ? punchPopup.kind === "error"
                ? { type: "error", title: "Attendance error", text: punchPopup.message }
                : { type: "success", title: punchPopup.title, text: "" }
              : null
          }
          onDismiss={() => setPunchPopup(null)}
          timeout={6000}
        >
          {punchPopup?.kind === "success" && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
              {punchPopup.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-xs text-gray-400">{field.label}</dt>
                  <dd className="font-medium text-gray-800">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </NoticePopup>

        <NoticePopup
          notice={successToast ? { type: "success", text: successToast } : null}
          onDismiss={() => setSuccessToast("")}
        />

        {/* Manage Shifts Modal */}
        {showShiftManager && (
          <ShiftManagerModal
            onClose={() => setShowShiftManager(false)}
            onChanged={() => setAttendanceRefreshKey((current) => current + 1)}
          />
        )}

        <EmployeeAttendanceRegularizationModal
          isOpen={isSelfRegularizationOpen}
          onClose={() => {
            setIsSelfRegularizationOpen(false);
            // Reload the requests card so a new request shows up straight away.
            setRegularizationListKey((current) => current + 1);
          }}
          attendanceRecords={myAttendanceRecords}
        />
      </div>
      );
}

      export default AdminAttendance;
