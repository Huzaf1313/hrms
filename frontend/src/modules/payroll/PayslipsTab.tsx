import { useEffect, useState, useCallback } from "react";
import {
  Eye,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer,
  Mail,
  Users,
  Send,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys";
import {
  adminPayrollService,
  type AdminPayslipItem,
  type SalaryBreakdownItem,
  type BulkGeneratePayslipsResult,
} from "./adminPayrollService";
import { employeeService } from "../employees/employeeService";
import type { Employee } from "../employees/types";

function formatCurrency(value: number): string {
  return `₹${(value || 0).toLocaleString("en-IN")}`;
}

const statusBadgeStyles: Record<string, string> = {
  Paid: "bg-[#E3F5E1] text-[#1E6B45] border border-[#BCE8B5]",
  Credited: "bg-[#E3F5E1] text-[#1E6B45] border border-[#BCE8B5]",
  Processing: "bg-[#E8EEFB] text-[#2F5FD0] border border-[#2F5FD0]/20",
  Pending: "bg-[#FDF3D6] text-[#8A5A00] border border-[#F6DE95]",
  Failed: "bg-[#FBE4E1] text-[#A12D22] border border-[#FBE4E1]",
};

interface PayslipDetailModalProps {
  payslip: AdminPayslipItem;
  onClose: () => void;
  onStatusUpdated: () => void;
}

function PayslipDetailModal({ payslip, onClose, onStatusUpdated }: PayslipDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const earningsList: SalaryBreakdownItem[] = payslip.salary?.earnings && payslip.salary.earnings.length > 0
    ? payslip.salary.earnings
    : [{ label: "Basic Salary", amount: payslip.salary?.basic || payslip.salary?.gross || 0 }];

  const deductionsList: SalaryBreakdownItem[] = payslip.deductions?.items && payslip.deductions.items.length > 0
    ? payslip.deductions.items
    : Object.entries(payslip.deductions || {})
      .filter(([k, v]) => k !== "total" && k !== "items" && typeof v === "number" && v > 0)
      .map(([k, v]) => ({ label: k.replace(/_/g, " ").toUpperCase(), amount: Number(v) }));

  const maxRows = Math.max(earningsList.length, deductionsList.length, 1);
  const rows = [];
  for (let i = 0; i < maxRows; i++) {
    rows.push({
      earning: earningsList[i] || null,
      deduction: deductionsList[i] || null,
    });
  }

  const gross = payslip.salary?.gross || 0;
  const deductionsTotal = payslip.deductions?.total || 0;
  const net = payslip.net_salary || 0;
  const status = payslip.payment?.status || payslip.status || "Processing";
  const isPaid = status === "Paid" || status === "Credited";

  const queryClient = useQueryClient();

  const handleMarkAsPaid = async () => {
    setUpdating(true);
    setUpdateError(null);
    try {
      await adminPayrollService.updateStatus(payslip.id, "Paid");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "payslips"],
      });
      onStatusUpdated();
      onClose();
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to mark payslip as paid");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    setUpdateError(null);
    try {
      const res = await adminPayrollService.sendEmail(payslip.id);
      setEmailStatus(res.message || "Payslip email dispatched successfully");
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .payslip-printable, .payslip-printable * {
            visibility: visible !important;
          }
          .payslip-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 24px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="no-print flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900">Payslip Details</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeStyles[status] || "bg-slate-100 text-slate-700"
                }`}
            >
              {status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              title="Print or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50"
              title="Email Payslip to Employee"
            >
              {sendingEmail ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5 text-blue-600" />
              )}
              Email
            </button>
            {!isPaid && (
              <button
                type="button"
                onClick={handleMarkAsPaid}
                disabled={updating}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark as Paid
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {updateError && (
          <div className="no-print mx-6 mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{updateError}</span>
          </div>
        )}

        {emailStatus && (
          <div className="no-print mx-6 mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{emailStatus}</span>
          </div>
        )}

        <div className="payslip-printable relative p-6 sm:p-8">
          <header className="flex flex-col gap-4 border-b-2 border-slate-700 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/peoplesync-logo.png"
                alt="PeopleSync logo"
                className="h-14 w-14 object-contain"
              />
              <div>
                <div className="font-sans text-xl font-bold tracking-tight text-[#0066ff]">
                  PeopleSync Technologies Pvt. Ltd.
                </div>
                <div className="text-xs text-slate-500">Human Resources &amp; Payroll</div>
              </div>
            </div>
            <div className="text-left text-xs leading-5 text-slate-600 sm:text-right">
              <div>Website: <span className="text-[#0066ff] font-medium">www.peoplesync.io</span></div>
              <div>Email: hr@peoplesync.io</div>
              <div>Month: <span className="font-semibold text-slate-900">{payslip.month}</span></div>
            </div>
          </header>

          <section className="mt-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Employee Information
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-xs sm:grid-cols-3">
              <div>
                <span className="text-slate-400">Name:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.employee_name || payslip.employee_id}</span>
              </div>
              <div>
                <span className="text-slate-400">Employee ID:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.employee_code || payslip.employee_id}</span>
              </div>
              <div>
                <span className="text-slate-400">Designation:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.designation || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400">Department:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.department || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400">Bank Name:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.bank_name || payslip.bank_details?.bank_name || "-"}</span>
              </div>
              <div>
                <span className="text-slate-400">Account No:</span>{" "}
                <span className="font-semibold text-slate-800">{payslip.account_number || payslip.bank_details?.account_number || "-"}</span>
              </div>
            </div>
          </section>

          {(payslip as any).attendance_summary && ((payslip as any).attendance_summary.total_days || 0) > 0 && (
            <section className="mt-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Attendance & Leave Summary
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-400">Working Days:</span>{" "}
                  <span className="font-semibold text-slate-800">{(payslip as any).attendance_summary.total_days}</span>
                </div>
                <div>
                  <span className="text-slate-400">Present Days:</span>{" "}
                  <span className="font-semibold text-emerald-700">{(payslip as any).attendance_summary.present_days}</span>
                </div>
                <div>
                  <span className="text-slate-400">Paid Leaves:</span>{" "}
                  <span className="font-semibold text-blue-700">{(payslip as any).attendance_summary.paid_leave_days || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400">Loss of Pay (LOP):</span>{" "}
                  <span className={`font-semibold ${((payslip as any).attendance_summary.lop_days || 0) > 0 ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                    {((payslip as any).attendance_summary.lop_days || 0)} days
                    {((payslip as any).attendance_summary.lop_deduction || 0) > 0 && (
                      <span className="ml-1 text-[11px] text-rose-600">(-₹{((payslip as any).attendance_summary.lop_deduction).toLocaleString("en-IN")})</span>
                    )}
                  </span>
                </div>
              </div>
            </section>
          )}

          <section className="mt-6">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Salary Breakdown
            </h4>
            <div className="overflow-hidden rounded-lg border border-slate-200 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
                    <th className="px-4 py-2.5 text-left">Earnings</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-left">Deductions</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-700">
                        {row.earning?.label || row.earning?.name || "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-900">
                        {row.earning ? formatCurrency(row.earning.amount) : "-"}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {row.deduction?.label || row.deduction?.name || "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-900">
                        {row.deduction ? formatCurrency(row.deduction.amount) : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 bg-slate-50 font-bold text-slate-900">
                    <td className="px-4 py-2.5">Gross Earnings</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700">
                      {formatCurrency(gross)}
                    </td>
                    <td className="px-4 py-2.5">Total Deductions</td>
                    <td className="px-4 py-2.5 text-right text-rose-700">
                      {formatCurrency(deductionsTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Net Salary Payable</span>
              <span className="text-xl font-bold text-blue-700">{formatCurrency(net)}</span>
            </div>
          </section>

          <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
            Krystal Square, 4th floor 406, near Khanvilkar Pump, Sita Colony, Kolhapur, Maharashtra 416003
          </footer>
        </div>
      </div>
    </div>
  );
}

interface GenerateModalProps {
  onClose: () => void;
  onGenerated: () => void;
  employees: Employee[];
}

function GeneratePayslipModal({ onClose, onGenerated, employees }: GenerateModalProps) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState<string>(employees[0]?.employee_id || "");
  const [month, setMonth] = useState<string>("October");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError("Please select an employee");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await adminPayrollService.createPayslip({
        employee_id: employeeId,
        month,
        year: Number(year),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      onGenerated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to generate payslip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900">Generate Payslip</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-slate-700">Select Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none"
              required
            >
              {employees.map((emp) => (
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_id}) - {emp.designation}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2030}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkGenerateModalProps {
  onClose: () => void;
  onCompleted: () => void;
  totalEmployees: number;
}

function BulkGeneratePayslipModal({ onClose, onCompleted, totalEmployees }: BulkGenerateModalProps) {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>("October");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BulkGeneratePayslipsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminPayrollService.bulkGenerate({
        month,
        year: Number(year),
      });
      setResult(res);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.payrollAnalytics(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.dashboard(),
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "payslips"],
      });
      onCompleted();
    } catch (err: any) {
      setError(err?.message || "Failed to execute bulk payroll run");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Run Monthly Payroll</h3>
              <p className="text-xs text-slate-500">Auto-generate payslips for {totalEmployees} eligible active employees</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-3 rounded-lg bg-emerald-50 p-3.5 text-xs text-emerald-800">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Bulk Payroll Processing Complete</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-white/70 p-2">
                <div className="text-[10px] text-slate-500 uppercase">Eligible</div>
                <div className="font-bold text-slate-800">{result.total_eligible}</div>
              </div>
              <div className="rounded bg-white/70 p-2">
                <div className="text-[10px] text-emerald-600 uppercase">Created</div>
                <div className="font-bold text-emerald-700">{result.created}</div>
              </div>
              <div className="rounded bg-white/70 p-2">
                <div className="text-[10px] text-slate-500 uppercase">Skipped</div>
                <div className="font-bold text-slate-600">{result.skipped}</div>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <p className="mt-2 text-[11px] text-rose-600">
                {result.errors.length} employee(s) failed. Check salary structures.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleRun} className="mt-4 space-y-4 text-xs">
          <div className="rounded-lg bg-blue-50/60 p-3 text-slate-700">
            <p className="font-medium">
              This will automatically calculate gross salary, apply tax/statutory deductions, deduct Loss of Pay (LOP) from attendance records, and generate payslips for all active employees.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2030}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Processing..." : "Run Payroll for All"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkEmailPayslipModal({
  month,
  year,
  onClose,
}: {
  month: string;
  year: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await adminPayrollService.bulkSendEmail({
        month,
        year,
      });
      setStatusMsg(`Dispatched ${res.sent} payslip emails successfully (${res.failed} failed).`);
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch payslip emails");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Email Payslips</h3>
              <p className="text-xs text-slate-500">Dispatch payslips to employee emails for {month} {year}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMsg}</span>
          </div>
        )}

        <div className="mt-4 space-y-4 text-xs">
          <p className="text-slate-600">
            This will send an official payslip notification email with a salary summary and portal link to every employee who has a generated payslip for <strong>{month} {year}</strong>.
          </p>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {loading ? "Sending..." : "Send All Emails"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PayslipsTabProps {
  initialStatusFilter?: string;
}

export default function PayslipsTab({ initialStatusFilter = "" }: PayslipsTabProps) {
  const [monthValue, setMonthValue] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [selectedPayslip, setSelectedPayslip] = useState<AdminPayslipItem | null>(null);
  const [payslips, setPayslips] = useState<AdminPayslipItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState<boolean>(false);

  useEffect(() => {
    if (initialStatusFilter !== undefined) {
      setStatusFilter(initialStatusFilter);
      setPage(1);
    }
  }, [initialStatusFilter]);

  const fetchEmployees = async () => {
    try {
      const data = await employeeService.list({ status: "active", page: 1, limit: 100 });
      setEmployees(data || []);
    } catch {
      // Non-critical if fails, employee selection will use empty list
    }
  };

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit: 20,
      };
      if (monthValue) {
        params.month = monthValue;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await adminPayrollService.getPayslips(params);
      setPayslips(response.items || []);
      setTotalPages(response.total_pages || 1);
      setTotalCount(response.total || 0);
    } catch (err: any) {
      setError(err?.message || "Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, [page, monthValue, search, statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleMonthChange = (val: string) => {
    setMonthValue(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#1F2933]">Generated Payslips</h2>
          <p className="mt-1 text-sm text-[#7B8794]">
            Real records persisted in employee payroll database ({totalCount} total).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={fetchPayslips}
            disabled={loading}
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E6E1] bg-white px-3.5 text-xs font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowBulkEmailModal(true)}
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E6E1] bg-white px-3.5 text-xs font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] disabled:opacity-60 cursor-pointer"
            title="Email payslips to employees"
          >
            <Mail className="h-4 w-4 shrink-0" />
            Email Payslips
          </button>

          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E6E1] bg-white px-3.5 text-xs font-medium text-[#1F2933] transition hover:bg-[#F0F1EE] disabled:opacity-60 cursor-pointer"
            title="Batch generate monthly payroll for all employees"
          >
            <Users className="h-4 w-4 shrink-0" />
            Run Monthly Payroll
          </button>

          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="flex h-10 items-center gap-2 rounded-md bg-[#2F5FD0] px-4 text-sm font-medium text-white transition hover:bg-[#264FB0] cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Generate Single Payslip
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E4E6E1] bg-white p-[16px_20px] shadow-none">
        <div className="w-[180px]">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-medium text-[#7B8794]">Month Filter</label>
            {monthValue && (
              <button
                type="button"
                onClick={() => handleMonthChange("")}
                className="text-xs font-medium text-[#2F5FD0] hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white px-3 text-xs text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0]"
          />
        </div>

        <div className="flex-1 max-w-[360px] min-w-[200px]">
          <label className="mb-1.5 block text-xs font-medium text-[#7B8794]">Search Employee</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name or employee code..."
              className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white pl-9 pr-3 text-xs text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0]"
            />
          </div>
        </div>

        <div className="w-[160px]">
          <label className="mb-1.5 block text-xs font-medium text-[#7B8794]">Payment Status</label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white px-3 text-xs text-[#1F2933] outline-none transition hover:border-[#CBD2D9] focus:border-[#2F5FD0] cursor-pointer"
          >
            <option value="">All</option>
            <option value="Paid">Paid / Credited</option>
            <option value="Processing">Processing</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-[#E4E6E1] bg-white shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="h-11 border-b border-[#E4E6E1] bg-[#FAFAF8] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                <th className="px-5 py-3 font-medium text-left">Employee</th>
                <th className="px-5 py-3 font-medium text-left">Period</th>
                <th className="px-5 py-3 font-medium text-right">Gross</th>
                <th className="px-5 py-3 font-medium text-right">Deductions</th>
                <th className="px-5 py-3 font-medium text-right">Net Salary</th>
                <th className="px-5 py-3 font-medium text-left">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && payslips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs text-[#7B8794]">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#2F5FD0] mb-2" />
                    Loading persisted payslips...
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-[#7B8794]">
                    No payslip records found matching your filters.
                  </td>
                </tr>
              ) : (
                payslips.map((p) => {
                  const gross = p.salary?.gross || 0;
                  const ded = p.deductions?.total || 0;
                  const net = p.net_salary || 0;
                  const status = p.payment?.status || p.status || "Processing";
                  return (
                    <tr key={p.id} className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors">
                      <td className="px-5 py-3.5 text-left">
                        <div className="font-semibold text-[#1F2933]">
                          {p.employee_name || p.employee_id}
                        </div>
                        <div className="text-xs text-[#7B8794]">
                          {p.employee_code || p.employee_id} • {p.department || "General"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-left text-xs text-[#52606D]">
                        {p.month}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[#1F2933]">
                        {formatCurrency(gross)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium tabular-nums text-[#52606D]">
                        {formatCurrency(ded)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#1F2933]">
                        {formatCurrency(net)}
                      </td>
                      <td className="px-5 py-3.5 text-left">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            statusBadgeStyles[status] || "bg-[#FDF3D6] text-[#8A5A00] border border-[#F6DE95]"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedPayslip(p)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] bg-white text-[#7B8794] hover:bg-[#F0F1EE] hover:text-[#1F2933] transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="h-[18px] w-[18px] shrink-0" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#E4E6E1] px-5 py-3 text-xs text-[#7B8794]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 items-center gap-1 rounded-md border border-[#E4E6E1] bg-white px-3 text-xs font-medium text-[#52606D] hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 items-center gap-1 rounded-md border border-[#E4E6E1] bg-white px-3 text-xs font-medium text-[#52606D] hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedPayslip && (
        <PayslipDetailModal
          payslip={selectedPayslip}
          onClose={() => setSelectedPayslip(null)}
          onStatusUpdated={fetchPayslips}
        />
      )}

      {showGenerateModal && (
        <GeneratePayslipModal
          employees={employees}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={fetchPayslips}
        />
      )}

      {showBulkModal && (
        <BulkGeneratePayslipModal
          totalEmployees={employees.length}
          onClose={() => setShowBulkModal(false)}
          onCompleted={fetchPayslips}
        />
      )}

      {showBulkEmailModal && (
        <BulkEmailPayslipModal
          month={monthValue ? new Date(`${monthValue}-01`).toLocaleString("en-US", { month: "long" }) : "October"}
          year={monthValue ? Number(monthValue.slice(0, 4)) : new Date().getFullYear()}
          onClose={() => setShowBulkEmailModal(false)}
        />
      )}
    </div>
  );
}
