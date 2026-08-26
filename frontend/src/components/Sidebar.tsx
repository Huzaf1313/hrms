import {
  LayoutDashboard,
  Users,
  Clock3,
  CalendarDays,
  Wallet,
  Briefcase,
  TrendingUp,
  CircleHelp,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout?: () => void; // Added optional onLogout prop just in case you want to use it here later
}

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Employees", icon: Users },
  { label: "Attendance", icon: Clock3 },
  { label: "Leave", icon: CalendarDays },
  { label: "Payroll", icon: Wallet },
  { label: "Recruitment", icon: Briefcase },
  { label: "Performance", icon: TrendingUp },
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white px-2 py-7">
      {/* Logo */}
      <div className="mb-9 px-4">
        <h1 className="text-2xl font-bold text-[#456b54]">HRMS</h1>
        <p className="mt-1 text-sm font-medium tracking-wide text-gray-600">
          Enterprise Portal
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.label;

          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.label)}
              className={`flex h-[54px] items-center gap-3 rounded-xl px-4 text-left font-medium transition ${
                isActive
                  ? "bg-[#5f806b] text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-500"}`}
              />
              <span className="text-[16px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* New Request */}
      {/* <button className="mt-auto flex h-[54px] items-center justify-center gap-2 rounded-xl bg-[#456b54] text-base font-semibold text-white transition hover:bg-[#385b46]">
        <Plus className="h-5 w-5" />
        New Request
      </button> */}

      {/* Bottom Links */}
      <div className="mt-9 flex flex-col gap-1">
        <button className="flex h-12 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100">
          <CircleHelp className="h-5 w-5 text-gray-500" />
          Help
        </button>

      {/* <button 
        onClick={onLogout} 
        className="flex h-12 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100"
      >
        <LogOut className="h-5 w-5 text-gray-500" />
        Logout
      </button> */}
    </div>
  </aside>
  );
}

export default Sidebar;