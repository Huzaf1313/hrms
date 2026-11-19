import { Clock, Plane, Ticket, Users, Zap } from "lucide-react";

interface QuickActionsCardProps {
  onNavigate?: (page: string) => void;
  className?: string;
}

export default function QuickActionsCard({
  onNavigate,
  className = "col-span-12 md:col-span-6 xl:col-span-4",
}: QuickActionsCardProps) {
  const actions = [
    {
      id: "add-employee",
      label: "Add Employee",
      icon: Users,
      boxClass: "bg-blue-50/90 text-[#0066ff] border border-blue-100",
      page: "Employees",
    },
    {
      id: "mark-attendance",
      label: "Mark Attendance",
      icon: Clock,
      boxClass: "bg-emerald-50/90 text-[#16a34a] border border-emerald-100",
      page: "Attendance",
    },
    {
      id: "apply-leave",
      label: "Apply Leave",
      icon: Plane,
      boxClass: "bg-orange-50/90 text-[#ea580c] border border-orange-100",
      page: "Leave",
    },
    {
      id: "raise-ticket",
      label: "Raise Ticket",
      icon: Ticket,
      boxClass: "bg-purple-50/90 text-[#7c3aed] border border-purple-100",
      page: "Support Tickets",
    },
  ];

  return (
    <div
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Zap className="h-4.5 w-4.5 text-[#0066ff] fill-[#0066ff]" />
        <h2 className="text-base font-bold text-[#0f172a] font-manrope">
          Quick Actions
        </h2>
      </div>

      {/* 4 Action Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => action.page && onNavigate?.(action.page)}
              className="group flex flex-col items-center justify-center gap-2.5 rounded-2xl p-2.5 transition-all duration-150 hover:scale-[1.03]"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 group-hover:shadow ${action.boxClass}`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
