import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UserRound,
  CalendarCheck2,
  CalendarDays,
  Wallet,
  FileText,
  Megaphone,
  CircleHelp,
  DoorOpen,
  LogOut,
} from "lucide-react";

interface EmployeeSidebarProps {
  onLogout: () => void;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path?: string;
  matchPrefix?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/employee/dashboard" },
      { label: "My Profile", icon: UserRound, path: "/employee/profile" },
    ],
  },
{
  title: "Attendance",
  items: [
    {
      label: "My Attendance",
      icon: CalendarCheck2,
      path: "/employee/attendance",
      matchPrefix: true,
    },
  ],
},
{
  title: "Leave",
  items: [
    {
      label: "My Leave",
      icon: CalendarDays,
      path: "/employee/leave",
      matchPrefix: true,
    },
  ],
},
{
  title: "Payroll",
  items: [
    {
      label: "My Payslip",
      icon: Wallet,
      path: "/employee/payroll",
      matchPrefix: true,
    },
  ],
},
{
  title: "Documents",
  items: [
    {
      label: "My Documents",
      icon: FileText,
      path: "/employee/documents",
      matchPrefix: true,
    },
  ],
},
{
  title: "Announcements",
  items: [
    {
      label: "Announcements",
      icon: Megaphone,
      path: "/employee/announcements",
      matchPrefix: true,
    },
  ],
},
{
  title: "Help",
  items: [
    {
      label: "Help & Support",
      icon: CircleHelp,
      path: "/employee/help",
      matchPrefix: true,
    },
  ],
},
{
  title: "Exit / Offboarding",
  items: [
    {
      label: "Exit / Offboarding",
      icon: DoorOpen,
      path: "/employee/exit",
      matchPrefix: true,
    },
  ],
},
];

function isItemActive(
  item: NavItem,
  pathname: string,
): boolean {
  if (!item.path) return false;

  return item.matchPrefix
    ? pathname.startsWith(item.path)
    : pathname === item.path;
}

function EmployeeSidebar({
  onLogout,
}: EmployeeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-[#0d1e3e] px-4 py-6">
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate("/employee/dashboard")}
        className="mb-8 flex items-center gap-3 px-2 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]">
          <UserRound className="h-5 w-5 text-white" />
        </span>

        <span>
          <span className="block text-xl font-bold text-white">HRMS</span>
          <span className="block text-xs text-slate-400">Employee Portal</span>
        </span>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `top-${sectionIndex}`} className="mb-5">
            {section.title && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.title}
              </p>
            )}

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item, location.pathname);
                const isDisabled = !item.path;

                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => item.path && navigate(item.path)}
                    className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 py-2 text-left text-[14.5px] transition ${
                      isActive
                        ? "bg-[#2563eb] font-semibold text-white shadow-lg shadow-blue-900/30"
                        : isDisabled
                          ? "cursor-not-allowed text-slate-600"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-[18px] w-[18px] shrink-0 ${
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
        {/* Logout */}
      <div className="shrink-0 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onLogout}
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-slate-300 transition hover:bg-red-500/15 hover:text-red-300"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400" />
          <span>Logout</span>
        </button>
      </div>
      </nav>
    </aside>
  );
}

export default EmployeeSidebar;