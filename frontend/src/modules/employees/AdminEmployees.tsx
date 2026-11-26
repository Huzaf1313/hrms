import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Download,
  RotateCcw,
  Search,
  Umbrella,
  UserPlus,
  Users,
} from "lucide-react";

import AdminEmployeeDetailsPage from "./AdminEmployeeDetailsPage";
import AdminEmployeeForm from "./AdminEmployeeForm";
import AdminEmployeeTable from "./AdminEmployeeTable";
import { TableSkeleton } from "../../components/ui";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeading } from "../../components/ui/PageHeading";
import { ApiError } from "../../services/api";
import {
  salaryStructureService,
  type SalaryStructure,
} from "../payroll/admin_salary_structure_service";
import { departmentService } from "../departments/departmentService";
import { employeeService } from "./employeeService";
import { shiftService } from "../shifts/shiftService";
import {
  userService,
  type ManagerAccount,
} from "../auth/userService";
import { useDashboardMetrics } from "../dashboard/useDashboardMetrics";
import type { Department } from "../departments/types";
import type {
  Employee,
  EmployeeCreate,
  EmployeeCredentials,
} from "./types";
import type { Shift } from "../shifts/types";

const DEFAULT_PAGE_SIZE = 5;

function CredentialsModal({
  credentials,
  employeeName,
  onClose,
}: {
  credentials: EmployeeCredentials;
  employeeName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyCredentials() {
    const text = `Email: ${credentials.email}\nPassword: ${credentials.temporary_password}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check aria-hidden="true" className="h-4 w-4" />
          </span>
          <h3 className="text-[18px] font-semibold text-[#111827]">
            Employee Created
          </h3>
        </div>

        <p className="mt-2 text-[13px] text-[#6B7280]">
          Share these login credentials with{" "}
          <span className="font-semibold text-gray-800">{employeeName}</span>.
          The password won't be shown again.
        </p>

        <div className="mt-5 space-y-3 rounded bg-[#f5f7fb] p-4">
          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">
              Email
            </p>
            <p className="mt-0.5 font-mono text-[13px] text-[#111827]">
              {credentials.email}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-[#6B7280]">
              Temporary Password
            </p>
            <p className="mt-0.5 font-mono text-[13px] text-[#111827]">
              {credentials.temporary_password}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={copyCredentials}
            className="rounded border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {copied ? (
              <>
                <Check aria-hidden="true" className="mr-1 inline h-4 w-4" />
                Copied
              </>
            ) : (
              "Copy Credentials"
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0052cc]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface EmployeeSearchRequest {
  query: string;
  requestId: number;
}

interface EmployeeSelectionRequest {
  employeeId: string;
  requestId: number;
}

interface AdminEmployeesProps {
  autoOpenCreateForm?: boolean;
  employeeSearchRequest?: EmployeeSearchRequest;
  employeeSelectionRequest?: EmployeeSelectionRequest;
}

function AdminEmployees({
  autoOpenCreateForm = false,
  employeeSearchRequest,
  employeeSelectionRequest,
}: AdminEmployeesProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const specialFilter = searchParams.get("filter") || "";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>([]);
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(autoOpenCreateForm);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sharedCredentials, setSharedCredentials] = useState<{
    name: string;
    credentials: EmployeeCredentials;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const lastHandledSearchRequest = useRef<number | null>(null);

  // Live KPI metrics with defaults from mockup
  const { metrics } = useDashboardMetrics(null);

  async function loadEmployees() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await employeeService.list({
        search: search || undefined,
        department_id: departmentFilter || undefined,
        status: statusFilter || undefined,
        filter: specialFilter || undefined,
        page,
        limit: 100,
      });

      setEmployees(data);

      const request = employeeSearchRequest;
      const query = request?.query.trim().toLowerCase();

      const shouldHandleRequest =
        request &&
        query &&
        search.trim().toLowerCase() === query &&
        lastHandledSearchRequest.current !== request.requestId;

      if (shouldHandleRequest && request) {
        lastHandledSearchRequest.current = request.requestId;

        const normalize = (value: string) =>
          value.trim().toLowerCase().replace(/\s+/g, " ");

        const normalizedQuery = normalize(request.query);

        const getFullName = (employee: Employee) =>
          normalize(`${employee.first_name} ${employee.last_name}`);

        let matchedEmployee = data.find(
          (employee) => getFullName(employee) === normalizedQuery,
        );

        if (!matchedEmployee) {
          const searchTerms = normalizedQuery.split(" ");
          matchedEmployee = data.find((employee) => {
            const fullName = getFullName(employee);
            return searchTerms.every((term) => fullName.includes(term));
          });
        }

        if (matchedEmployee) {
          setViewingEmployee(matchedEmployee);
        } else {
          setError(
            `No employee found matching "${request.query}". Try searching with their full name.`,
          );
        }
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load employees.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      await loadEmployees();
      if (isCancelled) return;
    }

    load();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    departmentFilter,
    statusFilter,
    specialFilter,
    employeeSearchRequest?.requestId,
  ]);

  useEffect(() => {
    departmentService
      .list()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    salaryStructureService
      .list()
      .then(setSalaryStructures)
      .catch(() => setSalaryStructures([]));
  }, []);

  useEffect(() => {
    userService
      .listManagers()
      .then(setManagers)
      .catch(() => setManagers([]));
  }, []);

  useEffect(() => {
    shiftService
      .listAll()
      .then(setShifts)
      .catch(() => setShifts([]));
  }, []);

  const [appliedSearchRequest, setAppliedSearchRequest] =
    useState(employeeSearchRequest);

  if (employeeSearchRequest !== appliedSearchRequest) {
    setAppliedSearchRequest(employeeSearchRequest);

    if (employeeSearchRequest) {
      setViewingEmployee(undefined);
      setSearch(employeeSearchRequest.query);
      setDepartmentFilter("");
      setStatusFilter("");
      setPage(1);
    }
  }

  const [appliedSelectionRequest, setAppliedSelectionRequest] =
    useState(employeeSelectionRequest);

  if (employeeSelectionRequest !== appliedSelectionRequest) {
    setAppliedSelectionRequest(employeeSelectionRequest);

    if (employeeSelectionRequest) {
      setViewingEmployee(undefined);
      setError(null);
      setIsLoading(true);
    }
  }

  useEffect(() => {
    if (!employeeSelectionRequest) return;

    let cancelled = false;

    employeeService
      .get(employeeSelectionRequest.employeeId)
      .then((employee) => {
        if (!cancelled) {
          setViewingEmployee(employee);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to load the selected employee.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [employeeSelectionRequest]);

  function openCreateForm() {
    setEditingEmployee(undefined);
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(employee: Employee) {
    setEditingEmployee(employee);
    setFormError(null);
    setIsFormOpen(true);
  }

  function clearFilters() {
    setPage(1);
    setSearch("");
    setDepartmentFilter("");
    setStatusFilter("");
    if (specialFilter) {
      const next = new URLSearchParams(searchParams);
      next.delete("filter");
      setSearchParams(next);
    }
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingEmployee(undefined);
    setFormError(null);
  }

  async function handleFormSubmit(data: EmployeeCreate) {
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingEmployee) {
        const { avatar_file, avatar_remove, ...employeeData } = data;
        let updated = await employeeService.update(editingEmployee.id, employeeData);

        if (avatar_file) {
          updated = await employeeService.uploadAvatar(editingEmployee.id, avatar_file);
        } else if (avatar_remove) {
          updated = await employeeService.removeAvatar(editingEmployee.id);
        }

        setViewingEmployee((current) =>
          current?.id === editingEmployee.id ? updated : current,
        );
      } else {
        const { avatar_file, ...employeeData } = data;
        delete employeeData.avatar_remove;
        let created = await employeeService.create(employeeData);

        if (avatar_file) {
          created = await employeeService.uploadAvatar(created.id, avatar_file);
        }

        if (created.credentials) {
          setSharedCredentials({
            name: `${created.first_name} ${created.last_name}`,
            credentials: created.credentials,
          });
        }
      }

      closeForm();
      setToastMessage(editingEmployee ? "Employee updated successfully." : "Employee created successfully.");
      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to save employee.";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateEmployee(
    employeeId: string,
    data: {
      emergency_contact?: {
        name: string;
        relationship: string;
        phone: string;
        address: string;
      };
      bank_information?: {
        bank_name: string;
        account_holder_name: string;
        account_number: string;
        ifsc_code: string;
      };
    },
  ): Promise<Employee> {
    const updated = await employeeService.update(employeeId, data);

    setViewingEmployee((current) =>
      current?.id === employeeId ? updated : current,
    );

    setEmployees((current) =>
      current.map((employee) =>
        employee.id === employeeId ? updated : employee,
      ),
    );

    return updated;
  }

  async function handleDeactivate(employee: Employee) {
    try {
      const updated = await employeeService.deactivate(employee.id);
      setViewingEmployee((current) =>
        current?.id === employee.id ? updated : current,
      );
      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to deactivate employee.";
      setError(message);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    try {
      await employeeService.remove(pendingDeleteId);
      setPendingDeleteId(null);
      await loadEmployees();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete employee.";
      setError(message);
      setPendingDeleteId(null);
    }
  }

  function exportCsv() {
    if (filteredEmployees.length === 0) return;

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const headers = ["Employee ID", "Name", "Email", "Department", "Designation", "Status", "Joining Date"];
    const rows = filteredEmployees.map((employee) => [
      employee.employee_id,
      `${employee.first_name} ${employee.last_name}`.trim(),
      employee.email,
      employee.department_id,
      employee.designation || "-",
      employee.status,
      employee.joining_date || "-",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employees.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  // Client filtering
  const filteredEmployees = employees.filter((emp) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const email = emp.email.toLowerCase();
      const empId = emp.employee_id.toLowerCase();
      if (!fullName.includes(q) && !email.includes(q) && !empId.includes(q)) {
        return false;
      }
    }

    if (departmentFilter) {
      if (emp.department_id !== departmentFilter) {
        const dept = departments.find((d) => d.id === departmentFilter);
        if (dept && !emp.designation.toLowerCase().includes(dept.name.toLowerCase())) {
          return false;
        }
      }
    }

    if (statusFilter && emp.status !== statusFilter) {
      return false;
    }

    return true;
  });

  const totalEmployeesCount = metrics.totalEmployees ?? employees.length;
  const presentTodayCount = metrics.presentToday ?? 0;
  const presentPercent = metrics.presentPercent ?? 0;
  const onLeaveCount = metrics.onLeaveToday ?? 0;
  const onLeavePercent = metrics.onLeavePercent ?? 0;
  const pendingLeaveRequests = metrics.pendingLeaveRequests ?? 0;

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredEmployees.slice(start, start + rowsPerPage);
  }, [filteredEmployees, page, rowsPerPage]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    const currentIds = paginatedEmployees.map((e) => e.id);
    const allSelected = currentIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentIds])));
    }
  }

  if (viewingEmployee) {
    return (
      <>
        <AdminEmployeeDetailsPage
          employee={viewingEmployee}
          departments={departments}
          salaryStructures={salaryStructures}
          shifts={shifts}
          onBack={() => setViewingEmployee(undefined)}
          onEdit={openEditForm}
          onDeactivate={handleDeactivate}
          onUpdateEmployee={handleUpdateEmployee}
        />

        {isFormOpen && (
          <AdminEmployeeForm
            departments={departments}
            salaryStructures={salaryStructures}
            managers={managers}
            shifts={shifts}
            initialEmployee={editingEmployee}
            isSubmitting={isSubmitting}
            errorMessage={formError}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Header Row */}
      <PageHeading
        title="Manage and view your team"
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredEmployees.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-[18px] w-[18px] shrink-0 text-gray-500" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0052cc] active:scale-95"
            >
              <UserPlus className="h-[18px] w-[18px] shrink-0" />
              <span>Add Employee</span>
            </button>
          </>
        }
      />

      {/* 2. Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#6B7280]">Total Employees</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827] tabular-nums">{totalEmployeesCount}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0066ff]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-[12px] text-[#6B7280]">Across all departments</p>
        </div>

        {/* Present Today */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#6B7280]">Present Today</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827] tabular-nums">{presentTodayCount}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#16a34a]">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Attendance rate</span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              {presentPercent}%
            </span>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-emerald-50/60 blur-xl" />
        </div>

        {/* On Leave */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#6B7280]">On Leave</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827] tabular-nums">{onLeaveCount}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ea580c]">
              <Umbrella className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Approved leaves</span>
            <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700">
              {onLeavePercent}%
            </span>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-orange-50/60 blur-xl" />
        </div>

        {/* Pending Leave Requests */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-[#6B7280]">Pending Leave Requests</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-[#111827] tabular-nums">{pendingLeaveRequests}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#7c3aed]">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Awaiting review</span>
            <button type="button" onClick={() => navigate("/dashboard/leave")} className="text-[12px] font-medium text-[#2563EB] hover:underline">
              View
            </button>
          </div>
        </div>
      </div>

      {specialFilter && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700">
          <span className="flex items-center gap-1.5">
            <span>Filtered by:</span>
            <span className="font-bold underline">
              {specialFilter === "new_joiners"
                ? "New Joiners (Last 30 Days)"
                : specialFilter === "missing_salary_structure"
                  ? "Employees Missing Salary Structure"
                  : specialFilter}
            </span>
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100 hover:underline"
          >
            Clear Filter ✕
          </button>
        </div>
      )}

      {/* 3. Table Card */}
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search employees by name or code..."
              className="h-9 w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-[13px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(event) => {
                  setPage(1);
                  setDepartmentFilter(event.target.value);
                }}
                className="h-9 appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
              >
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
                className="h-9 appearance-none rounded-lg border border-[#E5E7EB] bg-white pl-3 pr-8 text-[13px] text-[#374151] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE]"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            </div>
            <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">
              <RotateCcw className="h-4 w-4" /> Clear Filters
            </button>
          </div>
        </div>

        {specialFilter && (
          <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700">
            <span className="flex items-center gap-1.5">
              <span>Filtered by:</span>
              <span className="font-bold underline">
                {specialFilter === "new_joiners"
                  ? "New Joiners (Last 30 Days)"
                  : specialFilter === "missing_salary_structure"
                    ? "Employees Missing Salary Structure"
                    : specialFilter}
              </span>
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-100 hover:underline"
            >
              Clear Filter ✕
            </button>
          </div>
        )}

        {isLoading && employees.length === 0 ? (
          <div className="p-4">
            <TableSkeleton rows={5} columns={7} className="rounded-none border-0" />
          </div>
        ) : error && employees.length === 0 ? (
          <ErrorState title="Could not load employees" message={error} onRetry={() => void loadEmployees()} className="min-h-[220px] max-w-none p-6" />
        ) : (
          <>
            <AdminEmployeeTable
              employees={paginatedEmployees}
              departments={departments}
              onView={setViewingEmployee}
              onEdit={openEditForm}
              onDeactivate={handleDeactivate}
              onDelete={(employee) => setPendingDeleteId(employee.id)}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onClearFilters={clearFilters}
            />

            {/* Pagination Footer */}
            <div className="flex flex-col gap-3 border-t border-[#E5E7EB] px-4 py-3 text-[12px] text-[#6B7280] md:flex-row md:items-center md:justify-between">
              <span>
                Showing {filteredEmployees.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}-
                {Math.min(page * rowsPerPage, filteredEmployees.length)} of {filteredEmployees.length} employees
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  Rows per page
                  <select
                    value={rowsPerPage}
                    onChange={(event) => {
                      setRowsPerPage(Number(event.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2 text-[12px] text-[#374151] outline-none focus:border-[#2563EB]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="h-8 rounded-full px-3 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:bg-[#F3F4F6] disabled:text-[#D1D5DB]"
                >
                  Previous
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${page === p
                      ? "bg-[#0066ff] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                      }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="h-8 rounded-full px-3 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:bg-[#F3F4F6] disabled:text-[#D1D5DB]"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {isFormOpen && (
        <AdminEmployeeForm
          departments={departments}
          salaryStructures={salaryStructures}
          managers={managers}
          shifts={shifts}
          initialEmployee={editingEmployee}
          isSubmitting={isSubmitting}
          errorMessage={formError}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
        />
      )}

      {/* Shared Credentials Modal */}
      {sharedCredentials && (
        <CredentialsModal
          credentials={sharedCredentials.credentials}
          employeeName={sharedCredentials.name}
          onClose={() => setSharedCredentials(null)}
        />
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-3 text-[13px] text-white shadow-lg"
        >
          <Check className="h-4 w-4 text-[#86EFAC]" />
          {toastMessage}
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="ml-2 text-white/70 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl sm:p-7">
            <h3 className="text-lg font-bold text-slate-900">
              Delete employee?
            </h3>
            <p className="mt-2 text-xs text-slate-500">
              This action cannot be undone and will remove the employee records permanently.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="rounded bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEmployees;
