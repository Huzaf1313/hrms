interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const menuItems = [
  { label: "Dashboard", icon: "▦" },
  { label: "Employees", icon: "♙" },
  { label: "Payroll", icon: "▣" },
  { label: "Recruitment", icon: "♙" },
  { label: "Performance", icon: "⌁" },
];

function Sidebar({
  activePage,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-gray-200 bg-white px-2 py-7">

      {/* Logo */}
      <div className="mb-9 px-4">
        <h1 className="text-2xl font-bold text-[#456b54]">
          Bento HR
        </h1>

        <p className="mt-1 text-sm font-medium tracking-wide text-gray-600">
          Enterprise Portal
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.label)}
            className={`flex h-[54px] items-center gap-3 rounded-xl px-4 text-left font-medium transition ${
              activePage === item.label
                ? "bg-[#5f806b] text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="w-6 text-center text-[22px]">
              {item.icon}
            </span>

            <span className="text-[16px]">
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* New Request */}
      <button className="mt-auto flex h-[54px] items-center justify-center gap-3 rounded-xl bg-[#456b54] text-base font-semibold text-white transition hover:bg-[#385b46]">
        <span className="text-2xl leading-none">+</span>
        New Request
      </button>

      {/* Bottom Links */}
      <div className="mt-9 flex flex-col gap-1">
        <button className="flex h-12 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100">
          <span className="w-6 text-center text-xl">?</span>
          Help
        </button>

        <button className="flex h-12 items-center gap-3 rounded-xl px-4 font-medium text-gray-700 hover:bg-gray-100">
          <span className="w-6 text-center text-xl">↪</span>
          Logout
        </button>
      </div>

    </aside>
  );
}

export default Sidebar;