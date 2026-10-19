import { useEffect, useState } from "react";
import { Eye, Search } from "lucide-react";
import { employeeService } from "../../services/employeeService";
import { salaryStructureService, type SalaryStructure } from "../../services/admin_salary_structure_service";
import type { Employee } from "../../types/employee";


type PayslipStatus = "Paid" | "Pending" | "Processing";

interface PayslipEarnings {
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  attendanceBonus: number;
  overtime: number;
  otherAllowances: number;
}

interface PayslipDeductions {
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  leaveDeduction: number;
  otherDeductions: number;
}

interface Payslip {
  id: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  bankName: string;
  accountNo: string;
  month: string;
  monthValue: string; // "YYYY-MM", used for filtering against the date picker
  earnings: PayslipEarnings;
  deductions: PayslipDeductions;
  status: PayslipStatus;
}

const statusStyles: Record<PayslipStatus, string> = {
  Paid: "bg-emerald-50 text-emerald-600",
  Pending: "bg-orange-50 text-orange-500",
  Processing: "bg-blue-50 text-blue-600",
};

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function totalEarnings(earnings: PayslipEarnings): number {
  return (
    earnings.basicSalary +
    earnings.hra +
    earnings.specialAllowance +
    earnings.attendanceBonus +
    earnings.overtime +
    earnings.otherAllowances
  );
}

function totalDeductions(deductions: PayslipDeductions): number {
  return (
    deductions.pf +
    deductions.esi +
    deductions.pt +
    deductions.tds +
    deductions.leaveDeduction +
    deductions.otherDeductions
  );
}

function currentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

function structureMatchesEmployee(structure: SalaryStructure, employee: Employee): boolean {
  const selected = employee.salary_structure?.trim().toLowerCase();
  return Boolean(selected && structure.name.toLowerCase().includes(selected));
}

function earningAmount(structure: SalaryStructure | undefined, labels: string[], fallback: number): number {
  const earning = structure?.earnings.find((item) => labels.some((value) => item.label.toLowerCase().includes(value)));
  return earning?.amount ?? fallback;
}

