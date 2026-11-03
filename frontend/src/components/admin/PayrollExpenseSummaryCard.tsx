import type { CSSProperties } from "react";
import { Wallet } from "lucide-react";

import DashboardCard from "./DashboardCard";

import { formatIndianAmount } from "./dashboardData";
import { useCountUp } from "./useDashboardAnimation";

interface PayrollExpenseSummaryCardProps {
  onOpenPayroll: () => void;
  payrollThisMonth?: number | null;
  totalExpenses?: number | null;
  payrollChangePercent?: number | null;
  expenseChangePercent?: number | null;
  isLoading?: boolean;
}

function formatChange(percent: number | null | undefined) {
  if (percent === null || percent === undefined) {
    return { text: "No data from last month", color: "text-gray-400" };
  }
  if (percent > 0) {
    return { text: `↗ +${percent}% from last month`, color: "text-[#16a34a]" };
  }
  if (percent < 0) {
    return { text: `↘ ${percent}% from last month`, color: "text-[#dc2626]" };
  }
  return { text: "No change from last month", color: "text-gray-500" };
}

export default function PayrollExpenseSummaryCard({
  onOpenPayroll,
  payrollThisMonth,
  totalExpenses,
  payrollChangePercent,
  expenseChangePercent,
  isLoading = false,
}: PayrollExpenseSummaryCardProps) {
  const payroll = useCountUp(payrollThisMonth ?? 0, 1500);
  const expenses = useCountUp(totalExpenses ?? 0, 1500);

  const payrollChange = formatChange(payrollChangePercent);
  const expenseChange = formatChange(expenseChangePercent);

  return (
    <DashboardCard
      title="Payroll & Expense Summary"
      className="col-span-12 md:col-span-6 xl:col-span-4"
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onOpenPayroll}
          className="dashboard-rise flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 text-left transition hover:border-[#bfdbfe] hover:bg-[#eff6ff]"
          style={{ "--dashboard-delay": "120ms" } as CSSProperties}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dbeafe] text-[#2563eb]">
            <Wallet className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500">Payroll This Month</p>
            <p className="text-[15px] font-bold text-gray-900">
              {isLoading ? "..." : `₹ ${formatIndianAmount(Math.round(payroll))}`}
            </p>
            <p className={`text-[10px] font-medium ${payrollChange.color}`}>
              {payrollChange.text}
            </p>
          </div>
        </button>

        <div
          className="dashboard-rise flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
          style={{ "--dashboard-delay": "240ms" } as CSSProperties}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e0e7ff] text-[#4f46e5]">
            <Wallet className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-500">
              Total Expenses (This Month)
            </p>
            <p className="text-[15px] font-bold text-gray-900">
              {isLoading ? "..." : `₹ ${formatIndianAmount(Math.round(expenses))}`}
            </p>
            <p className={`text-[10px] font-medium ${expenseChange.color}`}>
              {expenseChange.text}
            </p>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}