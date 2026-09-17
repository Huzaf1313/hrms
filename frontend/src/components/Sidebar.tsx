import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  CalendarDays,
  Wallet,
  Briefcase,
  TrendingUp,
  BarChart3,
  Settings,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void; // Added optional onLogout prop just in case you want to use it here later
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  page?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Main",
    items: [{ label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" }],
  },
  {
    title: "Organization",
    items: [
      { label: "Employees", icon: Users, page: "Employees" },
      { label: "Departments", icon: Building2 },
    ],
  },
  {
    title: "Attendance",
    items: [
      { label: "Attendance", icon: CalendarCheck, page: "Attendance" },
      { label: "Leave", icon: CalendarDays, page: "Leave" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Payroll", icon: Wallet, page: "Payroll" },
      { label: "Recruitment", icon: Briefcase },
      { label: "Performance", icon: TrendingUp },
      { label: "Reports", icon: BarChart3 },
      { label: "Settings", icon: Settings },
    ],
  },
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <aside className="sticky top-0 flex h-screen w-[250px] shrink-0 flex-col overflow-hidden bg-[#0d1e3e] px-4 py-6">
      {/* Logo */}
      <button
        type="button"
        onClick={() => {
          onNavigate("Dashboard");
          navigate("/dashboard");
        }}
        className="mb-8 flex items-center gap-3 px-2 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]">
          <Users className="h-5 w-5 text-white" />
        </span>

        <span>
          <span className="block text-xl font-bold text-white">HRMS</span>
          <span className="block text-xs text-slate-400">Admin Portal</span>
        </span>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              {section.title}
            </p>

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = Boolean(item.page) && activePage === item.page;
                const isDisabled = !item.page;

                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!item.page) return;
                      onNavigate(item.page);
                      if (item.page === "Dashboard") navigate("/dashboard");
                    }}
                    className={`flex h-[46px] items-center gap-3 rounded-xl px-3 text-left text-[15px] transition ${
                      isActive
                        ? "bg-[#2563eb] font-semibold text-white shadow-lg shadow-blue-900/30"
                        : isDisabled
                          ? "cursor-not-allowed text-slate-600"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive
                          ? "text-white"
                          : isDisabled
                            ? "text-slate-700"
                            : "text-slate-400"
                      }`}
                    />

                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <p className="px-3 pt-4 text-[11px] text-slate-600">v1.0 • HRMS</p>
    </aside>
  );
}

export default Sidebar;
