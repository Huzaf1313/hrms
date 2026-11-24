import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  UserRound,
  CalendarCheck,
  CalendarDays,
  Wallet,
  FileText,
  Megaphone,
  LifeBuoy,
  DoorOpen,
  Package,
  X,
} from "lucide-react";

interface EmployeeSidebarProps {
  onLogout?: () => void;
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
}

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  matchPrefix?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", icon: LayoutGrid, path: "/employee/dashboard" },
      { label: "My Profile", icon: UserRound, path: "/employee/profile" },
    ],
  },
  {
    title: "Attendance",
    items: [
      {
        label: "My Attendance",
        icon: CalendarCheck,
        path: "/employee/attendance",
        matchPrefix: true,
      },
      {
        label: "My Leave",
        icon: CalendarDays,
        path: "/employee/leave",
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Finance & Assets",
    items: [
      {
        label: "My Payslip",
        icon: Wallet,
        path: "/employee/payroll",
        matchPrefix: true,
      },
      {
        label: "My Assets",
        icon: Package,
        path: "/employee/assets",
        matchPrefix: true,
      },
      {
        label: "My Documents",
        icon: FileText,
        path: "/employee/documents",
        matchPrefix: true,
      },
    ],
  },
  {
    title: "Company",
    items: [
      {
        label: "Announcements",
        icon: Megaphone,
        path: "/employee/announcements",
        matchPrefix: true,
      },
      {
        label: "Help & Support",
        icon: LifeBuoy,
        path: "/employee/help",
        matchPrefix: true,
      },
      {
        label: "Exit / Offboarding",
        icon: DoorOpen,
        path: "/employee/exit",
        matchPrefix: true,
      },
    ],
  },
];

function isItemActive(item: NavItem, currentPath: string): boolean {
  if (!item.path) return false;
  if (item.path === currentPath) return true;
  if (item.matchPrefix && currentPath.startsWith(item.path)) {
    return true;
  }
  return false;
}

export function EmployeeSidebar({
  open = false,
  onClose,
  collapsed = false,
}: EmployeeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function go(path?: string) {
    if (!path) return;
    navigate(path);
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
        aria-label="Employee Navigation"
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-full shrink-0 flex-col border-r border-[#E4E6E1] bg-white transition-[width,transform] duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0 shadow-lg" : "-translate-x-full"
        } ${collapsed ? "w-[68px]" : "w-[240px]"}`}
      >
        {/* Brand Header */}
        <div className="flex h-[60px] items-center justify-between px-4 border-b border-[#E4E6E1] shrink-0">
          <button
            type="button"
            onClick={() => go("/employee/dashboard")}
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
                <span className="block text-[11px] text-[#7B8794] truncate">
                  Employee Portal
                </span>
              </div>
            )}
          </button>

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
          {sections.map((section) => (
            <div key={section.title} className="space-y-0.5">
              {!collapsed ? (
                <p className="px-3 py-1 text-[12px] font-medium text-[#7B8794]">
                  {section.title}
                </p>
              ) : (
                <div className="my-1.5 h-px bg-[#E4E6E1]" aria-hidden="true" />
              )}

              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item, location.pathname);

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => go(item.path)}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex h-10 w-full items-center rounded-[6px] text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] cursor-pointer ${
                        collapsed ? "justify-center px-0" : "gap-3 px-3"
                      } ${
                        isActive
                          ? "bg-[#E8EEFB] text-[#2F5FD0] font-medium"
                          : "font-normal text-[#52606D] hover:bg-[#F0F1EE] hover:text-[#1F2933]"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 stroke-[1.75] shrink-0 transition-colors ${
                          isActive
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
          ))}
        </nav>
      </aside>
    </>
  );
}

export default EmployeeSidebar;
