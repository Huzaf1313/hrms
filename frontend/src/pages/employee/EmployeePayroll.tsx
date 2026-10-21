import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { api } from "../../services/api";
import { useGlobalDate } from "../../context/globalDateContext";
import { GlobalDateBadge } from "../../components/GlobalDateBadge";

type PayrollTab =
  | "Payslips"
  | "Salary Details"
  | "Deductions & Contributions"
  | "Tax Details";

interface Payslip {
  id: string;
  month: string;
  paidOn: string;
  amount: number;
  status: "Credited" | "Processing";
}

interface SalaryComponent {
  label: string;
  amount: number;
  percentage: number;
}

interface Deduction {
  label: string;
  amount: number;
  shortLabel: string;
}

const tabs: PayrollTab[] = [
  "Payslips",
  "Salary Details",
  "Deductions & Contributions",
  "Tax Details",
];

const ITEMS_PER_PAGE = 5;

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function EmployeePayroll() {
  const [activeTab, setActiveTab] = useState<PayrollTab>("Payslips");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [, setError] = useState("");
  const [latestPayroll, setLatestPayroll] = useState<any | null>(null);
  const [selectedPayrollId, setSelectedPayrollId] = useState("");

  useEffect(() => {
  async function fetchPayroll() {
    try {
      setLoading(true);
      setError("");

      const user = JSON.parse(
        localStorage.getItem("user") || "{}"
      );

      const employeeId = user.employee_id;

      if (!employeeId) {
        throw new Error("Employee information not found.");
      }

      const response = await api.get<{
        items: any[];
        total: number;
        page: number;
        limit: number;
        pages: number;
      }>(`/employee-payroll/employees/${employeeId}`, {
        page: 1,
        limit: 100,
      });

      setPayrollData(response.items || []);

      const latestResponse = await api.get<any>(
        `/employee-payroll/employees/${employeeId}/latest`
      );

      setLatestPayroll(latestResponse);
    } catch (err) {
      console.error("Failed to fetch payroll:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll information."
      );
    } finally {
      setLoading(false);
    }
  }

  fetchPayroll();
}, []);

// Payroll runs a whole month at a time, so the header calendar's day is
// resolved to its month here. Filtered in the browser rather than by the
// backend, because the list endpoint only offers paging.
const { date: globalDate, isDefault: isGlobalDateDefault } = useGlobalDate();

const globalMonthKey = globalDate.slice(0, 7);

const visiblePayrollData = isGlobalDateDefault
  ? payrollData
  : payrollData.filter((record) => {
      // pay_period_start arrives as an ISO date, so its year-month prefix lines
      // up with the header date's without any parsing.
      const periodStart = record?.pay_period_start;

      if (typeof periodStart !== "string" || periodStart.length < 7) {
        return false;
      }

      return periodStart.slice(0, 7) === globalMonthKey;
    });

const payslips: Payslip[] = visiblePayrollData.map((record) => ({
  id: record.id,
  month: record.month,
  paidOn: record.payment?.paid_on
    ? new Date(record.payment.paid_on).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not paid",
  amount: Number(record.net_salary ?? 0),
  status:
    record.payment?.status === "Processing"
      ? "Processing"
      : "Credited",
}));

useEffect(() => {
  if (payslips.length > 0 && !selectedPayrollId) {
    setSelectedPayrollId(payslips[0].id);
  }
}, [payslips, selectedPayrollId]);


const salaryComponents: SalaryComponent[] = latestPayroll
  ? [
      {
        label: "Basic Salary",
        amount: Number(latestPayroll.salary?.basic ?? 0),
        percentage:
          latestPayroll.salary?.gross > 0
            ? Math.round(
                (Number(latestPayroll.salary?.basic ?? 0) /
                  Number(latestPayroll.salary.gross)) *
                  100
              )
            : 0,
      },
      {
        label: "HRA",
        amount: Number(latestPayroll.salary?.hra ?? 0),
        percentage:
          latestPayroll.salary?.gross > 0
            ? Math.round(
                (Number(latestPayroll.salary?.hra ?? 0) /
                  Number(latestPayroll.salary.gross)) *
                  100
              )
            : 0,
      },
      {
        label: "Special Allowance",
        amount: Number(latestPayroll.salary?.special_allowance ?? 0),
        percentage:
          latestPayroll.salary?.gross > 0
            ? Math.round(
                (Number(latestPayroll.salary?.special_allowance ?? 0) /
                  Number(latestPayroll.salary.gross)) *
                  100
              )
            : 0,
      },
      {
        label: "Conveyance",
        amount: Number(latestPayroll.salary?.conveyance ?? 0),
        percentage:
          latestPayroll.salary?.gross > 0
            ? Math.round(
                (Number(latestPayroll.salary?.conveyance ?? 0) /
                  Number(latestPayroll.salary.gross)) *
                  100
              )
            : 0,
      },
      {
        label: "Other Allowance",
        amount: Number(latestPayroll.salary?.other_allowance ?? 0),
        percentage:
          latestPayroll.salary?.gross > 0
            ? Math.round(
                (Number(latestPayroll.salary?.other_allowance ?? 0) /
                  Number(latestPayroll.salary.gross)) *
                  100
              )
            : 0,
      },
    ]
  : [];

  const deductions: Deduction[] = latestPayroll
  ? [
      {
        label: "Provident Fund",
        shortLabel: "PF",
        amount: Number(latestPayroll.deductions?.pf ?? 0),
      },
      {
        label: "Professional Tax",
        shortLabel: "PT",
        amount: Number(latestPayroll.deductions?.pt ?? 0),
      },
      {
        label: "Income Tax (TDS)",
        shortLabel: "TDS",
        amount: Number(latestPayroll.deductions?.tds ?? 0),
      },
    ]
  : [];

  const taxableIncome = latestPayroll
  ? Number(latestPayroll.tax_details?.taxable_income ?? 0)
  : 0;

  const taxDeducted = latestPayroll
  ? Number(latestPayroll.tax_details?.tax_deducted ?? 0)
  : 0;

  const totalPages = Math.ceil(payslips.length / ITEMS_PER_PAGE);

  const currentPayslips = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    return payslips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage]);

  const pageStart =
    payslips.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const pageEnd = Math.min(
    currentPage * ITEMS_PER_PAGE,
    payslips.length,
  );

  const totalDeductions = latestPayroll
  ? Number(latestPayroll.deductions?.total ?? 0)
  : 0;

  const grossSalary = latestPayroll
  ? Number(latestPayroll.salary?.gross ?? 0)
  : 0;

  const netSalary = grossSalary - totalDeductions;

  function handleTabChange(tab: PayrollTab) {
    setActiveTab(tab);
  }

  function handlePreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1));
  }

  function handleNextPage() {
    setCurrentPage((page) => Math.min(Math.max(totalPages, 1), page + 1));
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-slate-500">
                <Wallet className="h-4 w-4" />
                <span>Payroll</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                My Payslip
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                View your salary, payslips, deductions and tax information.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <CalendarDays className="h-4 w-4 text-slate-400" />

              <label
                htmlFor="payroll-month"
                className="text-xs font-medium text-slate-500"
              >
                Month & Year
              </label>

              <select
                id="payroll-month"
                value={selectedPayrollId}
                onChange={(event) => setSelectedPayrollId(event.target.value)}
                disabled={payslips.length === 0}
                className="cursor-pointer bg-transparent text-sm font-semibold text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {payslips.length === 0 ? (
                  <option value="">No payroll available</option>
                ) : (
                  payslips.map((payslip) => (
                    <option key={payslip.id} value={payslip.id}>
                      {payslip.month}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Net Salary */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Net Salary
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {latestPayroll
                        ? formatCurrency(Number(latestPayroll.net_salary ?? 0))
                        : "—"}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <Banknote className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CircleCheck className="h-3.5 w-3.5" />
                    {latestPayroll?.payment?.status ?? "—"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs text-slate-400">Basic</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {latestPayroll
                      ? formatCurrency(Number(latestPayroll.salary?.basic ?? 0))
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Deductions</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {latestPayroll
                      ? formatCurrency(Number(latestPayroll.deductions?.total ?? 0))
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Pay Period */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Pay Period
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {latestPayroll?.month ?? "—"}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {latestPayroll
                    ? `${new Date(latestPayroll.pay_period_start).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )} – ${new Date(latestPayroll.pay_period_end).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}`
                    : "—"}
                </p>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-full rounded-full bg-blue-600" />
                </div>
              </div>
            </div>

            {/* Bank Account */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Bank Account
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900">
                      {latestPayroll?.bank_details?.bank_name ?? "—"}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                    <Landmark className="h-5 w-5 text-violet-600" />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">
                    {latestPayroll?.bank_details?.account_last4
                      ? `•••• ${latestPayroll.bank_details.account_last4}`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  className="text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                  onClick={() =>
                    window.alert("Bank account details will be connected to the backend later.")
                  }
                >
                  View Details
                </button>
              </div>
            </div>
          </section>

          {/* Main Payroll Area */}
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* Main Content */}
            <section className="min-w-0 rounded-2xl border border-gray-100 bg-white shadow-sm">
              {/* Tabs */}
              <div className="overflow-x-auto border-b border-slate-200">
                <div className="flex min-w-max px-2 sm:px-4">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab;

                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => handleTabChange(tab)}
                        className={`relative whitespace-nowrap px-3 py-4 text-sm font-semibold transition sm:px-4 ${
                          isActive
                            ? "text-blue-600"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab}

                        {isActive && (
                          <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600 sm:inset-x-4" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-5 sm:p-6">
                {activeTab === "Payslips" && (
                  <>
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Payslip History
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Your previous salary payments and payslips.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <GlobalDateBadge prefix="Period" />

                        <span className="text-sm text-slate-500">
                          {payslips.length} payslips
                        </span>
                      </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[650px]">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Month
                              </th>
                              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Paid On
                              </th>
                              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Amount
                              </th>
                              <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Status
                              </th>
                              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Action
                              </th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {currentPayslips.map((payslip) => (
                              <tr
                                key={`${payslip.month}-${payslip.paidOn}`}
                                className="transition hover:bg-slate-50/70"
                              >
                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                                      <FileText className="h-4 w-4 text-blue-600" />
                                    </div>

                                    <span className="text-sm font-semibold text-slate-800">
                                      {payslip.month}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-500">
                                  {payslip.paidOn}
                                </td>

                                <td className="px-5 py-4 text-right text-sm font-bold text-slate-800">
                                  {formatCurrency(payslip.amount)}
                                </td>

                                <td className="px-5 py-4 text-center">
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {payslip.status}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPayslip(payslip)}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="space-y-3 md:hidden">
                      {currentPayslips.map((payslip) => (
                        <div
                          key={`${payslip.month}-${payslip.paidOn}`}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                                <FileText className="h-4 w-4 text-blue-600" />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {payslip.month}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Paid on {payslip.paidOn}
                                </p>
                              </div>
                            </div>

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {payslip.status}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                            <span className="text-sm font-bold text-slate-800">
                              {formatCurrency(payslip.amount)}
                            </span>

                            <button
                              type="button"
                              onClick={() => setSelectedPayslip(payslip)}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">
                        Showing{" "}
                        <span className="font-semibold text-slate-700">
                          {pageStart}–{pageEnd}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold text-slate-700">
                          {payslips.length}
                        </span>
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePreviousPage}
                          disabled={currentPage === 1}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">
                          {currentPage}
                        </span>

                        <button
                          type="button"
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Next page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "Salary Details" && (
                  <SalaryDetails
                    salaryComponents={salaryComponents}
                    grossSalary={grossSalary}
                    netSalary={netSalary}
                    payrollMonth={latestPayroll?.month}
                  />
                )}

                {activeTab === "Deductions & Contributions" && (
                  <DeductionsDetails
                    deductions={deductions}
                    totalDeductions={totalDeductions}
                    payrollMonth={latestPayroll?.month}
                  />
                )}

                {activeTab === "Tax Details" && <TaxDetails
                                                  latestPayroll={latestPayroll}
                                                  taxableIncome={taxableIncome}
                                                  taxDeducted={taxDeducted}
                                                />
                }
              </div>
            </section>

            {/* Right Sidebar */}
            <aside className="space-y-6">
              {/* Salary Breakdown */}
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-slate-900">
                    Salary Breakdown
                  </h2>
                   <p className="mt-1 text-sm text-slate-500">
                    {latestPayroll?.month ?? "—"}
                  </p>
                </div>

                {/* Donut */}
                <div className="flex justify-center">
                  <div
                    className="relative h-52 w-52 rounded-full"
                    style={{
                      background: latestPayroll
                      ? `conic-gradient(
                          #2563eb 0deg ${
                            (salaryComponents[0].percentage / 100) * 360
                          }deg,
                          #60a5fa ${
                            (salaryComponents[0].percentage / 100) * 360
                          }deg ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage) /
                              100) *
                            360
                          }deg,
                          #818cf8 ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage) /
                              100) *
                            360
                          }deg ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage +
                              salaryComponents[2].percentage) /
                              100) *
                            360
                          }deg,
                          #a78bfa ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage +
                              salaryComponents[2].percentage) /
                              100) *
                            360
                          }deg ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage +
                              salaryComponents[2].percentage +
                              salaryComponents[3].percentage) /
                              100) *
                            360
                          }deg,
                          #c4b5fd ${
                            ((salaryComponents[0].percentage +
                              salaryComponents[1].percentage +
                              salaryComponents[2].percentage +
                              salaryComponents[3].percentage) /
                              100) *
                            360
                          }deg 360deg
                        )`
                      : "conic-gradient(#e2e8f0 0deg 360deg)",
                    }}
                  >
                    <div className="absolute inset-[24px] flex flex-col items-center justify-center rounded-full bg-white">
                      <span className="text-xs font-medium text-slate-500">
                        Gross Salary
                      </span>
                      <span className="mt-1 text-xl font-bold text-slate-900">
                        {formatCurrency(grossSalary)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Salary Legend */}
                <div className="mt-6 space-y-3">
                  {salaryComponents.map((component, index) => (
                    <div
                      key={component.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                            [
                              "bg-blue-600",
                              "bg-blue-400",
                              "bg-indigo-400",
                              "bg-violet-400",
                              "bg-violet-300",
                            ][index]
                          }`}
                        />

                        <span className="truncate text-sm text-slate-600">
                          {component.label}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {formatCurrency(component.amount)}
                        </span>

                        <span className="w-7 text-right text-xs text-slate-400">
                          {component.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Deductions */}
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Recent Deductions
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {latestPayroll?.month ?? "—"}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
                    <ShieldCheck className="h-4 w-4 text-red-500" />
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {deductions.map((deduction) => (
                    <div
                      key={deduction.shortLabel}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                          <span className="text-[10px] font-bold text-slate-500">
                            {deduction.shortLabel}
                          </span>
                        </div>

                        <span className="text-sm text-slate-600">
                          {deduction.label}
                        </span>
                      </div>

                      <span className="text-sm font-semibold text-slate-800">
                        {formatCurrency(deduction.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-semibold text-slate-600">
                    Total Deductions
                  </span>

                  <span className="text-base font-bold text-red-600">
                    {formatCurrency(totalDeductions)}
                  </span>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      {/* Payslip View Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPayslip(null); }}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">Payslip Details</h2><p className="mt-0.5 text-sm text-slate-500">{selectedPayslip.month}</p></div><button type="button" onClick={() => setSelectedPayslip(null)} className="h-9 w-9 rounded-lg text-slate-400" aria-label="Close">x</button></div>
            <div className="space-y-5 p-5"><div className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Net Salary</span><span className="text-xl font-bold text-slate-900">{formatCurrency(selectedPayslip.amount)}</span></div><div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-sm text-slate-500">Paid On</span><span className="text-sm font-semibold text-slate-700">{selectedPayslip.paidOn}</span></div><div className="mt-3 flex items-center justify-between"><span className="text-sm text-slate-500">Status</span><span className="text-sm font-semibold text-emerald-700">{selectedPayslip.status}</span></div></div><div><h3 className="text-sm font-bold text-slate-800">Salary Summary</h3><div className="mt-3 space-y-3"><div className="flex justify-between text-sm"><span className="text-slate-500">Gross Salary</span><span className="font-semibold text-slate-800">{formatCurrency(grossSalary)}</span></div><div className="flex justify-between text-sm"><span className="text-slate-500">Total Deductions</span><span className="font-semibold text-slate-800">{formatCurrency(totalDeductions)}</span></div><div className="flex justify-between border-t border-slate-100 pt-3 text-sm"><span className="font-semibold text-slate-700">Net Salary</span><span className="font-bold text-blue-600">{formatCurrency(netSalary)}</span></div></div></div><button type="button" onClick={() => setSelectedPayslip(null)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200">Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}

interface SalaryDetailsProps {
  salaryComponents: SalaryComponent[];
  grossSalary: number;
  netSalary: number;
  payrollMonth?: string;
}

function SalaryDetails({
  salaryComponents,
  grossSalary,
  netSalary,
  payrollMonth,
}: SalaryDetailsProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          Salary Details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {payrollMonth
            ? `Your current salary structure for ${payrollMonth}.`
            : "Your current salary structure."}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="divide-y divide-slate-100">
          {salaryComponents.map((component) => (
            <div
              key={component.label}
              className="flex items-center justify-between gap-4 px-4 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {component.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {component.percentage}% of gross salary
                </p>
              </div>

              <span className="text-sm font-bold text-slate-800">
                {formatCurrency(component.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Gross Salary
            </span>
            <span className="text-base font-bold text-slate-900">
              {formatCurrency(grossSalary)}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              Estimated Net Salary
            </span>
            <span className="text-base font-bold text-blue-600">
              {formatCurrency(netSalary)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DeductionsDetailsProps {
  deductions: Deduction[];
  totalDeductions: number;
  payrollMonth?: string;
}

function DeductionsDetails({
  deductions,
  totalDeductions,
  payrollMonth,
}: DeductionsDetailsProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          Deductions & Contributions
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {payrollMonth
            ? `Deductions applied to your ${payrollMonth} salary.`
            : "Deductions applied to your salary."}
        </p>
      </div>

      <div className="space-y-3">
        {deductions.map((deduction) => (
          <div
            key={deduction.shortLabel}
            className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <span className="text-xs font-bold text-slate-500">
                  {deduction.shortLabel}
                </span>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {deduction.label}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Monthly deduction
                </p>
              </div>
            </div>

            <span className="text-sm font-bold text-slate-800">
              {formatCurrency(deduction.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-red-50 px-4 py-4">
        <span className="text-sm font-semibold text-red-700">
          Total Deductions
        </span>

        <span className="text-lg font-bold text-red-700">
          {formatCurrency(totalDeductions)}
        </span>
      </div>
    </div>
  );
}

function TaxDetails({
  latestPayroll,
  taxableIncome,
  taxDeducted,
}: {
  latestPayroll: any | null;
  taxableIncome: number;
  taxDeducted: number;
}) {
  const professionalTax = latestPayroll
    ? Number(latestPayroll.deductions?.pt ?? 0)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          Tax Details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Your tax-related payroll information.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            Income Tax (TDS)
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {latestPayroll
              ? formatCurrency(taxDeducted)
              : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {latestPayroll?.month
              ? `Deducted for ${latestPayroll.month}`
              : "No payroll information available"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            Professional Tax
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {latestPayroll
              ? formatCurrency(professionalTax)
              : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {latestPayroll?.month
              ? `Deducted for ${latestPayroll.month}`
              : "No payroll information available"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            Taxable Income
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {latestPayroll
              ? formatCurrency(taxableIncome)
              : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Taxable income for {latestPayroll?.month ?? "the selected payroll period"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            Total Tax Deducted
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {latestPayroll
              ? formatCurrency(taxDeducted)
              : "—"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Income tax deducted from payroll
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5 sm:col-span-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Tax information
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Taxable income and tax deductions are now connected
                to your payroll information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeePayroll;
