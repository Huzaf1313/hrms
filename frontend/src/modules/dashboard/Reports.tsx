import { useEffect, useState } from "react";
import {
  adminPayrollService,
  type PayrollAnalyticsData,
} from "../payroll/adminPayrollService";
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

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === "Completed" || status === "Paid";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
        isComplete
          ? "bg-[#E3F5E1] text-[#1E6B45] border-[#BCE8B5]"
          : "bg-[#FDF3D6] text-[#8A5A00] border-[#F6DE95]"
      }`}
    >
      {status}
    </span>
  );
}

function isNumericCol(name: string): boolean {
  return ["Processed Records", "Gross Salary", "Total Deductions", "Net Salary", "Employees"].includes(name);
}

function ReportTable({ title, columns, rows, emptyMessage = "No records found" }: ReportTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#E4E6E1] bg-white shadow-none">
      <h2 className="border-b border-[#E4E6E1] px-5 py-4 text-base font-semibold text-[#1F2933]">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="h-11 border-b border-[#E4E6E1] bg-[#FAFAF8] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
              {columns.map((col) => (
                <th
                  key={col}
                  className={`whitespace-nowrap px-5 py-3 font-medium ${
                    isNumericCol(col) ? "text-right" : "text-left"
                  }`}
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
                  className="px-5 py-8 text-center text-xs text-[#7B8794]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="min-h-[52px] border-b border-[#E4E6E1]/50 transition-colors last:border-b-0 hover:bg-[#FAFAF8]"
                >
                  {row.map((cell, j) => {
                    const col = columns[j];
                    if (col === "Status") {
                      return (
                        <td key={j} className="whitespace-nowrap px-5 py-3.5 text-left">
                          <StatusBadge status={String(cell)} />
                        </td>
                      );
                    }
                    if (isNumericCol(col)) {
                      return (
                        <td
                          key={j}
                          className="whitespace-nowrap px-5 py-3.5 text-right font-medium tabular-nums text-[#1F2933]"
                        >
                          {cell}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={j}
                        className={`whitespace-nowrap px-5 py-3.5 text-left ${
                          j === 0 ? "font-semibold text-[#1F2933]" : "text-[#52606D]"
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
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
          <h2 className="text-base font-semibold text-[#1F2933]">Payroll Reports</h2>
          <p className="mt-1 text-sm text-[#7B8794]">
            Real aggregated payroll analytics and department summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 items-center gap-2 rounded-[6px] border border-[#E4E6E1] bg-white px-3 text-xs font-medium text-[#1F2933]">
            <Calendar className="h-4 w-4 text-[#7B8794]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent outline-none cursor-pointer text-xs text-[#1F2933]"
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
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E6E1] bg-white px-3.5 text-xs font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#2F5FD0]" />
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

      <p className="text-xs text-[#7B8794]">
        Data is dynamically calculated from persisted employee payroll records in MongoDB.
      </p>
    </div>
  );
}
