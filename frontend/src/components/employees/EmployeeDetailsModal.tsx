import type { Department } from "../../types/department";
import type { Employee } from "../../types/employee";

interface EmployeeDetailsModalProps {
  employee: Employee;
  departments: Department[];
  onClose: () => void;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function EmployeeDetailsModal({
  employee,
  departments,
  onClose,
}: EmployeeDetailsModalProps) {
  const departmentName =
    departments.find((department) => department.id === employee.department_id)
      ?.name ?? "—";

  const initials =
    `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dce8df] text-lg font-semibold text-[#456b54]">
              {initials || "?"}
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-[#17375e]">
                {employee.first_name} {employee.last_name}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                ID: {employee.employee_id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 px-8 py-6 md:grid-cols-2">
          <Field label="Email" value={employee.email} />
          <Field label="Phone" value={employee.phone} />
          <Field label="Designation" value={employee.designation} />
          <Field label="Department" value={departmentName} />
          <Field label="Employment Type" value={employee.employment_type} />
          <Field label="Status" value={employee.status} />
          <Field label="Joining Date" value={employee.joining_date} />
          <Field label="Work Location" value={employee.work_location} />
          <Field label="Reporting Manager" value={employee.reporting_manager} />
          <Field label="Gender" value={employee.gender} />
          <Field label="Date of Birth" value={employee.date_of_birth} />
          <Field label="Address" value={employee.address} />
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetailsModal;
