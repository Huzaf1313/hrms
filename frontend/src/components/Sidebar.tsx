const menuItems = [
  { label: "Dashboard", icon: "▦" },
  { label: "Employees", icon: "♙" },
  { label: "Payroll", icon: "▣" },
  { label: "Recruitment", icon: "♙" },
  { label: "Performance", icon: "⌁" },
];

function Sidebar() {
  return (
    <aside className="flex h-screen w-[290px] flex-col border-r border-gray-200 bg-white px-4 py-8">
      
      {/* Logo */}
      <div className="mb-10 px-3">
        <h1 className="text-2xl font-bold text-[#456b54]">
          Bento HR
        </h1>

        <p className="mt-1 text-sm font-medium tracking-wide text-gray-600">
          Enterprise Portal
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            className={`flex h-14 items-center gap-4 rounded-xl px-5 text-left font-medium transition ${
              index === 0
                ? "bg-[#5f806b] text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <span className="text-2xl">
              {item.icon}
            </span>

            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* New Request */}
      <button className="mt-auto flex h-14 items-center justify-center gap-3 rounded-xl bg-[#456b54] text-base font-semibold text-white transition hover:bg-[#385b46]">
        <span className="text-2xl">+</span>
        New Request
      </button>

      {/* Bottom Links */}
      <div className="mt-10 flex flex-col gap-2">
        <button className="flex h-12 items-center gap-4 rounded-xl px-5 font-medium text-gray-700 hover:bg-gray-100">
          <span className="text-xl">?</span>
          Help
        </button>

        <button className="flex h-12 items-center gap-4 rounded-xl px-5 font-medium text-gray-700 hover:bg-gray-100">
          <span className="text-xl">↪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;