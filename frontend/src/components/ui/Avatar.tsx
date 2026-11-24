import React from "react";

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

// Deterministic pastel color mapping based on initial letters
const bgPalette = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-teal-100 text-teal-800 border-teal-200",
  "bg-indigo-100 text-indigo-800 border-indigo-200",
  "bg-slate-200 text-slate-800 border-slate-300",
];

function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPaletteClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % bgPalette.length;
  return bgPalette[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = "md",
  className = "",
}) => {
  const [imageError, setImageError] = React.useState(false);
  const initials = getInitials(name);
  const colorClass = getPaletteClass(name || "Employee");

  if (src && !imageError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImageError(true)}
        className={`rounded-full object-cover border border-slate-200 shrink-0 ${sizeStyles[size]} ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`rounded-full flex items-center justify-center font-medium border shrink-0 select-none ${colorClass} ${sizeStyles[size]} ${className}`}
    >
      {initials || "E"}
    </div>
  );
};
