import type { Employee } from "../../types/employee";

interface EmployeeTableProps {
  employees: Employee[];
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-700";
    case "inactive":
      return "bg-stone-100 text-stone-700";
    case "terminated":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function EmployeeTable({ employees }: EmployeeTableProps) {
  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-500">
        No employees found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Employee ID</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Designation</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>

        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-t border-gray-100">
              <td className="px-4 py-3 font-medium text-gray-700">
                {employee.employee_id}
              </td>
              <td className="px-4 py-3 text-gray-700">
                {employee.first_name} {employee.last_name}
              </td>
              <td className="px-4 py-3 text-gray-500">{employee.email}</td>
              <td className="px-4 py-3 text-gray-500">{employee.designation}</td>
              <td className="px-4 py-3 text-gray-500">{employee.department_id}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(employee.status)}`}
                >
                  {employee.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EmployeeTable;