function buildPayslip(employee: Employee, structures: SalaryStructure[]): Payslip {
  const structure = structures.find((item) => structureMatchesEmployee(item, employee));
  const monthValue = currentMonthValue();
  return {
    id: employee.id,
    employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
    employeeCode: employee.employee_id,
    department: employee.department_id,
    designation: employee.designation,
    bankName: employee.bank_information?.bank_name ?? "-",
    accountNo: employee.bank_information?.account_number ?? "-",
    month: new Date(`${monthValue}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    monthValue,
    earnings: {
      basicSalary: earningAmount(structure, ["basic"], Number(employee.salary) || 0),
      hra: earningAmount(structure, ["hra", "house rent"], 0),
      specialAllowance: earningAmount(structure, ["special allowance"], 0),
      attendanceBonus: earningAmount(structure, ["attendance"], 0),
      overtime: earningAmount(structure, ["overtime"], 0),
      otherAllowances: earningAmount(structure, ["other", "conveyance"], 0),
    },
    deductions: { pf: 0, esi: 0, pt: 0, tds: 0, leaveDeduction: 0, otherDeductions: 0 },
    status: "Pending",
  };
}

function PayslipDetailModal({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  const gross = totalEarnings(payslip.earnings);
  const deductionTotal = totalDeductions(payslip.deductions);
  const net = gross - deductionTotal;
  return (
    <div className="payslip-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex justify-end p-3"><button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">x</button></div>
        <div className="payslip-paper relative mx-auto px-5 pb-7 sm:px-10"><img src="/aarmarks-logo.png.png" alt="" className="payslip-watermark" /><header className="payslip-header relative flex items-center justify-between gap-5 border-b-2 border-slate-700 pb-4"><div className="flex items-center gap-2"><img src="/aarmarks-logo.png.png" alt="AarMarks Media logo" className="h-16 w-16 object-contain" /><div className="font-sans text-[21px] font-bold leading-tight text-[#079bb0] sm:text-[25px]"><div>AarMarks Media</div><div className="text-center">Pvt. Ltd</div></div></div><div className="px-3 py-2 text-[12px] leading-5 sm:text-[14px]"><div>Website - <a href="https://www.aarmarksmedia.com/" className="text-blue-700 underline">https://www.aarmarksmedia.com/</a></div><div>Email&nbsp;&nbsp;&nbsp;- hr@aarmarksmedia.com</div></div></header>
          <h1 className="payslip-title">Employee Payslip</h1><h2 className="payslip-section-title">Employee Details</h2><table className="payslip-table payslip-details-table"><tbody><tr><td><b>Employee Name</b> : {payslip.employeeName}</td><td><b>Designation</b> : {payslip.designation}</td></tr><tr><td><b>Employee ID</b> : {payslip.employeeCode || "-"}</td><td><b>Bank Name</b> : {payslip.bankName}</td></tr><tr><td><b>Paid Month</b> : {payslip.month.split(" ")[0]}</td><td><b>Account No</b> : {payslip.accountNo || "-"}</td></tr></tbody></table><h2 className="payslip-section-title">Earnings and Deductions</h2><table className="payslip-table payslip-earnings-table"><thead><tr><th>Description</th><th>Amount</th><th>Description</th><th>Amount</th></tr></thead><tbody>{[["Basic Salary", payslip.earnings.basicSalary, "Provident Fund (PF)", payslip.deductions.pf], ["House Rent Allowances", payslip.earnings.hra, "Employee State Insurance (ESI)", payslip.deductions.esi], ["Special Allowance", payslip.earnings.specialAllowance, "Professional Tax (PT)", payslip.deductions.pt], ["Attendance Bonus", payslip.earnings.attendanceBonus, "Income Tax (TDS)", payslip.deductions.tds], ["Overtime", payslip.earnings.overtime, "Leave Deduction", payslip.deductions.leaveDeduction], ["Other Allowances", payslip.earnings.otherAllowances, "Other Deductions", payslip.deductions.otherDeductions]].map(([a, b, c, d]) => <tr key={String(a)}><td>{a}</td><td>{formatCurrency(Number(b))}</td><td>{c}</td><td>{formatCurrency(Number(d))}</td></tr>)}<tr className="font-bold"><td>Gross Earnings</td><td>{formatCurrency(gross)}</td><td>Total Deductions</td><td>{formatCurrency(deductionTotal)}</td></tr></tbody></table><h2 className="payslip-section-title">Net Salary</h2><table className="payslip-table payslip-net-table"><tbody><tr><td>Gross Earnings</td><td>{formatCurrency(gross)}</td></tr><tr><td>Total Deductions</td><td>{formatCurrency(deductionTotal)}</td></tr><tr className="font-bold"><td>Net Salary Payable</td><td>{formatCurrency(net)}</td></tr></tbody></table><div className="payslip-footer mt-6 border-t border-slate-300 pt-4 text-center text-[11px]"><p>Krytal square, 4th floor 406, near Khanvilkar Pump, Sita Colony, Kolhapur, Maharashtra 416003</p><p>Contact Number: +91 7387580316, +91 7559203807</p></div></div>
      </div>
    </div>
  );
}

function PayslipsTab() {
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayslipStatus | "">("");
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      employeeService.list({ status: "active", page: 1, limit: 100 }),
      salaryStructureService.list(),
    ])
      .then(([employees, structures]) => {
        if (mounted) {
          setPayslips(employees.map((employee) => buildPayslip(employee, structures)));
        }
      })
      .catch((requestError: Error) => {
        if (mounted) setError(requestError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = payslips.filter((payslip) => {
    const matchesMonth = payslip.monthValue === monthValue;
    const matchesSearch =
      !search ||
      payslip.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      payslip.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || payslip.status === statusFilter;
    return matchesMonth && matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-sm font-bold text-slate-900">Payslips</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Month</label>
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Search Employee</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or ID..."
                className="rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PayslipStatus | "")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
      {loading && <p className="mb-4 text-sm text-slate-500">Loading employees and salary structures...</p>}

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Employee</th>
                <th className="px-5 py-3 font-semibold">Gross</th>
                <th className="px-5 py-3 font-semibold">Deductions</th>
                <th className="px-5 py-3 font-semibold">Net Salary</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    No payslips found for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((payslip) => {
                  const gross = totalEarnings(payslip.earnings);
                  const deductionTotal = totalDeductions(payslip.deductions);
                  const net = gross - deductionTotal;
                  return (
                    <tr key={payslip.id}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{payslip.employeeName}</div>
                        <div className="text-xs text-slate-400">{payslip.employeeCode}</div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{formatCurrency(gross)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatCurrency(deductionTotal)}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{formatCurrency(net)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[payslip.status]}`}>
                          {payslip.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslip(payslip)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayslip && (
        <PayslipDetailModal payslip={selectedPayslip} onClose={() => setSelectedPayslip(null)} />
      )}
    </div>
  );
}

export default PayslipsTab;
