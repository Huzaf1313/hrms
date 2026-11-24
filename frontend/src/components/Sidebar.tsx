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
    title: "Main",
    items: [{ label: "Dashboard", icon: LayoutGrid, page: "Dashboard" }],
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
    title: "Super Admin",
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
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Admin Navigation"
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col border-r border-[#E4E6E1] bg-white transition-[width,transform] duration-200 ease-in-out lg:static lg:translate-x-0 ${open ? "translate-x-0 shadow-lg" : "-translate-x-full"
          } ${collapsed ? "w-[68px]" : "w-[240px]"}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 py-4 border-b border-[#E4E6E1] shrink-0">
          <button
            type="button"
            onClick={() => go("Dashboard")}
            className="flex items-center gap-2.5 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] rounded"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#2F5FD0] text-white font-bold text-sm tracking-tight">
              PS
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block text-[15px] font-semibold tracking-tight text-[#1F2933] leading-tight">
                  People<span className="text-[#2F5FD0]">Sync</span>
                </span>
                <span className="block text-xs text-[#7B8794] truncate">
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
              className="p-1 rounded text-[#7B8794] hover:text-[#1F2933] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
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
                  <p className="mt-4 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#7B8794]">
                    {section.title}
                  </p>
                ) : (
                  <div className="my-1.5 h-px bg-[#E4E6E1]" aria-hidden="true" />
                )}

                <div className="flex flex-col gap-1">
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
                        className={`group flex min-h-[36px] h-9 w-full items-center rounded-[6px] text-[13px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] cursor-pointer ${collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
                          } ${isActive
                            ? "bg-[#E8EEFB] text-[#2F5FD0] font-medium"
                            : isDisabled
                              ? "cursor-not-allowed text-[#7B8794]/60"
                              : "font-normal text-[#52606D] hover:bg-[#F0F1EE] hover:text-[#1F2933]"
                          }`}
                      >
                        <Icon
                          className={`w-4 h-4 stroke-[1.75] shrink-0 transition-colors ${isActive
                            ? "text-[#2F5FD0]"
                            : "text-[#52606D] group-hover:text-[#1F2933]"
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
