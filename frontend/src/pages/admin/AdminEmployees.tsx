import { useEffect, useState } from "react";

import AdminEmployeeDetailsPage from "../../components/admin/AdminEmployeeDetailsPage";
import AdminEmployeeForm from "../../components/admin/AdminEmployeeForm";
import AdminEmployeeTable from "../../components/admin/AdminEmployeeTable";
import { ApiError } from "../../services/api";
import {
  salaryStructureService,
  type SalaryStructure,
} from "../../services/admin_salary_structure_service";
import { departmentService } from "../../services/departmentService";
import { employeeService } from "../../services/employeeService";
import {
  userService,
  type ManagerAccount,
} from "../../services/userService";
import type { Department } from "../../types/department";
import type {
  Employee,
  EmployeeCreate,
  EmployeeCredentials,
} from "../../types/employee";

const PAGE_SIZE = 10;

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
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            ✓
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

        <div className="mt-5 space-y-3 rounded-2xl bg-[#f5f7fb] p-4">
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
            className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {copied ? "Copied ✓" : "Copy Credentials"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdminEmployeesProps {
  autoOpenCreateForm?: boolean;
}

function AdminEmployees({ autoOpenCreateForm = false }: AdminEmployeesProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[]>(
    [],
  );
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function loadEmployees() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await employeeService.list({
        search: search || undefined,
        department_id: departmentFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setEmployees(data);
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
  }, [search, departmentFilter, statusFilter, page]);

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
        const updated = await employeeService.update(editingEmployee.id, data);
        setViewingEmployee((current) =>
          current?.id === editingEmployee.id ? updated : current,
        );
      } else {
        const created = await employeeService.create(data);

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

  if (viewingEmployee) {
    return (
      <>
        <AdminEmployeeDetailsPage
          employee={viewingEmployee}
          departments={departments}
          salaryStructures={salaryStructures}
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
    <div className="px-10 pb-10 pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Employees</h1>
          <p className="mt-1 text-gray-500">
            Manage and view your team.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          + Add Employee
        </button>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search employees…"
            className="min-w-[220px] flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm focus:border-[#2563eb] focus:outline-none"
          />

          <select
            value={departmentFilter}
            onChange={(event) => {
              setPage(1);
              setDepartmentFilter(event.target.value);
            }}
            className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 focus:border-[#2563eb] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ⇅ Clear Filters
          </button>
        </div>

        {isLoading && (
          <div className="py-10 text-center text-gray-500">
            Loading employees…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl bg-red-50 p-6 text-center text-red-600">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            <AdminEmployeeTable
              employees={employees}
              departments={departments}
              onView={setViewingEmployee}
              onEdit={openEditForm}
              onDeactivate={handleDeactivate}
              onDelete={(employee) => setPendingDeleteId(employee.id)}
            />

            <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page}</span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-gray-200 px-4 py-2 disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={employees.length < PAGE_SIZE}
                  className="rounded-full border border-gray-200 px-4 py-2 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isFormOpen && (
        <AdminEmployeeForm
          departments={departments}
          salaryStructures={salaryStructures}
          managers={managers}
          initialEmployee={editingEmployee}
          isSubmitting={isSubmitting}
          errorMessage={formError}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
        />
      )}

      {sharedCredentials && (
        <CredentialsModal
          credentials={sharedCredentials.credentials}
          employeeName={sharedCredentials.name}
          onClose={() => setSharedCredentials(null)}
        />
      )}

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800">Delete employee?</h3>
            <p className="mt-2 text-sm text-gray-500">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
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


