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
  Printer,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { employeeService } from "../employees/employeeService";
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
  const [bankInformation, setBankInformation] = useState<{
    bank_name?: string;
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    branch?: string;
  } | null>(null);

  const [bankInformationLoading, setBankInformationLoading] = useState(true);

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

  useEffect(() => {
    let isMounted = true;

    async function fetchBankInformation() {
      try {
        setBankInformationLoading(true);

        const employeeProfile = await employeeService.getMyProfile();

        if (!isMounted) return;

        setBankInformation(employeeProfile.bank_information ?? null);
      } catch (error) {
        console.error("Failed to fetch employee bank information:", error);

        if (isMounted) {
          setBankInformation(null);
        }
      } finally {
        if (isMounted) {
          setBankInformationLoading(false);
        }
      }
    }

    fetchBankInformation();

    return () => {
      isMounted = false;
    };
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
      <div className="space-y-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-manrope">
              My Payslip
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              View your monthly salary slips, deductions, and tax calculations.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 shadow-xs">
            <CalendarDays className="h-4 w-4 text-blue-600" />

            <label
              htmlFor="payroll-month"
              className="text-xs font-semibold text-slate-500"
            >
              Month & Year
            </label>

            <select
              id="payroll-month"
              value={selectedPayrollId}
              onChange={(event) => setSelectedPayrollId(event.target.value)}
              disabled={payslips.length === 0}
              className="cursor-pointer bg-transparent text-sm font-bold text-slate-800 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
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
          <div className="flex flex-col justify-between rounded-3xl border border-slate-100 bg-white p-5.5 shadow-kpi transition-all duration-200 hover:-translate-y-0.5">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-manrope">
                    Net Take-Home Salary
                  </p>
                  <p className="mt-2 text-2xl font-bold font-manrope text-slate-900">
                    {latestPayroll
                      ? formatCurrency(Number(latestPayroll.net_salary ?? 0))
                      : "—"}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
                  <Banknote className="h-5 w-5 text-emerald-600" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  <CircleCheck className="h-3.5 w-3.5" />
                  {latestPayroll?.payment?.status ?? "Credited"}
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
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-kpi">
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
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-kpi">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Bank Account
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-900">
                    {bankInformationLoading
                      ? "Loading..."
                      : bankInformation?.bank_name || "Bank information not added"}
                  </p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                  <Landmark className="h-5 w-5 text-violet-600" />
                </div>
              </div>


              <div className="mt-4 space-y-3">
                {/* Account Number */}
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 shrink-0 text-slate-400" />

                  <span className="text-sm font-medium text-slate-600">
                    {bankInformationLoading
                      ? "Loading account details..."
                      : bankInformation?.account_number
                        ? `•••• •••• ${bankInformation.account_number.slice(-4)}`
                        : "Account number not provided"}
                  </span>
                </div>
                {/* Account Holder */}
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />

                  <span className="text-sm text-slate-600">
                    <span className="font-medium text-slate-500">
                      Account Holder:{" "}
                    </span>
                    {bankInformationLoading
                      ? "Loading..."
                      : bankInformation?.account_holder_name || "Not provided"}
                  </span>
                </div>

                {/* IFSC Code */}
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 shrink-0 text-slate-400" />

                  <span className="text-sm text-slate-600">
                    <span className="font-medium text-slate-500">
                      IFSC Code:{" "}
                    </span>
                    {bankInformationLoading
                      ? "Loading..."
                      : bankInformation?.ifsc_code || "Not provided"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Payroll Area */}
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Content */}
          <section className="min-w-0 rounded-3xl border border-slate-100 bg-white shadow-xs">
            {/* Tabs */}
            <div className="overflow-x-auto border-b border-slate-100 p-3">
              <div className="flex min-w-max gap-1.5">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab;

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleTabChange(tab)}
                      className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${isActive
                        ? "bg-[#0066ff] text-white shadow-md shadow-blue-500/20"
                        : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-800"
                        }`}
                    >
                      {tab}
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
                          #2563eb 0deg ${(salaryComponents[0].percentage / 100) * 360
                      }deg,
                          #60a5fa ${(salaryComponents[0].percentage / 100) * 360
                      }deg ${((salaryComponents[0].percentage +
                        salaryComponents[1].percentage) /
                        100) *
                      360
                      }deg,
                          #818cf8 ${((salaryComponents[0].percentage +
                        salaryComponents[1].percentage) /
                        100) *
                      360
                      }deg ${((salaryComponents[0].percentage +
                        salaryComponents[1].percentage +
                        salaryComponents[2].percentage) /
                        100) *
                      360
                      }deg,
                          #a78bfa ${((salaryComponents[0].percentage +
                        salaryComponents[1].percentage +
                        salaryComponents[2].percentage) /
                        100) *
                      360
                      }deg ${((salaryComponents[0].percentage +
                        salaryComponents[1].percentage +
                        salaryComponents[2].percentage +
                        salaryComponents[3].percentage) /
                        100) *
                      360
                      }deg,
                          #c4b5fd ${((salaryComponents[0].percentage +
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
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${[
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
      </div>

      {/* Payslip View & Print Modal */}
      {selectedPayslip && (() => {
        const activeRecord = payrollData.find((p) => p.id === selectedPayslip.id) || latestPayroll;
        const earningsList = activeRecord?.salary?.earnings && activeRecord.salary.earnings.length > 0
          ? activeRecord.salary.earnings
          : [{ label: "Basic Salary", amount: activeRecord?.salary?.basic || activeRecord?.salary?.gross || selectedPayslip.amount }];

        const deductionsList = activeRecord?.deductions?.items && activeRecord.deductions.items.length > 0
          ? activeRecord.deductions.items
          : Object.entries(activeRecord?.deductions || {})
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

        const gross = activeRecord?.salary?.gross || selectedPayslip.amount;
        const deductionsTotal = activeRecord?.deductions?.total || 0;
        const net = activeRecord?.net_salary || selectedPayslip.amount;
        const status = activeRecord?.payment?.status || selectedPayslip.status;
        const userObj = JSON.parse(localStorage.getItem("user") || "{}");
        const empName = userObj.full_name || userObj.name || "Employee";
        const empCode = userObj.employee_id || "-";
        const att = activeRecord?.attendance_summary;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPayslip(null); }}
          >
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                .employee-payslip-printable, .employee-payslip-printable * {
                  visibility: visible !important;
                }
                .employee-payslip-printable {
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
            <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
              <div className="no-print flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold text-slate-900">Official Payslip</h3>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    {status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    title="Print or Save as PDF"
                  >
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    Print / PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPayslip(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="employee-payslip-printable relative p-6 sm:p-8">
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
                    <div>Month: <span className="font-semibold text-slate-900">{selectedPayslip.month}</span></div>
                    {selectedPayslip.paidOn && (
                      <div className="text-slate-500">Paid on: <span className="font-medium text-slate-700">{selectedPayslip.paidOn}</span></div>
                    )}
                  </div>
                </header>

                <section className="mt-5">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Employee Information
                  </h4>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-slate-400">Name:</span>{" "}
                      <span className="font-semibold text-slate-800">{empName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Employee ID:</span>{" "}
                      <span className="font-semibold text-slate-800">{empCode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Department:</span>{" "}
                      <span className="font-semibold text-slate-800">{userObj.department || "General"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Bank Name:</span>{" "}
                      <span className="font-semibold text-slate-800">{bankInformation?.bank_name || activeRecord?.bank_details?.bank_name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Account No:</span>{" "}
                      <span className="font-semibold text-slate-800">
                        {bankInformation?.account_number
                          ? `•••• •••• ${bankInformation.account_number.slice(-4)}`
                          : activeRecord?.bank_details?.account_last4
                            ? `•••• ${activeRecord.bank_details.account_last4}`
                            : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Payment Status:</span>{" "}
                      <span className="font-semibold text-emerald-700">{status}</span>
                    </div>
                  </div>
                </section>

                {att && (att.total_days || 0) > 0 && (
                  <section className="mt-4">
                    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Attendance & Leave Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                      <div>
                        <span className="text-slate-400">Working Days:</span>{" "}
                        <span className="font-semibold text-slate-800">{att.total_days}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Present Days:</span>{" "}
                        <span className="font-semibold text-emerald-700">{att.present_days}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Paid Leaves:</span>{" "}
                        <span className="font-semibold text-blue-700">{att.paid_leave_days || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Loss of Pay (LOP):</span>{" "}
                        <span className={`font-semibold ${(att.lop_days || 0) > 0 ? "text-rose-600 font-bold" : "text-slate-700"}`}>
                          {att.lop_days || 0} days
                          {(att.lop_deduction || 0) > 0 && (
                            <span className="ml-1 text-[11px] text-rose-600">(-₹{att.lop_deduction.toLocaleString("en-IN")})</span>
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
                  <div className="overflow-x-auto rounded-lg border border-slate-200 text-xs">
                    <table className="w-full min-w-[480px]">
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
      })()}
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
