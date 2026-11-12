import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import EmployeeSidebar from "../pages/employee/EmployeeSidebar";
import EmployeeNotificationDropdown from "../components/employee/EmployeeNotificationDropdown";
import ErrorBoundary from "../components/ErrorBoundary";
import DatePicker from "../components/DatePicker";
import { employeeNotificationService } from "../services/employeeNotificationService";
import { employeeService } from "../services/employeeService";

const pageTitles: Record<string, string> = {
  "/employee/dashboard": "Dashboard",
  "/employee/profile": "My Profile",
  "/employee/attendance": "My Attendance",
  "/employee/leave": "My Leave",
  "/employee/payroll": "My Payslip",
  "/employee/documents": "My Documents",
  "/employee/announcements": "Announcements",
  "/employee/help": "Help & Support",
  "/employee/exit": "Exit / Offboarding",
  "/employee/exit/resignation": "Resignation Request",
};

function readUser() {
  try {
    const raw = localStorage.getItem("user");

    return raw
      ? (JSON.parse(raw) as {
          full_name?: string;
          employee_id?: string | null;
        })
      : null;
  } catch {
    return null;
  }
}

function EmployeeLayout({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setShowProfileMenu(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const notificationContainerRef = useRef<HTMLDivElement | null>(null);

  const user = useMemo(() => readUser(), []);

  useEffect(() => {
    const fetchUnreadNotificationCount = async () => {
      try {
        const count =
          await employeeNotificationService.getUnreadCount();

        setUnreadNotificationCount(count);
      } catch (error) {
        console.error(
          "Failed to fetch notification count:",
          error,
        );
      }
    };

    fetchUnreadNotificationCount();

    const interval = window.setInterval(
      fetchUnreadNotificationCount,
      30000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setAvatarUrl(null);

    const loadEmployeeHeader = async () => {
      try {
        const profile = await employeeService.getMyProfile();

        if (cancelled) return;

        setDesignation(profile.designation ?? "");

        try {
          // Fetch the actual uploaded profile photo using authentication.
          const photoBlob = await employeeService.getProfilePhoto(
            profile.id,
          );

          const newObjectUrl = URL.createObjectURL(photoBlob);

          if (cancelled) {
            URL.revokeObjectURL(newObjectUrl);
            return;
          }

          objectUrl = newObjectUrl;
          setAvatarUrl(newObjectUrl);
        } catch (error) {
          if (!cancelled) {
            setAvatarUrl(null);
            console.error(
              "Failed to load employee header photo:",
              error,
            );
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load employee header profile:",
            error,
          );
        }
      }
    };

    void loadEmployeeHeader();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [location.pathname, avatarRefreshKey]);

useEffect(() => {
  const handleProfilePhotoUpdate = () => {
    setAvatarRefreshKey((previous) => previous + 1);
  };

  window.addEventListener(
    "employee-profile-photo-updated",
    handleProfilePhotoUpdate,
  );

  return () => {
    window.removeEventListener(
      "employee-profile-photo-updated",
      handleProfilePhotoUpdate,
    );
  };
}, []);

  useEffect(() => {
    if (!showNotificationDropdown) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(target)
      ) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showNotificationDropdown]);

  useEffect(() => {
    setShowProfileMenu(false);
    setShowNotificationDropdown(false);
    setSidebarOpen(false);
  }, [location.pathname]);

  const fullName = user?.full_name ?? "Employee";

  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pageTitle = pageTitles[location.pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <EmployeeSidebar
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-w-0 lg:ml-[250px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-4 border-b border-gray-200 bg-white px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((previous) => !previous)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition hover:bg-gray-100 lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            <p className="truncate text-sm font-semibold text-gray-900">
              {pageTitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div
              ref={notificationContainerRef}
              className="relative"
            >
              <button
                type="button"
                onClick={() =>
                  setShowNotificationDropdown(
                    (previous) => !previous,
                  )
                }
                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition ${
                  showNotificationDropdown
                    ? "bg-blue-50 text-blue-600"
                    : "hover:bg-gray-100"
                }`}
                aria-label="Notifications"
                aria-expanded={showNotificationDropdown}
              >
                <Bell className="h-5 w-5" />

                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {showNotificationDropdown && (
                <EmployeeNotificationDropdown
                  onClose={() =>
                    setShowNotificationDropdown(false)
                  }
                  onUnreadCountChange={
                    setUnreadNotificationCount
                  }
                />
              )}
            </div>

            <DatePicker />

            {/* Profile */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() =>
                  setShowProfileMenu((previous) => !previous)
                }
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100"
              >
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2563eb] text-xs font-bold text-white">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>

                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-gray-900">
                    {fullName}
                  </span>

                  <span className="block text-[11px] leading-tight text-gray-500">
                    {designation || "Employee"}
                  </span>
                </span>

                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate("/employee/profile");
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    My Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="mr-2 inline h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scoped so a crash in one employee page leaves the header and
            sidebar usable. */}
        <ErrorBoundary label={pageTitle}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default EmployeeLayout;
