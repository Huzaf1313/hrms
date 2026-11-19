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
  PanelLeftClose,
  Package,
} from "lucide-react";

interface EmployeeSidebarProps {
  onLogout?: () => void;
  /** Mobile drawer state. Desktop ignores this. */
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
    title: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutGrid, path: "/employee/dashboard" },
      { label: "My Profile", icon: UserRound, path: "/employee/profile" },
    ],
  },
  {
    title: "ATTENDANCE",
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
    title: "FINANCE & ASSETS",
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
    title: "COMPANY",
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

function isItemActive(item: NavItem, pathname: string): boolean {
  if (!item.path) return false;

  return item.matchPrefix
    ? pathname.startsWith(item.path)
    : pathname === item.path;
}

function EmployeeSidebar({
  onLogout: _onLogout,
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
      {/* Tap-to-dismiss backdrop, mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col overflow-hidden bg-[#09142e] px-4 py-5 transition-[width,transform] duration-300 ease-in-out lg:static lg:h-full lg:z-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "w-[80px]" : "w-[260px]"}`}
      >
        {/* Brand Header */}
        <button
          type="button"
          onClick={() => go("/employee/dashboard")}
          title={collapsed ? "PeopleSync" : undefined}
          className={`mb-6 flex items-center text-left transition-all duration-200 ${collapsed ? "justify-center p-0" : "gap-3 px-1 py-1"
            }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md shadow-black/30">
            <img
              src="/peoplesync-logo.png"
              alt="PeopleSync"
              className="h-full w-full object-contain"
            />
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <span className="brand-wordmark block text-xl font-extrabold tracking-tight text-white leading-tight font-manrope">
                People<span className="text-[#3884ff]">Sync</span>
              </span>
              <span className="block text-[10px] font-normal text-slate-400 tracking-tight leading-tight mt-0.5 truncate">
                Employee Portal · Simplifying Work.
              </span>
            </div>
          )}
        </button>

        {/* Navigation Section */}
        <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              {!collapsed ? (
                <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400/70">
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
                  const isActive = isItemActive(item, location.pathname);
                  const isDisabled = !item.path;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => go(item.path)}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={`flex h-10 w-full shrink-0 items-center rounded-xl text-left transition-all duration-150 ${collapsed ? "justify-center px-0" : "gap-3 px-3.5"
                        } text-sm ${isActive
                          ? "bg-[#0066ff] font-semibold text-white shadow-lg shadow-blue-600/30"
                          : isDisabled
                            ? "cursor-not-allowed text-slate-600"
                            : "font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white"
                        }`}
                    >
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 ${isActive
                          ? "text-white"
                          : isDisabled
                            ? "text-slate-600"
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

        {/* Bottom Section */}
        <div className="mt-auto pt-3 shrink-0">
          {!collapsed && (
            <div className="mb-3">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#122452] via-[#142a66] to-[#1c3e8e] p-4 text-white shadow-lg border border-white/10">
                <div className="relative z-10 max-w-[110px]">
                  <p className="text-sm font-extrabold leading-tight tracking-tight text-white font-manrope">
                    Together
                    <br />
                    We Grow
                  </p>
                </div>

                {/* Team silhouette with warm orange & blue swoosh */}
                <div className="pointer-events-none absolute -bottom-1 -right-1 h-20 w-28 opacity-90">
                  <svg
                    viewBox="0 0 120 80"
                    fill="none"
                    className="h-full w-full"
                  >
                    <circle
                      cx="85"
                      cy="35"
                      r="10"
                      fill="#3b82f6"
                      fillOpacity="0.8"
                    />
                    <path
                      d="M68 65 C68 50, 102 50, 102 65 Z"
                      fill="#3b82f6"
                      fillOpacity="0.8"
                    />
                    <circle
                      cx="62"
                      cy="42"
                      r="8"
                      fill="#60a5fa"
                      fillOpacity="0.7"
                    />
                    <path
                      d="M48 68 C48 56, 76 56, 76 68 Z"
                      fill="#60a5fa"
                      fillOpacity="0.7"
                    />
                    <circle
                      cx="102"
                      cy="44"
                      r="7"
                      fill="#60a5fa"
                      fillOpacity="0.6"
                    />
                    <path
                      d="M90 68 C90 58, 114 58, 114 68 Z"
                      fill="#60a5fa"
                      fillOpacity="0.6"
                    />
                    <path
                      d="M10 75 Q60 55 120 70"
                      stroke="#f97316"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 78 Q70 62 120 74"
                      stroke="#ffedd5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Close Button */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => onClose?.()}
            className="mt-2 flex items-center gap-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white lg:hidden"
          >
            <PanelLeftClose className="h-4 w-4" />
            Close Menu
          </button>
        )}
      </aside>
    </>
  );
}

export default EmployeeSidebar;