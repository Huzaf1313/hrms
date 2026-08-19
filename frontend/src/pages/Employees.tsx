import { useEffect, useState } from "react";

import EmployeeTable from "../components/employees/EmployeeTable";
import { ApiError } from "../services/api";
import { employeeService } from "../services/employeeService";
import type { Employee } from "../types/employee";

const PAGE_SIZE = 10;

function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadEmployees() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await employeeService.list({
          search: search || undefined,
          page,
          limit: PAGE_SIZE,
        });

        if (!isCancelled) {
          setEmployees(data);
        }
      } catch (err) {
        if (!isCancelled) {
          const message =
            err instanceof ApiError ? err.message : "Failed to load employees.";
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEmployees();

    return () => {
      isCancelled = true;
    };
  }, [search, page]);

  return (
    <div className="px-10 pb-10 pt-8">
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-[#456b54]">Employees</h1>

        <p className="mt-2 text-lg text-gray-600">
          Manage and view your team directory.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-gray-800">
            Employee Directory
          </h2>

          <input
            type="text"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by name, ID, or email"
            className="w-72 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-[#456b54] focus:outline-none"
          />
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
            <EmployeeTable employees={employees} />

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
    </div>
  );
}

export default Employees;
