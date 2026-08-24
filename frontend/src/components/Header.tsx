import { Bell, LogOut } from "lucide-react";

// Made the User interface more flexible to handle different backend responses
interface User {
  first_name?: string;
  last_name?: string;
  name?: string;
  full_name?: string;
  username?: string;
  email?: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

function Header({ user, onLogout }: HeaderProps) {
  // 1. Dynamic Greeting
  const currentHour = new Date().getHours();
  let greeting = "Good Morning";
  if (currentHour >= 12 && currentHour < 18) {
    greeting = "Good Afternoon";
  } else if (currentHour >= 18) {
    greeting = "Good Evening";
  }

  // 2. Safely extract the user's first name
  const getUserName = () => {
    if (!user) return "User";
    
    // Check all common places where the name might be stored
    if (user.first_name) return user.first_name;
    if (user.full_name) return user.full_name.split(" ")[0];
    if (user.name) return user.name.split(" ")[0];
    if (user.username) return user.username;
    
    // If only email is available, extract the name part before the @
    if (user.email) {
      const emailName = user.email.split("@")[0];
      // Capitalize the first letter (e.g., "abrar" -> "Abrar")
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    return "User"; // Absolute fallback
  };

  // 3. Generate initials
  const getUserInitials = () => {
    if (!user) return "U";
    
    let nameToUse = "";
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.full_name) nameToUse = user.full_name;
    else if (user.name) nameToUse = user.name;
    else if (user.username) nameToUse = user.username;
    else if (user.email) nameToUse = user.email.split("@")[0];
    else return "U";

    const parts = nameToUse.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return nameToUse.substring(0, 2).toUpperCase();
  };

  const userName = getUserName();
  const initials = getUserInitials();

  return (
    <header className="flex items-center justify-between px-10 py-7">
      {/* Greeting */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-[#171b1d]">
          {greeting}, {userName}
        </h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-6">
        {/* Notification */}
        <button
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6" />
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#99543f]" />
        </button>

        {/* Profile */}
        <button
          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#dce5df] transition-colors hover:opacity-80"
          aria-label="Profile"
        >
          <span className="text-sm font-semibold text-[#456b54]">
            {initials}
          </span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </header>
  );
}

export default Header;