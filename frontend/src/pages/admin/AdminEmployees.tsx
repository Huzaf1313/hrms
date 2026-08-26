import { useEffect, useState } from "react";

import EmployeeDetailsPage from "../../components/employees/EmployeeDetailsPage";
import EmployeeForm from "../../components/employees/EmployeeForm";
import EmployeeTable from "../../components/employees/EmployeeTable";
import { ApiError } from "../../services/api";
import { departmentService } from "../../services/departmentService";
import { employeeService } from "../../services/employeeService";
import type { Department } from "../../types/department";
import type { Employee, EmployeeCreate } from "../../types/employee";

const PAGE_SIZE = 10;

function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
        await employeeService.create(data);
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
        <EmployeeDetailsPage
          employee={viewingEmployee}
          departments={departments}
          onBack={() => setViewingEmployee(undefined)}
          onEdit={openEditForm}
          onDeactivate={handleDeactivate}
        />

        {isFormOpen && (
          <EmployeeForm
            departments={departments}
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-[#2563eb]">Employees</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage and view your team.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white"
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
            <EmployeeTable
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
        <EmployeeForm
          departments={departments}
          initialEmployee={editingEmployee}
          isSubmitting={isSubmitting}
          errorMessage={formError}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
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

