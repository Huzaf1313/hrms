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
  PanelLeftClose,
  Package,
} from "lucide-react";

interface EmployeeSidebarProps {
  onLogout: () => void;
  /** Mobile drawer state. Desktop ignores this. */
  open?: boolean;
  onClose?: () => void;
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
{
  title: "Assets",
  items: [
    {
      label: "My Assets",
      icon: Package,
      path: "/employee/assets",
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
  open,
  onClose,
}: EmployeeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col bg-[#0d1e3e] px-4 py-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <button
        type="button"
        onClick={() => navigate("/employee/dashboard")}
        className="mb-5 flex items-center gap-3 px-2 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]">
          <UserRound className="h-5 w-5 text-white" />
        </span>

        <span>
          <span className="brand-wordmark block text-xl font-bold text-white">HRMS</span>
        </span>
      </button>

      {/* Navigation */}
      <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `top-${sectionIndex}`} className="mb-3">
            {section.title && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
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
                    onClick={() => {
                      if (item.path) navigate(item.path);
                      onClose?.();
                    }}
                    className={`flex min-h-9 items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm transition ${
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
      <button
        type="button"
        onClick={onClose}
        className="flex items-center gap-3 px-3 py-3 text-left text-[12px] text-slate-400 transition hover:text-white lg:hidden"
      >
        <PanelLeftClose className="h-4 w-4" />
        Close Menu
      </button>
      </div>
      </nav>
    </aside>
    </>
  );
}

export default EmployeeSidebar;