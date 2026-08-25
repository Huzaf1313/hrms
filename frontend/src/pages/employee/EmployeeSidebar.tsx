import { useNavigate, useLocation } from "react-router-dom";

interface EmployeeSidebarProps {
  onLogout: () => void;
}

const menuItems = [
  {
    label: "Dashboard",
    icon: "▦",
    path: "/employee/dashboard",
  },
  {
    label: "My Profile",
    icon: "♙",
    path: "/employee/profile",
  },
  {
    label: "Attendance",
    icon: "◷",
    path: "/employee/attendance",
  },
  {
    label: "Leave",
    icon: "▤",
    path: "/employee/leave",
  },
  {
    label: "Payroll",
    icon: "▣",
    path: "/employee/payroll",
  },
  {
    label: "My Documents",
    icon: "▧",
    path: "/employee/documents",
  },
  {
    label: "My Assets",
    icon: "▱",
    path: "/employee/assets",
  },
  {
    label: "Performance",
    icon: "⌁",
    path: "/employee/performance",
  },
  {
    label: "Training",
    icon: "▥",
    path: "/employee/training",
  },
];

function EmployeeSidebar({
  onLogout,
}: EmployeeSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white px-2 py-7">

      {/* Logo */}
      <div className="mb-7 px-4">
        <h1 className="text-2xl font-bold text-[#456b54]">
          Bento HR
        </h1>

        <p className="mt-1 text-sm font-medium tracking-wide text-gray-600">
          Employee Portal
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex h-[50px] shrink-0 items-center gap-3 rounded-xl px-4 text-left font-medium transition ${
                isActive
                  ? "bg-[#5f806b] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span className="w-6 text-center text-[21px]">
                {item.icon}
              </span>

              <span className="text-[15px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* New Request */}
      <button
        type="button"
        className="mt-4 flex h-[50px] shrink-0 items-center justify-center gap-3 rounded-xl bg-[#456b54] text-sm font-semibold text-white transition hover:bg-[#385b46]"
      >
        <span className="text-xl leading-none">+</span>
        New Request
      </button>

      {/* Bottom Links */}
      <div className="mt-6 flex shrink-0 flex-col gap-1">
        <button
          type="button"
          className="flex h-11 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100"
        >
          <span className="w-6 text-center text-lg">?</span>
          Help
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex h-11 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100"
        >
          <span className="w-6 text-center text-lg">↪</span>
          Logout
        </button>
      </div>

    </aside>
  );
}

export default EmployeeSidebar;