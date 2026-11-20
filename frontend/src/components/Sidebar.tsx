import React from "react";
import {
  Briefcase,
  CalendarCheck,
  CalendarDays,
  DoorOpen,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Package,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { canAccessPage } from "../lib/access";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void;
  collapsed: boolean;
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  page?: string;
  hrOnly?: boolean;
  superAdminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "MAIN",
    items: [{ label: "Dashboard", icon: LayoutGrid, page: "Dashboard" }],
  },
  {
    title: "ORGANIZATION",
    items: [
      { label: "Employees", icon: Users, page: "Employees" },
      {
        label: "Recruitment",
        icon: Briefcase,
        page: "Recruitment",
        hrOnly: true,
      },
    ],
  },
  {
    title: "ATTENDANCE",
    items: [
      { label: "Attendance", icon: CalendarCheck, page: "Attendance" },
      { label: "Leave", icon: CalendarDays, page: "Leave" },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      {
        label: "Payroll",
        icon: Wallet,
        page: "Payroll",
        hrOnly: true,
      },
      { label: "Assets", icon: Package, page: "Assets" },
      { label: "Announcement", icon: Megaphone, page: "Announcement" },
      { label: "Support Tickets", icon: LifeBuoy, page: "Support Tickets" },
      {
        label: "Exit Requests",
        icon: DoorOpen,
        page: "Exit Requests",
        hrOnly: true,
      },
      { label: "Settings", icon: Settings, page: "Settings" },
    ],
  },
  {
    title: "SUPER ADMIN",
    items: [
      {
        label: "Admin Accounts",
        icon: ShieldCheck,
        page: "Admin Accounts",
        superAdminOnly: true,
      },
    ],
  },
];

export function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  open = false,
  onClose,
}: SidebarProps) {
  function go(page: string) {
    onNavigate(page);
    onClose?.();
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Admin Navigation"
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col border-r border-slate-800 bg-[#0f172a] transition-[width,transform] duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-16" : "w-60"}`}
      >
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => go("Dashboard")}
            className="flex items-center gap-2.5 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-sm">
              PS
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block text-sm font-semibold tracking-tight text-white leading-tight">
                  People<span className="text-blue-400">Sync</span>
                </span>
                <span className="block text-[10px] text-slate-400 truncate">
                  Enterprise HRMS
                </span>
              </div>
            )}
          </button>

          {/* Close button for mobile */}
          {open && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {sections.map((section) => {
            const items = section.items.filter(
              (item) =>
                (!item.hrOnly && !item.superAdminOnly) ||
                canAccessPage(item.page ?? ""),
            );

            if (items.length === 0) return null;

            return (
              <div key={section.title} className="space-y-0.5">
                {!collapsed ? (
                  <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </p>
                ) : (
                  <div className="my-1.5 h-px bg-slate-800" aria-hidden="true" />
                )}

                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = Boolean(item.page) && activePage === item.page;
                    const isDisabled = !item.page;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => item.page && go(item.page)}
                        title={collapsed ? item.label : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        aria-current={isActive ? "page" : undefined}
                        className={`group flex h-9 w-full items-center rounded-md text-[13px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 cursor-pointer ${
                          collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
                        } ${
                          isActive
                            ? "bg-slate-800 text-white font-medium"
                            : isDisabled
                            ? "cursor-not-allowed text-slate-600"
                            : "font-normal text-slate-300 hover:bg-slate-800/60 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] stroke-[1.75] shrink-0 transition-colors ${
                            isActive
                              ? "text-blue-400"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
