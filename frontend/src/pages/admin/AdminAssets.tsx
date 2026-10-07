import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  HandCoins,
  Laptop,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_ICONS,
  ASSET_DEPARTMENTS,
  ASSET_EMPLOYEES,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_ORDER,
  assetCategoryPlaceholders,
  assetPlaceholders,
  assetReturnRequests,
  initialsForAsset,
  recentAssetRequests,
  type Asset,
  type AssetRequestStatus,
  type AssetStatus,
} from "../../components/admin/assetData";

const PANEL_CLASS = "rounded-3xl bg-white p-6 shadow-sm";

// KPI cards are narrow, so they clip instead of letting the big number
// overflow into the neighbouring card.
const KPI_CARD_CLASS = "min-w-0 overflow-hidden rounded-3xl bg-white p-5 shadow-sm";

const FILTER_CONTROL_CLASS =
  "h-10 w-full appearance-none rounded-full border border-gray-200 bg-white px-4 pr-9 text-sm " +
  "text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none " +
  "focus:ring-2 focus:ring-[#2563eb]/10";

const assetStatusStyles: Record<AssetStatus, string> = {
  in_use: "bg-emerald-50 text-emerald-600",
  available: "bg-blue-50 text-blue-600",
  pending_return: "bg-orange-50 text-orange-500",
  maintenance: "bg-violet-50 text-violet-600",
};

const requestStatusStyles: Record<AssetRequestStatus, string> = {
  pending: "bg-orange-50 text-orange-500",
  approved: "bg-emerald-50 text-emerald-600",
  rejected: "bg-rose-50 text-rose-600",
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${assetStatusStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: AssetRequestStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${requestStatusStyles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#4338ca]">
      {initialsForAsset(name)}
    </span>
  );
}

function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h3 className="shrink-0 text-[15px] font-bold text-gray-900">{title}</h3>
      {action}
    </div>
  );
}

function ViewAllLink({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#2563eb] hover:underline"
    >
      View All &rarr;
    </button>
  );
}

