import { useEffect, useState } from "react";
import {
  adminPayrollService,
  type PayrollAnalyticsData,
} from "../../services/adminPayrollService";
import { Loader2, RefreshCw, AlertCircle, Calendar } from "lucide-react";

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface ReportTableProps {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  emptyMessage?: string;
}

function ReportTable({ title, columns, rows, emptyMessage = "No records found" }: ReportTableProps) {
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 transition-colors last:border-b-0 hover:bg-blue-50/40"
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`whitespace-nowrap px-5 py-3 text-slate-600 ${
                        j === 0 ? "font-medium text-slate-800" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Reports() {
  const [data, setData] = useState<PayrollAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedYear === "all" ? { months: 12 } : { year: parseInt(selectedYear, 10) };
      const response = await adminPayrollService.getAnalytics(params);
      setData(response);
    } catch (err: any) {
      setError(err?.message || "Failed to load payroll reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  const timelineRows = (data?.timeline || [])
    .filter((t) => t.records_count > 0 || selectedYear !== "all")
    .map((row) => [
      `${row.month_name} ${row.year}`,
      row.records_count,
      formatRupees(row.gross),
      formatRupees(row.deductions),
      formatRupees(row.net),
    ]);

  const departmentRows = (data?.departments || []).map((dept) => [
    dept.department,
    dept.employees,
    formatRupees(dept.gross),
    formatRupees(dept.net),
    dept.status,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Real aggregated payroll analytics and department summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm text-xs font-medium text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="all">Last 12 Months</option>
              {(data?.available_years || []).map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <ReportTable
            title="Monthly Payroll Summary"
            columns={["Period", "Processed Records", "Gross Salary", "Total Deductions", "Net Salary"]}
            rows={timelineRows}
            emptyMessage="No payroll records generated for the selected period."
          />

          <ReportTable
            title="Department-wise Payroll Breakdown"
            columns={["Department", "Employees", "Gross Salary", "Net Salary", "Status"]}
            rows={departmentRows}
            emptyMessage="No department payroll data available for this period."
          />
        </div>
      )}

      <p className="text-xs text-slate-400">
        Data is dynamically calculated from persisted employee payroll records in MongoDB.
      </p>
    </div>
  );
}
