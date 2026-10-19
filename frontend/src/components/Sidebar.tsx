import {
  Briefcase,
  CalendarCheck,
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Settings,
  Users,
  Wallet,
  PanelLeftClose,
} from "lucide-react";

import { canAccessPage } from "../lib/access";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void; // Added optional onLogout prop just in case you want to use it here later
  collapsed: boolean;
  /** Mobile drawer state. Desktop ignores this and uses `collapsed`. */
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  page?: string;
  /** Pages only HR may open. Hidden from a manager's menu. */
  hrOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Only sections this project actually has a page for. The reference design
// showed more (Departments, Shifts, Holidays, Reports); those stay out rather
// than becoming dead links.
const sections: NavSection[] = [
  {
    title: "Main",
    items: [{ label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" }],
  },
  {
    title: "Organization",
    items: [
      { label: "Employees", icon: Users, page: "Employees" },
      {
        label: "Recruitment",
        icon: Briefcase,
        page: "Recruitment",
        hrOnly: true,
      },
      /*{ label: "Departments", icon: Building2 },*/
    ],
  },
  {
    title: "Attendance",
    items: [
      { label: "Daily Attendance", icon: CalendarCheck, page: "Attendance" },
      { label: "Leave", icon: CalendarDays, page: "Leave" },
    ],
  },
  {
    title: "Management",
    items: [
      {
        label: "Payroll",
        icon: Wallet,
        page: "Payroll",
        hrOnly: true,
      },
      { label: "Assets", icon: Package, page: "Assets" },
      { label: "Announcement", icon: Megaphone, page: "Announcement" },
      {
        label: "Exit Requests",
        icon: DoorOpen,
        page: "Exit Requests",
        hrOnly: true,
      },
      { label: "Support Tickets", icon: LifeBuoy, page: "Support Tickets" },
      { label: "Settings", icon: Settings, page: "Settings" },
    ],
  },
];

function Sidebar({ activePage, onNavigate, collapsed, open, onClose }: SidebarProps) {

  function go(page: string) {
    onNavigate(page);
    onClose?.();
  }

  return (
    <>
      {/* Tap-to-dismiss backdrop, mobile only. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col overflow-hidden bg-[#0d1e3e] px-4 py-4 transition-[width,transform] duration-300 ease-in-out lg:sticky lg:top-0 lg:z-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-[76px]" : "w-[250px]"}`}
      >
      {/* Logo */}
      <button
        type="button"
        onClick={() => go("Dashboard")}
        title={collapsed ? "HRMS" : undefined}
        className={`mb-5 flex items-center rounded-xl text-left transition-[justify-content] duration-300 ${collapsed ? "h-10 w-10 shrink-0 justify-center p-0" : "gap-3 px-2"
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
            <span className="brand-wordmark block text-xl font-bold text-white">HRMS</span>
            <span className="block text-xs text-slate-400">Admin Portal</span>
          </span>
        )}
      </button>

      {/* Navigation */}
      <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto">
        {sections.map((section) => {
          const items = section.items.filter(
            (item) => !item.hrOnly || canAccessPage(item.page ?? ""),
          );

          if (items.length === 0) return null;

          return (
          <div key={section.title} className="mb-3">
            {!collapsed ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {section.title}
              </p>
            ) : (
              <div
                className="mx-auto mb-2 h-px w-8 bg-white/10"
                aria-hidden="true"
              />
            )}

            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = Boolean(item.page) && activePage === item.page;
                const isDisabled = !item.page;

                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!item.page) return;
                        go(item.page);
                      }}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={`flex h-9 w-full shrink-0 items-center rounded-xl text-left transition-[justify-content,padding,color,background-color] duration-300 ${collapsed ? "justify-center px-0" : "gap-3 px-3"
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
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <button
          type="button"
          onClick={() => onClose?.()}
          className="flex items-center gap-3 px-3 pt-4 text-left text-[12px] text-slate-400 transition hover:text-white lg:hidden"
        >
          <PanelLeftClose className="h-4 w-4" />
          Close Menu
        </button>
      )}
    </aside>
    </>
  );
}

export default Sidebar;