/** Page numbers to render around the current page, with ellipsis for the rest. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.min(Math.max(page - 1, 1), pageCount - 4);
  const pages = Array.from({ length: 5 }, (_, index) => start + index);

  return [
    ...(start > 1 ? [1, "gap" as const] : []),
    ...pages,
    ...(start + 4 < pageCount ? ["gap" as const, pageCount] : []),
  ];
}

function Pagination({
  page,
  pageCount,
  onPageChange,
  summary,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  summary: string;
}) {
  if (pageCount <= 1) {
    return <p className="mt-5 text-sm text-gray-500">{summary}</p>;
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-gray-500">{summary}</p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-sm text-gray-400">
              &hellip;
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition ${
                entry === page
                  ? "border-[#2563eb] bg-[#2563eb] text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => onPageChange(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Overview                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 7;

function AssetOverview() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return assetPlaceholders.filter((asset) => {
      if (categoryFilter && asset.category !== categoryFilter) {
        return false;
      }

      if (statusFilter && asset.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        asset.id.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query) ||
        asset.brandModel.toLowerCase().includes(query) ||
        (asset.assignedToName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [search, categoryFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleAssets = filteredAssets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const firstRow = filteredAssets.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * PAGE_SIZE, filteredAssets.length);

  /** Anchored to the viewport so the scroll container cannot clip it. */
  function toggleMenu(id: string, trigger: HTMLButtonElement) {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 160;

    setMenu({
      id,
      top: rect.bottom + 4,
      left: Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 16),
    });
  }

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
      setMenu(null);
    };
  }

  return (
    // No `self-start` here: the parent is a column flex container, so it would
    // size the card to its content and let the table spill past the column.
    <div className={`${PANEL_CLASS} min-w-0 flex-1`}>
      <SectionTitle
        title="Asset Overview"
        action={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(event) => resetToFirstPage(setCategoryFilter)(event.target.value)}
                aria-label="Filter by category"
                className={`${FILTER_CONTROL_CLASS} w-full sm:w-36`}
              >
                <option value="">All Categories</option>
                {ASSET_CATEGORIES.map((category) => (
                  <option key={category.label} value={category.label}>
                    {category.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) => resetToFirstPage(setStatusFilter)(event.target.value)}
                aria-label="Filter by status"
                className={`${FILTER_CONTROL_CLASS} w-full sm:w-32`}
              >
                <option value="">All Status</option>
                {ASSET_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {ASSET_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative w-full sm:w-auto sm:flex-1 lg:w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => resetToFirstPage(setSearch)(event.target.value)}
                placeholder="Search by name or ID"
                className="h-10 w-full rounded-full border border-gray-200 pl-10 pr-4 text-sm text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
              />
            </div>
          </div>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-600">
              <th className="whitespace-nowrap px-2.5 pb-3">Asset ID</th>
              <th className="whitespace-nowrap px-2.5 pb-3">Asset Name</th>
              <th className="whitespace-nowrap px-2.5 pb-3">Category</th>
              <th className="hidden whitespace-nowrap px-2.5 pb-3 2xl:table-cell">Brand / Model</th>
              <th className="whitespace-nowrap px-2.5 pb-3">Assigned To</th>
              <th className="hidden whitespace-nowrap px-2.5 pb-3 min-[1700px]:table-cell">Issue Date</th>
              <th className="whitespace-nowrap px-2.5 pb-3">Status</th>
              <th className="whitespace-nowrap px-2.5 pb-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {visibleAssets.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-gray-500">
                  No assets match the current filters.
                </td>
              </tr>
            ) : (
              visibleAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  menuOpen={menu?.id === asset.id}
                  onOpenMenu={(trigger) => toggleMenu(asset.id, trigger)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`Showing ${firstRow} to ${lastRow} of ${filteredAssets.length} assets`}
      />

      {/* Rendered outside the scroll container, which would clip it. */}
      {menu && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setMenu(null)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            style={{ top: menu.top, left: menu.left }}
            className="fixed z-50 w-40 rounded-xl border border-gray-100 bg-white p-1 shadow-lg"
          >
            <MenuItem icon={Eye} label="View details" onClick={() => setMenu(null)} />
            <MenuItem icon={Pencil} label="Edit asset" onClick={() => setMenu(null)} />
            <MenuItem icon={HandCoins} label="Mark assigned" onClick={() => setMenu(null)} />
            <MenuItem icon={RotateCcw} label="Request return" onClick={() => setMenu(null)} />
          </div>
        </>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  menuOpen,
  onOpenMenu,
}: {
  asset: Asset;
  menuOpen: boolean;
  onOpenMenu: (trigger: HTMLButtonElement) => void;
}) {
  const Icon = ASSET_CATEGORY_ICONS[asset.category] ?? Package;

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="whitespace-nowrap px-2.5 py-4 font-semibold text-[#2563eb]">{asset.id}</td>

      <td className="px-2.5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <Icon className="h-4 w-4 shrink-0 text-[#2563eb]" />
          </span>
          <span className="whitespace-nowrap font-semibold text-gray-900">{asset.name}</span>
        </div>
      </td>

      <td className="whitespace-nowrap px-2.5 py-4 text-gray-600">{asset.category}</td>
      <td className="hidden whitespace-nowrap px-2.5 py-4 text-gray-600 2xl:table-cell">
        {asset.brandModel}
      </td>

      <td className="whitespace-nowrap px-2.5 py-4 text-gray-600">
        {asset.assignedToName ?? "-"}
      </td>

      <td className="hidden whitespace-nowrap px-2.5 py-4 text-gray-600 min-[1700px]:table-cell">
        {asset.issueDate ?? "-"}
      </td>

      <td className="px-2.5 py-4">
        <AssetStatusBadge status={asset.status} />
      </td>

      <td className="px-2.5 py-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(event) => onOpenMenu(event.currentTarget)}
            aria-label={`Actions for ${asset.id}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                        Categories, requests, quick actions                 */
/* -------------------------------------------------------------------------- */

const DONUT_RADIUS = 62;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_STROKE_WIDTH = 22;

function AssetCategoriesPanel() {
  const total = assetCategoryPlaceholders.reduce((sum, entry) => sum + entry.count, 0);

  const segments = assetCategoryPlaceholders.map((entry, index) => {
    const arcLength = (entry.count / total) * DONUT_CIRCUMFERENCE;
    const offset = assetCategoryPlaceholders
      .slice(0, index)
      .reduce((sum, previous) => sum + (previous.count / total) * DONUT_CIRCUMFERENCE, 0);

    return { ...entry, dash: arcLength, offset };
  });

  return (
    <div className={PANEL_CLASS}>
      <SectionTitle title="Asset Categories" />

      <div className="flex items-center gap-3">
        <svg
          viewBox="0 0 160 160"
          className="h-[116px] w-[116px] shrink-0"
          role="img"
          aria-label="Asset distribution by category"
        >
          <g transform="translate(80, 80) rotate(-90)">
            <circle
              r={DONUT_RADIUS}
              fill="none"
              stroke="#f8fafc"
              strokeWidth={DONUT_STROKE_WIDTH}
            />

            {segments.map((segment) => (
              <circle
                key={segment.label}
                r={DONUT_RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={DONUT_STROKE_WIDTH}
                strokeDasharray={`${segment.dash} ${DONUT_CIRCUMFERENCE - segment.dash}`}
                strokeDashoffset={-segment.offset}
              />
            ))}
          </g>

          <text x="80" y="76" textAnchor="middle" className="fill-gray-900 text-[20px] font-bold">
            {total}
          </text>
          <text x="80" y="93" textAnchor="middle" className="fill-gray-400 text-[9px]">
            Total Assets
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-gray-600">{segment.label}</span>
              <span className="shrink-0 font-semibold text-gray-800">{segment.count}</span>
              <span className="w-11 shrink-0 text-right text-gray-400">
                {((segment.count / total) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RecentRequestsPanel() {
  return (
    <div className={PANEL_CLASS}>
      <SectionTitle title="Recent Requests" action={<ViewAllLink />} />

      <ul className="flex flex-col gap-3">
        {recentAssetRequests.map((request) => (
          <li
            key={request.id}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 p-3"
          >
            <PersonAvatar name={request.employeeName} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">
                {request.employeeName}
              </p>
              <p className="truncate text-[11px] text-gray-400">
                {request.type} - {request.detail}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">{request.requestDate}</p>
            </div>

            <RequestStatusBadge status={request.status} />

            <button
              type="button"
              aria-label={`Actions for ${request.id}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const QUICK_ACTIONS: { label: string; icon: typeof Plus; iconBg: string; iconColor: string }[] = [
  { label: "Add Asset", icon: Plus, iconBg: "bg-blue-50", iconColor: "text-[#2563eb]" },
  { label: "Assign Asset", icon: UserPlus, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { label: "Request Return", icon: RotateCcw, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  { label: "View All Assets", icon: Eye, iconBg: "bg-violet-50", iconColor: "text-violet-600" },
  { label: "Generate Report", icon: BarChart3, iconBg: "bg-cyan-50", iconColor: "text-cyan-600" },
  { label: "Asset Settings", icon: Settings2, iconBg: "bg-slate-100", iconColor: "text-slate-500" },
];

function QuickActionsPanel() {
  return (
    <div className={PANEL_CLASS}>
      <SectionTitle title="Quick Actions" />

      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              type="button"
              className="flex items-center gap-2 rounded-2xl border border-gray-100 p-3 text-left transition hover:bg-gray-50"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${action.iconColor}`} />
              </span>
              <span className="min-w-0 whitespace-nowrap text-[10px] font-medium text-gray-700">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Allocation & returns                           */
/* -------------------------------------------------------------------------- */

type AllocationTab = "employee" | "department";

const ALLOCATION_PAGE_SIZE = 5;

function AssetAllocationPanel() {
  const [tab, setTab] = useState<AllocationTab>("employee");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const inScopeAssets = useMemo(
    () =>
      assetPlaceholders.filter(
        (asset) => !categoryFilter || asset.category === categoryFilter,
      ),
    [categoryFilter],
  );

  const employeeRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ASSET_EMPLOYEES.map((employee) => ({
      ...employee,
      count: inScopeAssets.filter((asset) => asset.assignedToId === employee.id).length,
    })).filter(
      (row) =>
        !query ||
        row.id.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.department.toLowerCase().includes(query),
    );
  }, [inScopeAssets, search]);

  const departmentRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ASSET_DEPARTMENTS.map((department) => {
      const members = ASSET_EMPLOYEES.filter(
        (employee) => employee.department === department,
      );
      const memberIds = new Set(members.map((employee) => employee.id));

      return {
        department,
        employees: members.length,
        count: inScopeAssets.filter(
          (asset) => asset.assignedToId && memberIds.has(asset.assignedToId),
        ).length,
      };
    })
      .filter(
        (row) => !query || row.department.toLowerCase().includes(query),
      )
      .sort((left, right) => right.count - left.count);
  }, [inScopeAssets, search]);

  const tabClass = (value: AllocationTab) =>
    `border-b-2 pb-2 text-sm font-medium transition ${
      tab === value
        ? "border-[#2563eb] text-[#2563eb]"
        : "border-transparent text-gray-500 hover:text-gray-700"
    }`;

  const pageCount = Math.max(1, Math.ceil(employeeRows.length / ALLOCATION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleEmployeeRows = employeeRows.slice(
    (currentPage - 1) * ALLOCATION_PAGE_SIZE,
    currentPage * ALLOCATION_PAGE_SIZE,
  );

  const employeeFirstRow = employeeRows.length
    ? (currentPage - 1) * ALLOCATION_PAGE_SIZE + 1
    : 0;
  const employeeLastRow = Math.min(
    currentPage * ALLOCATION_PAGE_SIZE,
    employeeRows.length,
  );

  return (
    <div className={`${PANEL_CLASS} min-w-0`}>
      <h3 className="mb-4 font-bold text-gray-900">Asset Allocation</h3>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("employee")}
            className={tabClass("employee")}
          >
            By Employee
          </button>
          <button
            type="button"
            onClick={() => setTab("department")}
            className={tabClass("department")}
          >
            By Department
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={tab === "employee" ? "Search employee..." : "Search department..."}
              className="h-10 w-36 rounded-full border border-gray-200 pl-9 pr-3 text-[10px] text-gray-700 transition hover:border-gray-300 focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filter allocation by asset category"
              className={`${FILTER_CONTROL_CLASS} w-24 text-[10px]`}
            >
              <option value="">All Assets</option>
              {ASSET_CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {tab === "employee" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-[11px]">
            <thead>
              <tr className="bg-[#f1f5fb] text-[10px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                <th className="whitespace-nowrap rounded-l-xl px-2.5 py-3">Employee ID</th>
                <th className="whitespace-nowrap px-2.5 py-3">Employee Name</th>
                <th className="whitespace-nowrap px-2.5 py-3 2xl:table-cell">Department</th>
                <th className="whitespace-nowrap px-2.5 py-3">Assets Assigned</th>
                <th className="whitespace-nowrap rounded-r-xl px-2.5 py-3 text-right">View</th>
              </tr>
            </thead>

            <tbody>
              {visibleEmployeeRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-500">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                visibleEmployeeRows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-50 last:border-0">
                    <td className="whitespace-nowrap px-2.5 py-3.5 font-semibold text-[#2563eb]">
                      {row.id}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3.5 font-semibold text-gray-900">
                      {row.name}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3.5 text-gray-600 2xl:table-cell">
                      {row.department}
                    </td>
                    <td className="px-2.5 py-3.5 text-gray-600">{row.count}</td>
                    <td className="px-2.5 py-3.5 text-right">
                      <button
                        type="button"
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#2563eb] transition hover:bg-blue-100"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-[11px]">
            <thead>
              <tr className="bg-[#f1f5fb] text-[10px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                <th className="whitespace-nowrap rounded-l-xl px-2.5 py-3">Department</th>
                <th className="whitespace-nowrap px-2.5 py-3">Employees</th>
                <th className="whitespace-nowrap px-2.5 py-3">Assets Assigned</th>
                <th className="whitespace-nowrap rounded-r-xl px-2.5 py-3 text-right">View</th>
              </tr>
            </thead>

            <tbody>
              {departmentRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-500">
                    No departments match the current filters.
                  </td>
                </tr>
              ) : (
                departmentRows.map((row) => (
                  <tr key={row.department} className="border-b border-gray-50 last:border-0">
                    <td className="whitespace-nowrap px-2.5 py-3.5 font-semibold text-gray-900">
                      {row.department}
                    </td>
                    <td className="px-2.5 py-3.5 text-gray-600">{row.employees}</td>
                    <td className="px-2.5 py-3.5 text-gray-600">{row.count}</td>
                    <td className="px-2.5 py-3.5 text-right">
                      <button
                        type="button"
                        className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#2563eb] transition hover:bg-blue-100"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "employee" ? (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onPageChange={setPage}
          summary={`Showing ${employeeFirstRow} to ${employeeLastRow} of ${employeeRows.length} employees`}
        />
      ) : (
        <p className="mt-5 text-sm text-gray-500">
          Showing 1 to {departmentRows.length} of {ASSET_DEPARTMENTS.length} departments
        </p>
      )}
    </div>
  );
}

function AssetReturnRequestsPanel() {
  return (
    <div className={`${PANEL_CLASS} min-w-0`}>
      <SectionTitle title="Asset Return Requests" action={<ViewAllLink />} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-[11px]">
            <thead>
              <tr className="bg-[#f1f5fb] text-[10px] font-bold uppercase tracking-wide text-[#1e3a8a]">
                <th className="whitespace-nowrap rounded-l-xl px-1.5 py-3">Request ID</th>
                <th className="whitespace-nowrap px-1.5 py-3">Asset Name</th>
                <th className="whitespace-nowrap px-1.5 py-3">Employee</th>
                <th className="hidden whitespace-nowrap px-1.5 py-3 min-[1800px]:table-cell">
                  Request Date
                </th>
                <th className="whitespace-nowrap rounded-r-xl px-1.5 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {assetReturnRequests.map((request) => (
                <tr key={request.id} className="border-b border-gray-50 last:border-0">
                  <td className="whitespace-nowrap px-1.5 py-3 font-semibold text-[#2563eb]">
                    {request.id}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-3 text-gray-700">
                    {request.assetName}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-3 text-gray-600">
                    {request.employeeName}
                  </td>
                  <td className="hidden whitespace-nowrap px-1.5 py-3 text-gray-600 min-[1800px]:table-cell">
                    {request.requestDate}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-3">
                    <RequestStatusBadge status={request.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function AdminAssets() {
  const counts = useMemo(() => {
    let assigned = 0;
    let available = 0;
    let pendingReturn = 0;

    for (const asset of assetPlaceholders) {
      if (asset.status === "available") {
        available += 1;
      } else if (asset.status === "pending_return") {
        assigned += 1;
        pendingReturn += 1;
      } else if (asset.status === "in_use") {
        assigned += 1;
      }
    }

    return {
      total: assetPlaceholders.length,
      assigned,
      available,
      pendingReturn,
      categories: ASSET_CATEGORIES.length,
    };
  }, []);

  const share = (value: number) => `${((value / counts.total) * 100).toFixed(1)}% of total`;

  const statCards = [
    {
      label: "Total Assets",
      value: counts.total,
      note: "\u2191 5% from last month",
      noteClass: "text-emerald-600",
      icon: Laptop,
      iconBg: "bg-blue-50",
      iconColor: "text-[#2563eb]",
    },
    {
      label: "Assigned",
      value: counts.assigned,
      note: share(counts.assigned),
      noteClass: "text-emerald-600",
      icon: Users,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Available",
      value: counts.available,
      note: share(counts.available),
      noteClass: "text-rose-600",
      icon: Package,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
    },
    {
      label: "Pending Return",
      value: counts.pendingReturn,
      note: share(counts.pendingReturn),
      noteClass: "text-rose-600",
      icon: Clock,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-500",
    },
    {
      label: "Asset Categories",
      value: counts.categories,
      note: "View All \u2192",
      noteClass: "text-[#2563eb]",
      icon: FileText,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
    },
  ];

  return (
    <div className="px-5 pb-10 pt-8 sm:px-8 xl:px-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 xl:text-4xl">Asset Management</h1>
          <p className="mt-1 text-gray-500">
            Track, assign and manage company assets assigned to employees.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className={KPI_CARD_CLASS}>
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-gray-900">{card.label}</p>
                  <p className="mt-1 truncate text-2xl font-bold leading-tight text-gray-900">
                    {card.value}
                  </p>
                  <p className={`mt-0.5 truncate text-xs font-semibold ${card.noteClass}`}>
                    {card.note}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <AssetOverview />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <AssetAllocationPanel />
            </div>
            <div className="xl:col-span-5">
              <AssetReturnRequestsPanel />
            </div>
            <div className="xl:col-span-5 xl:col-start-8">
              <QuickActionsPanel />
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-6 xl:w-[340px]">
          <AssetCategoriesPanel />
          <RecentRequestsPanel />
        </div>
      </div>
    </div>
  );
}
