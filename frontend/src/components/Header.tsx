interface HeaderProps {
  onLogout: () => void;
}

function Header({ onLogout }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-10 py-7">
      {/* Greeting */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-[#171b1d]">
          Good Morning, Sarah
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        {/* Notification */}
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Notifications"
        >
          <span className="text-2xl text-gray-700">♧</span>

          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#99543f]" />
        </button>

        {/* Profile */}
        <button
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#dce5df]"
          aria-label="Profile"
        >
          <span className="text-sm font-semibold text-[#456b54]">
            S
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Log out
        </button>
      </div>
    </header>
  );
}

export default Header;