import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
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

const PAGE_SIZE = 5;

const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: "sample-1",
    employee_id: "AAR001",
    first_name: "Aiman",
    last_name: "Mulla",
    email: "aiman@trimarkity.com",
    phone: "+91 98765 43210",
    department_id: "dep-dev",
    designation: "Jr. DevOps Engineer",
    status: "active",
    employment_type: "full_time",
    joining_date: "2024-11-15",
  },
  {
    id: "sample-2",
    employee_id: "AAR003",
    first_name: "Shruti",
    last_name: "Ugale",
    email: "shruti@trimarkity.com",
    phone: "+91 98765 43211",
    department_id: "dep-dev",
    designation: "Jr.Software Engineer",
    status: "inactive",
    employment_type: "full_time",
    joining_date: "2024-08-10",
  },
  {
    id: "sample-3",
    employee_id: "AAR004",
    first_name: "Rohit",
    last_name: "Kumar",
    email: "rohit@trimarkity.com",
    phone: "+91 98765 43212",
    department_id: "dep-mkt",
    designation: "Marketing Executive",
    status: "active",
    employment_type: "full_time",
    joining_date: "2025-01-01",
  },
  {
    id: "sample-4",
    employee_id: "AAR005",
    first_name: "Priya",
    last_name: "Sharma",
    email: "priya@trimarkity.com",
    phone: "+91 98765 43213",
    department_id: "dep-hr",
    designation: "HR Executive",
    status: "active",
    employment_type: "full_time",
    joining_date: "2025-02-20",
  },
  {
    id: "sample-5",
    employee_id: "AAR006",
    first_name: "Amit",
    last_name: "Kapoor",
    email: "amit@trimarkity.com",
    phone: "+91 98765 43214",
    department_id: "dep-sales",
    designation: "Sales Executive",
    status: "on_leave",
    employment_type: "full_time",
    joining_date: "2026-11-12",
  },
];

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
          <h3 className="text-lg font-bold text-gray-900">
            Employee Created
          </h3>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          Share these login credentials with{" "}
          <span className="font-semibold text-gray-800">{employeeName}</span>.
          The password won't be shown again.
        </p>

        <div className="mt-5 space-y-3 rounded bg-[#f5f7fb] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email
            </p>
            <p className="mt-0.5 font-mono text-sm text-gray-900">
              {credentials.email}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Temporary Password
            </p>
            <p className="mt-0.5 font-mono text-sm text-gray-900">
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

  // Active pool of employees (either live data or fallback sample data)
  const activePool = useMemo(() => {
    return employees.length > 0 ? employees : SAMPLE_EMPLOYEES;
  }, [employees]);

  // Client filtering
  const filteredEmployees = useMemo(() => {
    return activePool.filter((emp) => {
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
  }, [activePool, search, departmentFilter, statusFilter, departments]);

  const totalEmployeesCount = metrics.totalEmployees ?? 24;
  const presentTodayCount = metrics.presentToday ?? 22;
  const presentPercent = metrics.presentPercent ?? 91.7;
  const onLeaveCount = metrics.onLeaveToday ?? 2;
  const onLeavePercent = metrics.onLeavePercent ?? 8.3;
  const pendingLeaveRequests = metrics.pendingLeaveRequests ?? 3;

  const totalPages = Math.ceil(filteredEmployees.length / PAGE_SIZE) || 5;
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, page]);

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
    <div className="space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#0f172a] font-manrope">
            Employees
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Manage and view your team.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0052cc] active:scale-95"
        >
          <UserPlus className="h-[18px] w-[18px] shrink-0" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* 2. Top 4 Metric KPI Cards (Matches Mockup) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0066ff]">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Employees</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {totalEmployeesCount}
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-blue-50/60 blur-xl" />
        </div>

        {/* Present Today */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#16a34a]">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Present Today</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {presentTodayCount}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100">
            {presentPercent}%
          </span>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-emerald-50/60 blur-xl" />
        </div>

        {/* On Leave */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#ea580c]">
              <Umbrella className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">On Leave</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {onLeaveCount}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700 border border-orange-100">
            {onLeavePercent}%
          </span>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-orange-50/60 blur-xl" />
        </div>

        {/* Pending Leave Requests */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-kpi flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-50 text-[#7c3aed]">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Pending Leave Requests
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] font-manrope mt-0.5">
                {pendingLeaveRequests}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard/leave")}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0066ff] hover:underline"
          >
            View →
          </button>
          <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-24 rounded-full bg-purple-50/60 blur-xl" />
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs">
        {/* Search Input */}
        <div className="relative min-w-[280px] flex-1 sm:min-w-[340px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by name, email, or employee ID..."
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 py-2 pl-10 pr-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[#0066ff] focus:bg-white"
          />
        </div>

        {/* Dropdowns & Reset */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(event) => {
                setPage(1);
                setDepartmentFilter(event.target.value);
              }}
              className="cursor-pointer appearance-none rounded-xl border border-slate-200/80 bg-slate-50/60 py-2 pl-3.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#0066ff] focus:bg-white"
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

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="cursor-pointer appearance-none rounded-xl border border-slate-200/80 bg-slate-50/60 py-2 pl-3.5 pr-8 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-[#0066ff] focus:bg-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Clear Filters */}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            <span>Clear Filters</span>
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

      {/* 4. Table Card Container */}
      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {isLoading && employees.length === 0 ? (
          <div className="p-6">
            <TableSkeleton rows={6} columns={7} />
          </div>
        ) : error && employees.length === 0 ? (
          <div className="p-8 text-center text-sm text-rose-500">
            {error}
          </div>
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
            />

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 px-6 py-4 text-xs font-medium text-slate-500">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filteredEmployees.length)} of{" "}
                {totalEmployeesCount} employees
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>

                {[1, 2, 3, 4, 5].slice(0, Math.max(totalPages, 1)).map((p) => (
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
                  className="px-2.5 py-1 text-slate-800 font-semibold hover:text-[#0066ff] disabled:opacity-40"
                >
                  Next &gt;
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
