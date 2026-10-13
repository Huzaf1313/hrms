import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  /*Building2,*/
  CalendarCheck,
  CalendarDays,
  Wallet,
  Megaphone,
  Package,
  Settings,
  Briefcase,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void; // Added optional onLogout prop just in case you want to use it here later
  collapsed: boolean;
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
      { label: "Recruitment", icon: Briefcase, page: "Recruitment" },
      /*{ label: "Departments", icon: Building2 },*/
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
      { label: "Assets", icon: Package, page: "Assets" },
      { label: "Announcement", icon: Megaphone, page: "Announcement" },
      { label: "Settings", icon: Settings, page: "Settings" },
    ],
  },
];

function Sidebar({ activePage, onNavigate, collapsed }: SidebarProps) {
  const navigate = useNavigate();

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden bg-[#0d1e3e] px-4 py-6 transition-[width] duration-300 ease-in-out ${collapsed ? "w-[76px]" : "w-[250px]"
        }`}
    >
      {/* Logo */}
      <button
        type="button"
        onClick={() => {
          onNavigate("Dashboard");
          navigate("/dashboard");
        }}
        title={collapsed ? "HRMS" : undefined}
        className={`mb-8 flex items-center rounded-xl text-left transition-[justify-content] duration-300 ${collapsed ? "h-10 w-10 shrink-0 justify-center p-0" : "gap-3 px-2"
          }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] ${collapsed ? "mx-auto" : ""
            }`}
        >
          <Users className="h-5 w-5 text-white" />
        </span>

        {!collapsed && (
          <span>
            <span className="block text-xl font-bold text-white">HRMS</span>
            <span className="block text-xs text-slate-400">Admin Portal</span>
          </span>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            {!collapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.title}
              </p>
            ) : (
              <div
                className="mx-auto mb-2 h-px w-8 bg-white/10"
                aria-hidden="true"
              />
            )}

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
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`flex h-[46px] shrink-0 items-center rounded-xl text-left transition-[justify-content,padding,color,background-color] duration-300 ${collapsed ? "w-full justify-center px-0" : "gap-3 px-3"
                      } text-[15px] ${isActive
                        ? "bg-[#2563eb] font-semibold text-white shadow-lg shadow-blue-900/30"
                        : isDisabled
                          ? "cursor-not-allowed text-slate-600"
                          : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                  >
                    <Icon
                      className={`h-5 w-5 shrink-0 ${isActive
                        ? "text-white"
                        : isDisabled
                          ? "text-slate-700"
                          : "text-slate-400"
                        }`}
                    />

                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <p className="px-3 pt-4 text-[11px] text-slate-600">v1.0 • HRMS</p>
      )}
    </aside>
  );
}

export default Sidebar;
