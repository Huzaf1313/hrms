// ---- Types ----------------------------------------------------------------

interface MonthlyPayroll {
  month: string;
  gross: number;
  deductions: number;
  net: number;
}

interface DepartmentPayroll {
  department: string;
  employees: number;
  gross: number;
  net: number;
}

// ---- Mock data (swap for real API data later) ------------------------------
// These should come from payroll records, aggregated by month and by department.

const monthlyPayrollData: MonthlyPayroll[] = [
  { month: "Jan", gross: 3500000, deductions: 400000, net: 3100000 },
  { month: "Feb", gross: 3500000, deductions: 400000, net: 3100000 },
  { month: "Mar", gross: 3600000, deductions: 420000, net: 3180000 },
  { month: "Apr", gross: 3600000, deductions: 410000, net: 3190000 },
  { month: "May", gross: 3645000, deductions: 430000, net: 3215000 },
];

const departmentPayrollData: DepartmentPayroll[] = [
  { department: "Engineering", employees: 45, gross: 1520000, net: 1345000 },
  { department: "HR", employees: 8, gross: 270000, net: 245000 },
  { department: "Sales", employees: 32, gross: 1080000, net: 950000 },
  { department: "Marketing", employees: 15, gross: 510000, net: 460000 },
  { department: "Finance", employees: 12, gross: 420000, net: 380000 },
];

// ---- Helpers ----------------------------------------------------------------

// Formats a raw rupee amount as the "₹35L" / "₹4.2L" style used in the mock,
// and as a full "₹15,20,000" style for the department table.
function formatLakhs(amount: number): string {
  const lakhs = amount / 100000;
  const rounded = Math.round(lakhs * 100) / 100;
  return `₹${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}L`;
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// ---- Reusable table shell ----------------------------------------------------

interface ReportTableProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

function ReportTable({ title, columns, rows }: ReportTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <h2 className="border-b border-slate-100 px-5 py-4 text-sm font-bold tracking-wide text-slate-900">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide"
                  >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-50 transition-colors last:border-b-0 hover:bg-blue-50/40"
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-5 py-3 text-slate-600 ${j === 0 ? "font-medium text-slate-800" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- Reports page ------------------------------------------------------------

export default function Reports() {
  const monthlyRows = monthlyPayrollData.map((row) => [
    row.month,
    formatLakhs(row.gross),
    formatLakhs(row.deductions),
    formatLakhs(row.net),
  ]);

  const departmentRows = departmentPayrollData.map((row) => [
    row.department,
    row.employees,
    formatRupees(row.gross),
    formatRupees(row.net),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Payroll analytics and department summaries.</p>
      </div>

      <ReportTable
        title="Monthly payroll"
        columns={["Month", "Gross", "Deductions", "Net"]}
        rows={monthlyRows}
      />

      <ReportTable
        title="Department-wise"
        columns={["Department", "Employees", "Gross", "Net"]}
        rows={departmentRows}
      />

      <p className="text-xs text-slate-400">
        These values are grouped by month and department.
      </p>
    </div>
  );
}
