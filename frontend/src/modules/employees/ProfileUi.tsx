import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Camera, Eye, X } from "lucide-react";

import { PROFILE_TABS } from "./adminProfileTypes";
import { PROFILE_PANEL_CLASS } from "./profileFields";
import type { ProfileTab } from "./adminProfileTypes";

/**
 * Presentational building blocks for the admin profile page. Every export here
 * is a component so React Fast Refresh can swap the module without a reload.
 */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/* ------------------------------------------------------------------ avatar */

export function ProfileAvatar({
  name,
  avatarUrl,
  onPickPhoto,
  onRemove,
}: {
  name: string;
  avatarUrl: string | null;
  onPickPhoto: (file: File) => void;
  onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) onPickPhoto(file);
  }

  return (
    <div className="relative shrink-0">
      {avatarUrl ? (
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          title="View profile photo"
          aria-label="View profile photo"
          className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-bold text-white ring-4 ring-blue-50"
        >
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
            <Eye className="h-5 w-5" />
          </span>
        </button>
      ) : (
        <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-bold text-white ring-4 ring-blue-50">
          {initialsOf(name)}
        </span>
      )}

      {previewOpen && avatarUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} profile photo`}
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-[2px] bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close photo preview"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-hidden rounded-[2px] bg-gray-100">
              <img
                src={avatarUrl}
                alt={name}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <label
        htmlFor="profile-photo"
        className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#2563eb] text-white shadow-sm transition hover:bg-[#1d4ed8]"
        title="Change profile photo"
      >
        <Camera className="icon-on-primary h-4 w-4" />

        <input
          id="profile-photo"
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className="hidden"
          onChange={handleChange}
        />
      </label>

      {avatarUrl && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-red-500 text-white shadow-sm transition hover:bg-red-600"
          title="Remove profile photo"
          aria-label="Remove profile photo"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- tabs */

export function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <div className="scrollbar-hidden overflow-x-auto overflow-y-hidden max-w-full border-b border-gray-200">
      <div className="flex min-w-max items-center gap-6">
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            aria-current={active === tab ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition ${
              active === tab
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ panels */

export function ProfileSection({
  id,
  icon,
  title,
  action,
  children,
  bodyClassName = "p-5",
  headerClassName = "px-5 py-4",
}: {
  /** Lets a quick action scroll straight to this panel. */
  id?: string;
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  /** Lets a panel tighten the gap between its heading and its content. */
  headerClassName?: string;
}) {
  return (
    <section id={id} className={`${PROFILE_PANEL_CLASS} flex min-w-0 flex-col`}>
      <header className={`flex flex-wrap items-center justify-between gap-3 ${headerClassName}`}>
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              {icon}
            </span>
          )}

          <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        </div>

        {action}
      </header>

      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Label above value, in a responsive multi-column grid. */
export function InfoGrid({
  items,
  columns = "sm:grid-cols-2 xl:grid-cols-3",
}: {
  items: { label: string; value: ReactNode }[];
  columns?: string;
}) {
  return (
    <div className={`grid gap-x-6 gap-y-5 ${columns}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            {item.label}
          </p>

          <div className="mt-1 text-sm font-semibold text-gray-800">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Tinted sub-card holding label/value rows, e.g. Address. */
export function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2px] border border-blue-100 bg-blue-50/40 p-4">
      <h4 className="mb-3 text-sm font-bold text-gray-900">{title}</h4>

      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
       <span className="shrink-0 text-xs text-gray-600">{label}</span>

      <span className="min-w-0 break-words text-right text-xs font-semibold text-gray-800">
        {value || "—"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ badges */

export function StatusPill({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------ quick actions */

export function QuickActionRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-gray-100 px-5 py-3.5 text-left transition last:border-b-0 hover:bg-gray-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block truncate text-xs text-gray-500">{description}</span>
      </span>
    </button>
  );
}
