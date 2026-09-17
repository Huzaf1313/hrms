import { useState } from "react";
import { Eye, Download, X, Search } from "lucide-react";


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

// Company details shown on the payslip header/footer.
// TODO: pull this from company settings once configurable.

const companyInfo = {
  name: "AarMarks Media Pvt. Ltd.",
  website: "https://www.aarmarksmedia.com/",
  email: "hr@aarmarksmedia.com",
  address: "Krytal square, 4th floor 406, near Khanvilkar Pump, Sita Colony, Kolhapur, Maharashtra 416003",
  contact: "+91 7387580316, +91 7559203807",
};

// TODO: replace with data from an API once payroll runs generate real payslips
const mockPayslips: Payslip[] = [
  {
    id: "1",
    employeeName: "Shruti Ugale",
    employeeCode: "EMP007",
    department: "Engineering",
    designation: "Software Developer",
    bankName: "Yes Bank",
    accountNo: "1234567890",
    month: "May 2026",
    monthValue: "2026-05",
    earnings: { basicSalary: 8000, hra: 3000, specialAllowance: 3000, attendanceBonus: 0, overtime: 0, otherAllowances: 0 },
    deductions: { pf: 960, esi: 118, pt: 200, tds: 1390, leaveDeduction: 0, otherDeductions: 0 },
    status: "Paid",
  },
  {
    id: "2",
    employeeName: "Rahul Sharma",
    employeeCode: "EMP012",
    department: "Sales",
    designation: "Sales Executive",
    bankName: "HDFC Bank",
    accountNo: "9876543210",
    month: "May 2026",
    monthValue: "2026-05",
    earnings: { basicSalary: 18000, hra: 7000, specialAllowance: 5000, attendanceBonus: 5000, overtime: 0, otherAllowances: 0 },
    deductions: { pf: 2160, esi: 0, pt: 200, tds: 3640, leaveDeduction: 0, otherDeductions: 0 },
    status: "Paid",
  },
  {
    id: "3",
    employeeName: "Amit Verma",
    employeeCode: "EMP018",
    department: "Marketing",
    designation: "Marketing Associate",
    bankName: "ICICI Bank",
    accountNo: "5647382910",
    month: "May 2026",
    monthValue: "2026-05",
    earnings: { basicSalary: 6000, hra: 1500, specialAllowance: 1000, attendanceBonus: 0, overtime: 500, otherAllowances: 0 },
    deductions: { pf: 720, esi: 66, pt: 0, tds: 2780, leaveDeduction: 0, otherDeductions: 0 },
    status: "Pending",
  },
];

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

function paidMonthLabel(month: string): string {
  return month.split(" ")[0];
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex border border-slate-800 px-3 py-2 text-sm">
      <span className="font-semibold text-slate-900">{label}</span>
      <span className="ml-1 text-slate-800">: {value}</span>
    </div>
  );
}

function AmountRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-slate-800 px-3 py-2 last:border-b-0 ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function PayslipDetailModal({ payslip, onClose }: { payslip: Payslip; onClose: () => void }) {
  const gross = totalEarnings(payslip.earnings);
  const deductionTotal = totalDeductions(payslip.deductions);
  const net = gross - deductionTotal;

  function handleDownloadPdf() {
    // TODO: wire up real PDF generation (e.g. a backend endpoint or a client-side
    // library) once payslips are backed by the database.
    alert("PDF download will be available once the payslip backend is connected.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        {/* Close button */}
        <div className="flex justify-end p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-8 pb-8">
          {/* Company header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 pb-4">
            <h3 className="text-xl font-bold text-slate-900">{companyInfo.name}</h3>
            <div className="text-right text-xs text-slate-600">
              <p>
                Website -{" "}
                <a href={companyInfo.website} className="text-blue-600 underline">
                  {companyInfo.website}
                </a>
              </p>
              <p>Email - {companyInfo.email}</p>
            </div>
          </div>

          <h1 className="mb-5 text-center text-xl font-bold underline">Employee Payslip</h1>

          {/* Employee Details */}
          <h2 className="mb-2 text-center text-base font-bold">Employee Details</h2>
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2">
            <DetailCell label="Employee Name" value={payslip.employeeName} />
            <DetailCell label="Designation" value={payslip.designation} />
            <DetailCell label="Employee ID" value={payslip.employeeCode} />
            <DetailCell label="Bank Name" value={payslip.bankName} />
            <DetailCell label="Paid Month" value={paidMonthLabel(payslip.month)} />
            <DetailCell label="Account No" value={payslip.accountNo} />
          </div>

          {/* Earnings and Deductions */}
          <h2 className="mb-2 text-center text-base font-bold">Earnings and Deductions</h2>
          <div className="mb-6 grid grid-cols-1 border border-slate-800 sm:grid-cols-2">
            <div className="border-b border-slate-800 sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-50 px-3 py-2 text-sm font-bold">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <AmountRow label="Basic Salary" value={payslip.earnings.basicSalary} />
              <AmountRow label="House Rent Allowances" value={payslip.earnings.hra} />
              <AmountRow label="Special Allowance" value={payslip.earnings.specialAllowance} />
              <AmountRow label="Attendance Bonus" value={payslip.earnings.attendanceBonus} />
              <AmountRow label="Overtime" value={payslip.earnings.overtime} />
              <AmountRow label="Other Allowances" value={payslip.earnings.otherAllowances} />
              <AmountRow label="Gross Earnings" value={gross} bold />
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-50 px-3 py-2 text-sm font-bold">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <AmountRow label="Provident Fund (PF)" value={payslip.deductions.pf} />
              <AmountRow label="Employee State Insurance (ESI)" value={payslip.deductions.esi} />
              <AmountRow label="Professional Tax (PT)" value={payslip.deductions.pt} />
              <AmountRow label="Income Tax (TDS)" value={payslip.deductions.tds} />
              <AmountRow label="Leave Deduction" value={payslip.deductions.leaveDeduction} />
              <AmountRow label="Other Deductions" value={payslip.deductions.otherDeductions} />
              <AmountRow label="Total Deductions" value={deductionTotal} bold />
            </div>
          </div>

          {/* Net Salary */}
          <h2 className="mb-2 text-center text-base font-bold">Net Salary</h2>
          <div className="mb-6 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-50 px-3 py-2 text-sm font-bold">
              <span>Particular</span>
              <span>Amount</span>
            </div>
            <AmountRow label="Gross Earnings" value={gross} />
            <AmountRow label="Total Deductions" value={deductionTotal} />
            <AmountRow label="Net Salary Payable" value={net} bold />
          </div>

          {/* Download */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download Payslip PDF
            </button>
          </div>

          {/* Company footer */}
          <div className="mt-6 border-t border-slate-300 pt-4 text-center text-[11px] text-slate-500">
            <p>{companyInfo.address}</p>
            <p>Contact Number: {companyInfo.contact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PayslipsTab() {
  const [monthValue, setMonthValue] = useState("2026-05");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayslipStatus | "">("");
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const filtered = mockPayslips.filter((payslip) => {
    const matchesMonth = payslip.monthValue === monthValue;
    const matchesSearch =
      !search ||
      payslip.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      payslip.employeeCode.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || payslip.status === statusFilter;
    return matchesMonth && matchesSearch && matchesStatus;
  });

  function handleDownload(payslip: Payslip) {
    // TODO: wire up real PDF generation once payslips are backed by the database.
    alert(`Download will be available once the payslip backend is connected (${payslip.employeeName}).`);
  }

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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPayslip(payslip)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="View"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(payslip)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
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
