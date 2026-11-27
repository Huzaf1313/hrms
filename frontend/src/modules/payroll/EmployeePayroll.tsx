import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  ShieldCheck,
  Printer,
  TrendingUp,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { employeeService } from "../employees/employeeService";
import { useGlobalDate } from "../../context/globalDateContext";
import { GlobalDateBadge } from "../../components/GlobalDateBadge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageHeading } from "../../components/ui/PageHeading";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { Tabs } from "../../components/ui/Tabs";

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

interface BackendPayrollRecord {
  id: string;
  _id?: string;
  month: string;
  pay_period_start: string;
  pay_period_end: string;
  salary: {
    basic: number;
    gross: number;
    hra?: number;
    allowances?: number;
    earnings?: Array<{ name?: string; label?: string; amount: number }>;
    [key: string]: number | string | Array<{ name?: string; label?: string; amount: number }> | undefined;
  };
  deductions: {
    total: number;
    pf?: number;
    pt?: number;
    tds?: number;
    items?: Array<{ name?: string; label?: string; amount: number }>;
    [key: string]: number | string | Array<{ name?: string; label?: string; amount: number }> | undefined;
  };
  net_salary: number;
  bank_details?: {
    bank_name?: string;
    account_last4?: string;
    account_number?: string;
    ifsc_code?: string;
    branch?: string;
  };
  attendance_summary?: {
    total_days?: number;
    present_days?: number;
    paid_leave_days?: number;
    lop_days?: number;
    lop_deduction?: number;
  };
  tax_details?: {
    taxable_income?: number;
    tax_deducted?: number;
    regime?: string;
    standard_deduction?: number;
  };
  payment?: {
    paid_on?: string;
    status?: string;
  };
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function EmployeePayroll() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PayrollTab>("Payslips");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const [payrollData, setPayrollData] = useState<BackendPayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [latestPayroll, setLatestPayroll] = useState<BackendPayrollRecord | null>(null);
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
          items: BackendPayrollRecord[];
          total: number;
          page: number;
          limit: number;
          pages: number;
        }>(`/employee-payroll/employees/${employeeId}`, {
          page: 1,
          limit: 100,
        });

        const items = response.items || [];
        setPayrollData(items);
        if (items.length > 0) {
          setSelectedPayrollId((prev) => prev || String(items[0].id ?? items[0]._id ?? ""));
        }

        const latestResponse = await api
          .get<BackendPayrollRecord>(`/employee-payroll/employees/${employeeId}/latest`)
          .catch(() => null);

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
  }, [refreshTick]);

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
    id: String(record.id ?? record._id ?? record.month),
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

  const activePayroll =
    visiblePayrollData.find(
      (record) => String(record.id ?? record._id ?? "") === selectedPayrollId,
    ) ??
    (isGlobalDateDefault ? latestPayroll : visiblePayrollData[0]) ??
    null;

  const salaryComponents: SalaryComponent[] = activePayroll
    ? [
      {
        label: "Basic Salary",
        amount: Number(activePayroll.salary?.basic ?? 0),
        percentage:
          activePayroll.salary?.gross > 0
            ? Math.round(
              (Number(activePayroll.salary?.basic ?? 0) /
                Number(activePayroll.salary.gross)) *
              100
            )
            : 0,
      },
      {
        label: "HRA",
        amount: Number(activePayroll.salary?.hra ?? 0),
        percentage:
          activePayroll.salary?.gross > 0
            ? Math.round(
              (Number(activePayroll.salary?.hra ?? 0) /
                Number(activePayroll.salary.gross)) *
              100
            )
            : 0,
      },
      {
        label: "Special Allowance",
        amount: Number(activePayroll.salary?.special_allowance ?? 0),
        percentage:
          activePayroll.salary?.gross > 0
            ? Math.round(
              (Number(activePayroll.salary?.special_allowance ?? 0) /
                Number(activePayroll.salary.gross)) *
              100
            )
            : 0,
      },
      {
        label: "Conveyance",
        amount: Number(activePayroll.salary?.conveyance ?? 0),
        percentage:
          activePayroll.salary?.gross > 0
            ? Math.round(
              (Number(activePayroll.salary?.conveyance ?? 0) /
                Number(activePayroll.salary.gross)) *
              100
            )
            : 0,
      },
      {
        label: "Other Allowance",
        amount: Number(activePayroll.salary?.other_allowance ?? 0),
        percentage:
          activePayroll.salary?.gross > 0
            ? Math.round(
              (Number(activePayroll.salary?.other_allowance ?? 0) /
                Number(activePayroll.salary.gross)) *
              100
            )
            : 0,
      },
    ]
    : [];

  const deductions: Deduction[] = activePayroll
    ? [
      {
        label: "Provident Fund",
        shortLabel: "PF",
        amount: Number(activePayroll.deductions?.pf ?? 0),
      },
      {
        label: "Professional Tax",
        shortLabel: "PT",
        amount: Number(activePayroll.deductions?.pt ?? 0),
      },
      {
        label: "Income Tax (TDS)",
        shortLabel: "TDS",
        amount: Number(activePayroll.deductions?.tds ?? 0),
      },
    ]
    : [];

  const taxableIncome = activePayroll
    ? Number(activePayroll.tax_details?.taxable_income ?? 0)
    : 0;

  const taxDeducted = activePayroll
    ? Number(activePayroll.tax_details?.tax_deducted ?? 0)
    : 0;

  const totalPages = Math.ceil(payslips.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentPayslips = payslips.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const pageStart =
    payslips.length === 0
      ? 0
      : (currentPage - 1) * ITEMS_PER_PAGE + 1;

  const pageEnd = Math.min(
    currentPage * ITEMS_PER_PAGE,
    payslips.length,
  );

  const totalDeductions = activePayroll
    ? Number(activePayroll.deductions?.total ?? 0)
    : 0;

  const grossSalary = activePayroll
    ? Number(activePayroll.salary?.gross ?? 0)
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

  const activePayslipItem: Payslip | null = activePayroll
    ? {
        id: String(activePayroll.id ?? activePayroll._id ?? activePayroll.month),
        month: activePayroll.month,
        paidOn: activePayroll.payment?.paid_on
          ? new Date(activePayroll.payment.paid_on).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "Not paid",
        amount: Number(activePayroll.net_salary ?? 0),
        status:
          activePayroll.payment?.status === "Processing"
            ? "Processing"
            : "Credited",
      }
    : null;

  const monthOptions =
    payslips.length === 0
      ? [{ value: "", label: "No payroll available" }]
      : payslips.map((p) => ({ value: p.id, label: p.month }));

  return (
    <>
      <div className="flex w-full flex-col gap-5 pb-10">
        {/* Slim Page Header */}
        <PageHeading
          title="View your monthly salary slips, deductions, and tax calculations."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#2563EB]" />
                <Select
                  aria-label="Month & Year"
                  value={selectedPayrollId}
                  onChange={(event) => setSelectedPayrollId(event.target.value)}
                  disabled={payslips.length === 0}
                  wrapperClassName="w-[185px]"
                  className="h-9 text-[12px] font-medium"
                  options={monthOptions}
                />
              </div>

              {activePayslipItem && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setSelectedPayslip(activePayslipItem)}
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                >
                  View &amp; Print Payslip
                </Button>
              )}
            </div>
          }
        />

        {error && (
          <ErrorState
            title="Could not load payroll information"
            message={error}
            onRetry={() => setRefreshTick((tick) => tick + 1)}
            className="max-w-none rounded-xl border border-[#FECACA] bg-white py-5"
          />
        )}

        {/* 4 Equal KPI Cards */}
        <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="min-h-[132px] rounded-xl border border-[#E5E7EB] bg-white p-5"
              >
                <div className="space-y-3">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-7 w-32 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              </div>
            ))
          ) : (
            <>
              {/* Net Take-Home */}
              <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#6B7280]">
                      Net Take-Home Salary
                    </p>
                    <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827]">
                      {activePayroll
                        ? formatCurrency(Number(activePayroll.net_salary ?? 0))
                        : "—"}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <Banknote className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>

                <div className="mt-auto pt-3">
                  {activePayroll ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        activePayroll.payment?.status === "Processing"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <CircleCheck className="h-3.5 w-3.5" />
                      {activePayroll.payment?.status ?? "Credited"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-medium text-[#6B7280]">
                      <Clock className="h-3 w-3" />
                      Awaiting payroll run
                    </span>
                  )}
                </div>
              </div>

              {/* Gross Salary & Deductions */}
              <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#6B7280]">
                      Gross Earnings
                    </p>
                    <p className="mt-2 text-[26px] font-semibold leading-none text-[#111827]">
                      {activePayroll ? formatCurrency(grossSalary) : "—"}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <TrendingUp className="h-4 w-4 text-[#2563EB]" />
                  </div>
                </div>

                <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">
                  {activePayroll
                    ? `Basic: ${formatCurrency(Number(activePayroll.salary?.basic ?? 0))} · Deductions: ${formatCurrency(totalDeductions)}`
                    : "Earnings & deductions before tax"}
                </p>
              </div>

              {/* Pay Period */}
              <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-[#6B7280]">
                      Pay Period
                    </p>
                    <p className="mt-2 text-[18px] font-semibold leading-snug text-[#111827]">
                      {activePayroll?.month ?? "No active cycle"}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <CalendarDays className="h-4 w-4 text-amber-600" />
                  </div>
                </div>

                <p className="mt-auto pt-3 text-[12px] text-[#6B7280]">
                  {activePayroll
                    ? `${new Date(activePayroll.pay_period_start).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )} – ${new Date(activePayroll.pay_period_end).toLocaleDateString(
                      "en-IN",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }
                    )}`
                    : "Cycle dates appear after payroll run"}
                </p>
              </div>

              {/* Bank Account */}
              <div className="flex flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-[#6B7280]">
                      Salary Bank Account
                    </p>

                    <p className="mt-2 truncate text-[16px] font-semibold text-[#111827]">
                      {bankInformationLoading
                        ? "Loading..."
                        : bankInformation?.bank_name || "Not added yet"}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                    <Landmark className="h-4 w-4 text-purple-600" />
                  </div>
                </div>

                <p className="mt-auto truncate pt-3 text-[12px] text-[#6B7280]">
                  {bankInformationLoading
                    ? "Checking bank details..."
                    : bankInformation?.account_number
                      ? `•••• ${bankInformation.account_number.slice(-4)}${bankInformation.ifsc_code ? ` · ${bankInformation.ifsc_code}` : ""}`
                      : "Pending from HR"}
                </p>
              </div>
            </>
          )}
        </section>

        {/* Main Payroll Area */}
        <div className="grid grid-cols-12 items-stretch gap-5">
          {/* Main Content */}
          <section className="col-span-12 flex min-w-0 flex-col rounded-xl border border-[#E5E7EB] bg-white xl:col-span-8">
            {/* Underline Tabs */}
            <div className="border-b border-[#E5E7EB] px-5 pt-2">
              <Tabs
                variant="underline"
                activeTab={activeTab}
                onChange={(tab) => handleTabChange(tab as PayrollTab)}
                tabs={tabs.map((tab) => ({ id: tab, label: tab }))}
              />
            </div>

            {/* Tab Content */}
            <div className="flex flex-1 flex-col p-5">
              {activeTab === "Payslips" && (
                <>
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-[14px] font-semibold text-[#111827]">
                        Payslip History
                      </h2>
                      <p className="mt-0.5 text-[12px] text-[#6B7280]">
                        Your previous salary payments and downloadable payslips.
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <GlobalDateBadge prefix="Period" />

                      <span className="text-[12px] font-medium text-[#6B7280]">
                        {payslips.length} {payslips.length === 1 ? "payslip" : "payslips"}
                      </span>
                    </div>
                  </div>

                  {loading ? (
                    <div className="space-y-3 py-4">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : currentPayslips.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-8">
                      <EmptyState
                        icon={<FileText className="h-4 w-4" />}
                        title="No payslips generated yet"
                        description="Your monthly salary slips will appear here once HR processes payroll."
                        className="max-w-none"
                      />
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden overflow-hidden rounded-xl border border-[#E5E7EB] md:block">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[650px]">
                            <thead>
                              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                                  Month
                                </th>
                                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                                  Paid On
                                </th>
                                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                                  Amount
                                </th>
                                <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                                  Status
                                </th>
                                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                                  Action
                                </th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-[#E5E7EB]">
                              {currentPayslips.map((payslip) => (
                                <tr
                                  key={`${payslip.id}-${payslip.month}`}
                                  className="transition hover:bg-[#F9FAFB]"
                                >
                                  <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                                        <FileText className="h-4 w-4 text-[#2563EB]" />
                                      </div>

                                      <span className="text-[13px] font-semibold text-[#111827]">
                                        {payslip.month}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3.5 text-[13px] text-[#6B7280]">
                                    {payslip.paidOn}
                                  </td>

                                  <td className="px-5 py-3.5 text-right text-[13px] font-semibold text-[#111827]">
                                    {formatCurrency(payslip.amount)}
                                  </td>

                                  <td className="px-5 py-3.5 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        payslip.status === "Processing"
                                          ? "bg-amber-50 text-amber-700"
                                          : "bg-emerald-50 text-emerald-700"
                                      }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          payslip.status === "Processing"
                                            ? "bg-amber-500"
                                            : "bg-emerald-500"
                                        }`}
                                      />
                                      {payslip.status}
                                    </span>
                                  </td>

                                  <td className="px-5 py-3.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPayslip(payslip)}
                                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#2563EB] transition hover:bg-blue-50"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
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
                            key={`${payslip.id}-${payslip.month}`}
                            className="rounded-xl border border-[#E5E7EB] p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                                  <FileText className="h-4 w-4 text-[#2563EB]" />
                                </div>

                                <div>
                                  <p className="text-[13px] font-semibold text-[#111827]">
                                    {payslip.month}
                                  </p>
                                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                                    Paid on {payslip.paidOn}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  payslip.status === "Processing"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    payslip.status === "Processing"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                />
                                {payslip.status}
                              </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                              <span className="text-sm font-bold text-[#111827]">
                                {formatCurrency(payslip.amount)}
                              </span>

                              <button
                                type="button"
                                onClick={() => setSelectedPayslip(payslip)}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      <div className="mt-auto flex flex-col gap-3 border-t border-[#E5E7EB] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[12px] text-[#6B7280]">
                          Showing{" "}
                          <span className="font-semibold text-[#111827]">
                            {pageStart}–{pageEnd}
                          </span>{" "}
                          of{" "}
                          <span className="font-semibold text-[#111827]">
                            {payslips.length}
                          </span>
                        </p>

                        {totalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handlePreviousPage}
                              disabled={currentPage === 1}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Previous page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>

                            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#2563EB] px-2.5 text-xs font-semibold text-white">
                              {currentPage}
                            </span>

                            <button
                              type="button"
                              onClick={handleNextPage}
                              disabled={currentPage === totalPages}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Next page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === "Salary Details" && (
                <SalaryDetails
                  salaryComponents={salaryComponents}
                  grossSalary={grossSalary}
                  netSalary={netSalary}
                  payrollMonth={activePayroll?.month}
                />
              )}

              {activeTab === "Deductions & Contributions" && (
                <DeductionsDetails
                  deductions={deductions}
                  totalDeductions={totalDeductions}
                  payrollMonth={activePayroll?.month}
                />
              )}

              {activeTab === "Tax Details" && (
                <TaxDetails
                  latestPayroll={activePayroll}
                  taxableIncome={taxableIncome}
                  taxDeducted={taxDeducted}
                />
              )}
            </div>
          </section>

          {/* Right Sidebar */}
          <aside className="col-span-12 flex flex-col gap-5 xl:col-span-4">
            {activePayroll ? (
              <>
                {/* Salary Breakdown */}
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <div className="mb-4">
                    <h2 className="text-[14px] font-semibold text-[#111827]">
                      Salary Breakdown
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[#6B7280]">
                      {activePayroll.month}
                    </p>
                  </div>

                  {/* Donut */}
                  <div className="flex justify-center">
                    <div
                      className="relative h-44 w-44 rounded-full"
                      style={{
                        background:
                          grossSalary > 0
                            ? `conic-gradient(
                                #2563eb 0deg ${(salaryComponents[0].percentage / 100) * 360}deg,
                                #60a5fa ${(salaryComponents[0].percentage / 100) * 360}deg ${((salaryComponents[0].percentage + salaryComponents[1].percentage) / 100) * 360}deg,
                                #818cf8 ${((salaryComponents[0].percentage + salaryComponents[1].percentage) / 100) * 360}deg ${((salaryComponents[0].percentage + salaryComponents[1].percentage + salaryComponents[2].percentage) / 100) * 360}deg,
                                #a78bfa ${((salaryComponents[0].percentage + salaryComponents[1].percentage + salaryComponents[2].percentage) / 100) * 360}deg ${((salaryComponents[0].percentage + salaryComponents[1].percentage + salaryComponents[2].percentage + salaryComponents[3].percentage) / 100) * 360}deg,
                                #c4b5fd ${((salaryComponents[0].percentage + salaryComponents[1].percentage + salaryComponents[2].percentage + salaryComponents[3].percentage) / 100) * 360}deg 360deg
                              )`
                            : "conic-gradient(#E5E7EB 0deg 360deg)",
                      }}
                    >
                      <div className="absolute inset-[22px] flex flex-col items-center justify-center rounded-full bg-white">
                        <span className="text-[11px] font-medium text-[#6B7280]">
                          Gross Salary
                        </span>
                        <span className="mt-0.5 text-lg font-bold text-[#111827]">
                          {formatCurrency(grossSalary)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Salary Legend */}
                  <div className="mt-5 space-y-2.5">
                    {salaryComponents.map((component, index) => (
                      <div
                        key={component.label}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${[
                              "bg-blue-600",
                              "bg-blue-400",
                              "bg-indigo-400",
                              "bg-violet-400",
                              "bg-violet-300",
                            ][index]}`}
                          />

                          <span className="truncate text-[12px] text-[#4B5563]">
                            {component.label}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[12px] font-semibold text-[#111827]">
                            {formatCurrency(component.amount)}
                          </span>

                          <span className="w-7 text-right text-[11px] text-[#9CA3AF]">
                            {component.percentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Recent Deductions */}
                <section className="flex flex-1 flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-[14px] font-semibold text-[#111827]">
                          Recent Deductions
                        </h2>
                        <p className="mt-0.5 text-[12px] text-[#6B7280]">
                          {activePayroll.month}
                        </p>
                      </div>

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50">
                        <ShieldCheck className="h-4 w-4 text-rose-500" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {deductions.map((deduction) => (
                        <div
                          key={deduction.shortLabel}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F4F6]">
                              <span className="text-[10px] font-bold text-[#4B5563]">
                                {deduction.shortLabel}
                              </span>
                            </div>

                            <span className="text-[12px] text-[#4B5563]">
                              {deduction.label}
                            </span>
                          </div>

                          <span className="text-[12px] font-semibold text-[#111827]">
                            {formatCurrency(deduction.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                    <span className="text-[13px] font-semibold text-[#4B5563]">
                      Total Deductions
                    </span>

                    <span className="text-[14px] font-bold text-rose-600">
                      {formatCurrency(totalDeductions)}
                    </span>
                  </div>
                </section>
              </>
            ) : (
              /* Helpful Payroll Readiness Card when no payroll exists yet */
              <section className="flex flex-1 flex-col justify-between rounded-xl border border-[#E5E7EB] bg-white p-5">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#111827]">
                    Payroll Checklist
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    Ensure your details are ready before the monthly payroll run.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]/70 p-3">
                      <div className="flex items-start gap-2.5">
                        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#6B7280]" />
                        <div>
                          <p className="text-[12px] font-semibold text-[#111827]">
                            Bank Account Details
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6B7280]">
                            {bankInformation?.bank_name
                              ? `${bankInformation.bank_name} configured`
                              : "Missing — ask HR to update your bank info"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          bankInformation?.bank_name
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {bankInformation?.bank_name ? "Ready" : "Pending"}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]/70 p-3">
                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#6B7280]" />
                        <div>
                          <p className="text-[12px] font-semibold text-[#111827]">
                            Attendance &amp; Leave Sync
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6B7280]">
                            Approved leaves &amp; punches count toward monthly pay.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/employee/attendance")}
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                      >
                        Check <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-4">
                  <span className="text-[12px] text-[#6B7280]">
                    Questions about salary or bank details?
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/employee/help")}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    Contact HR Support <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
            )}
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
                            <span className="ml-1 text-[11px] text-rose-600">(-₹{(att.lop_deduction ?? 0).toLocaleString("en-IN")})</span>
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
                              {row.deduction?.label || (row.deduction && "name" in row.deduction ? row.deduction.name : undefined) || "-"}
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
      <div className="mb-5">
        <h2 className="text-[14px] font-semibold text-[#111827]">
          Salary Details
        </h2>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">
          {payrollMonth
            ? `Your salary structure for ${payrollMonth}.`
            : "Your salary structure."}
        </p>
      </div>

      {salaryComponents.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-4 w-4" />}
          title="No salary breakdown available"
          description="Salary component details will appear here once payroll is generated."
          className="max-w-none py-8"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
          <div className="divide-y divide-[#E5E7EB]">
            {salaryComponents.map((component) => (
              <div
                key={component.label}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {component.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    {component.percentage}% of gross salary
                  </p>
                </div>

                <span className="text-[13px] font-bold text-[#111827]">
                  {formatCurrency(component.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#374151]">
                Gross Salary
              </span>
              <span className="text-[14px] font-bold text-[#111827]">
                {formatCurrency(grossSalary)}
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#374151]">
                Estimated Net Salary
              </span>
              <span className="text-[14px] font-bold text-[#2563EB]">
                {formatCurrency(netSalary)}
              </span>
            </div>
          </div>
        </div>
      )}
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
      <div className="mb-5">
        <h2 className="text-[14px] font-semibold text-[#111827]">
          Deductions &amp; Contributions
        </h2>
        <p className="mt-0.5 text-[12px] text-[#6B7280]">
          {payrollMonth
            ? `Deductions applied to your ${payrollMonth} salary.`
            : "Deductions applied to your salary."}
        </p>
      </div>

      {deductions.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-4 w-4" />}
          title="No deductions recorded"
          description="Monthly PF, PT, and tax deductions will appear here once payroll is processed."
          className="max-w-none py-8"
        />
      ) : (
        <>
          <div className="space-y-3">
            {deductions.map((deduction) => (
              <div
                key={deduction.shortLabel}
                className="flex items-center justify-between rounded-xl border border-[#E5E7EB] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3F4F6]">
                    <span className="text-xs font-bold text-[#4B5563]">
                      {deduction.shortLabel}
                    </span>
                  </div>

                  <div>
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {deduction.label}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#6B7280]">
                      Monthly deduction
                    </p>
                  </div>
                </div>

                <span className="text-[13px] font-bold text-[#111827]">
                  {formatCurrency(deduction.amount)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
            <span className="text-[13px] font-semibold text-rose-700">
              Total Deductions
            </span>

            <span className="text-base font-bold text-rose-700">
              {formatCurrency(totalDeductions)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function TaxDetails({
  latestPayroll,
  taxableIncome,
  taxDeducted,
}: {
  latestPayroll: BackendPayrollRecord | null;
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
