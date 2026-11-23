import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList, ReactNode } from "react";
import { TableSkeleton } from "../../components/ui";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Laptop,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_ICONS,
  initialsForAsset,
} from "./assetData";
import AssetAllocationDetailModal, {
  type AllocationDetailTarget,
} from "./AssetAllocationDetailModal";
import AssetAssignModal from "./AssetAssignModal";
import AssetDeleteModal from "./AssetDeleteModal";
import AssetDetailModal from "./AssetDetailModal";
import AssetFormModal from "./AssetFormModal";
import AssetReturnModal from "./AssetReturnModal";
import MarkReturnedModal from "./MarkReturnedModal";
import NoticePopup, { type Notice } from "../../components/ui/NoticePopup";
import { assetService } from "./assetService";
import {
  ASSET_STATUS_LABELS,
  ASSET_STATUS_ORDER,
  type AllocationRow,
  type Asset,
  type AssetCategory,
  type AssetRequest,
  type AssetRequestStatus,
  type AssetStatus,
  type AssetStats,
  type CategoryCount,
  type Paginated,
} from "./types";

const PANEL_CLASS = "rounded-lg border border-[#E4E6E1] bg-white overflow-hidden shadow-none";

// KPI cards share one row and clip rather than letting large numbers overflow.
const KPI_CARD_CLASS =
  "min-w-0 overflow-hidden rounded-lg border border-[#E4E6E1] bg-white p-[16px_20px] min-h-[96px] shadow-none flex flex-col justify-between";

const FILTER_CONTROL_CLASS =
  "h-10 w-full appearance-none rounded-[6px] border border-[#E4E6E1] bg-white px-3.5 pr-9 text-xs font-medium " +
  "text-[#1F2933] transition hover:border-[#CBD2D9] focus:border-[#2F5FD0] focus:outline-none";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Renders "2025-05-19" and ISO timestamps as "19 May 2025". */
function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const [year, month, day] = value.split("T")[0].split("-").map(Number);

  if (!year || !month || !day || !MONTHS[month - 1]) {
    return "-";
  }

  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** The server caps a page at 100, so the report walks past it. */
const REPORT_PAGE_SIZE = 100;

/** Quotes a CSV cell, doubling any embedded quotes. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * The asset register as CSV.
 *
 * Built from a full walk of the filtered list rather than the page on screen,
 * so the report is the whole answer and not just what happened to fit.
 */
function buildAssetsCsv(assets: Asset[]): string {
  const headers = [
    "Asset Tag",
    "Name",
    "Category",
    "Brand / Model",
    "Serial Number",
    "Status",
    "Assigned To",
    "Employee ID",
    "Department",
    "Issue Date",
    "Purchase Date",
    "Purchase Cost",
    "Vendor",
    "Warranty Expiry",
  ];

  const rows = assets.map((asset) => [
    asset.asset_tag,
    asset.name,
    asset.category,
    asset.brand_model,
    asset.serial_number,
    ASSET_STATUS_LABELS[asset.status] ?? asset.status,
    asset.assigned_to_name,
    asset.assigned_to_employee_id,
    asset.department_name,
    asset.issue_date,
    asset.purchase_date,
    asset.purchase_cost,
    asset.vendor,
    asset.warranty_expiry,
  ]);

  // The BOM is what makes Excel open a UTF-8 CSV without mangling names.
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadBlob(csv: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** "assets-report-2026-10-14.csv", so repeat exports do not overwrite each other. */
function reportFilename(): string {
  return `assets-report-${new Date().toISOString().slice(0, 10)}.csv`;
}

/**
 * Fetches an asset endpoint and tracks its loading/error state.
 *
 * Filtering and paging are applied by the server, so the caller passes the
 * query state as `deps`. Responses are stamped with the query they belong to
 * and a mismatch is ignored, so a slow reply for the previous filter can never
 * overwrite the results the user is already looking at.
 */
function useAssetQuery<T>(
  run: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; loading: boolean; error: string | null } {
  const key = deps.join("|");

  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    error: string | null;
  }>({ key: null, data: null, error: null });

  useEffect(() => {
    let active = true;

    run()
      .then((data) => {
        if (active) {
          setState({ key, data, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setState({
            key,
            data: null,
            error: cause instanceof Error ? cause.message : "Something went wrong",
          });
        }
      });

    return () => {
      active = false;
    };
    // `run` is rebuilt on every render, so the serialised deps are the real
    // trigger here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const settled = state.key !== null && state.key === key;

  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading: !settled,
  };
}

function PanelState({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="py-8 px-5">
        <TableSkeleton rows={3} columns={5} />
      </div>
    );
  }

  if (error) {
    return <p className="py-8 px-5 text-center text-xs text-rose-500">{error}</p>;
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center py-8 px-5 text-center">
        <p className="text-xs text-[#7B8794]">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

const assetStatusStyles: Record<AssetStatus, string> = {
  in_use: "bg-[#E3F5E1] text-[#1E6B45] border border-[#BCE8B5]",
  available: "bg-[#E8EEFB] text-[#2F5FD0] border border-[#2F5FD0]/20",
  pending_return: "bg-[#FDF3D6] text-[#8A5A00] border border-[#F6DE95]",
  maintenance: "bg-[#F0F1EE] text-[#52606D] border border-[#E4E6E1]",
};

const requestStatusStyles: Record<AssetRequestStatus, string> = {
  pending: "bg-[#FDF3D6] text-[#8A5A00] border border-[#F6DE95]",
  approved: "bg-[#E3F5E1] text-[#1E6B45] border border-[#BCE8B5]",
  rejected: "bg-[#FBE4E1] text-[#A12D22] border border-[#FBE4E1]",
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium border ${assetStatusStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: AssetRequestStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium border ${requestStatusStyles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-xs font-semibold text-[#2F5FD0]">
      {initialsForAsset(name)}
    </span>
  );
}

function SectionTitle({
  title,
  action,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-4 border-b border-[#E4E6E1] bg-white shrink-0 ${className}`}
    >
      <h3 className="shrink-0 text-base font-semibold text-[#1F2933]">{title}</h3>
      {action}
    </div>
  );
}

function ViewAllLink({
  onClick,
  label = "View All",
}: {
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap text-[13px] font-medium text-[#2F5FD0] hover:underline cursor-pointer"
    >
      {label}
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
  className = "px-5 py-3 border-t border-[#E4E6E1] bg-white",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  summary: string;
  /** `mt-auto` pins the footer to the bottom of a full-height panel. */
  className?: string;
}) {
  if (pageCount <= 1) {
    return (
      <div className={`${className} flex items-center justify-between`}>
        <p className="text-xs text-[#7B8794]">{summary}</p>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-xs text-[#7B8794]">{summary}</p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] text-[#52606D] transition hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
        </button>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-xs text-[#7B8794]">
              &hellip;
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition cursor-pointer ${
                entry === page
                  ? "border-[#2F5FD0] bg-[#2F5FD0] text-white"
                  : "border-[#E4E6E1] text-[#52606D] hover:bg-[#F0F1EE] hover:text-[#1F2933]"
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
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E6E1] text-[#52606D] transition hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Overview                                  */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 7;

/** How many rows "View All Assets" pulls back in one page. */
const ALL_ASSETS_LIMIT = 100;

interface OverviewFilters {
  search: string;
  category: string;
  status: string;
  page: number;
}

const EMPTY_FILTERS: OverviewFilters = { search: "", category: "", status: "", page: 1 };

function AssetOverview({
  filters,
  onFiltersChange,
  version,
  showAll,
  onToggleShowAll,
  onViewAsset,
  onEditAsset,
  onReturnAsset,
  onDeleteAsset,
}: {
  filters: OverviewFilters;
  onFiltersChange: (next: OverviewFilters) => void;
  version: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  onViewAsset: (asset: Asset) => void;
  onEditAsset: (asset: Asset) => void;
  onReturnAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}) {
  const { search, category: categoryFilter, status: statusFilter, page } = filters;

  // "Show all" is a single oversized page rather than a paginated walk, so the
  // page control collapses out of the way while it is on.
  const activePage = showAll ? 1 : page;
  const limit = showAll ? ALL_ASSETS_LIMIT : PAGE_SIZE;

  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(
    null,
  );

  const { data, loading, error } = useAssetQuery<Paginated<Asset>>(
    () =>
      assetService.listAssets({
        search: search.trim() || undefined,
        category: (categoryFilter || undefined) as AssetCategory | undefined,
        status: (statusFilter || undefined) as AssetStatus | undefined,
        page: activePage,
        limit,
      }),
    [search, categoryFilter, statusFilter, activePage, limit, version],
  );

  const visibleAssets = data?.items ?? [];
  const total = data?.total ?? 0;

  // The dropdown is anchored to the row id, so the row it refers to has to be
  // resolved from the loaded page.
  const menuAsset = visibleAssets.find((entry) => entry.id === menu?.id) ?? null;

  const pageCount = showAll ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(activePage, pageCount);

  const firstRow = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastRow = showAll ? total : Math.min(currentPage * PAGE_SIZE, total);

  /** Anchored to the viewport so the scroll container cannot clip it. */
  function toggleMenu(id: string, trigger: HTMLButtonElement) {
    if (menu?.id === id) {
      setMenu(null);
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 180;

    const left = Math.min(
      Math.max(rect.right - menuWidth, 16),
      Math.max(16, window.innerWidth - menuWidth - 16),
    );

    const top = Math.min(
      Math.max(rect.bottom + 4, 16),
      Math.max(16, window.innerHeight - menuHeight - 16),
    );

    setMenu({
      id,
      top,
      left,
    });
  }

  function setFilter<K extends keyof OverviewFilters>(
    key: K,
    value: OverviewFilters[K],
  ) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle title="Asset Overview" />

      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-[#E4E6E1] bg-white">
        <button
          type="button"
          onClick={onToggleShowAll}
          className={`h-10 shrink-0 whitespace-nowrap rounded-[6px] border px-4 text-xs font-semibold transition cursor-pointer ${
            showAll
              ? "border-[#2F5FD0] bg-[#2F5FD0] text-white hover:bg-[#264FB0]"
              : "border-[#E4E6E1] bg-white text-[#52606D] hover:bg-[#F0F1EE] hover:text-[#1F2933]"
          }`}
        >
          {showAll ? "Show Less" : "View All Assets"}
        </button>

        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(event) => setFilter("category", event.target.value)}
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
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(event) => setFilter("status", event.target.value)}
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
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
        </div>

        <div className="relative w-full sm:w-auto sm:flex-1 lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Search by name or ID"
            className="h-10 w-full rounded-[6px] border border-[#E4E6E1] bg-white pl-10 pr-4 text-sm text-[#1F2933] transition hover:border-[#CBD2D9] focus:border-[#2F5FD0] focus:outline-none"
          />
        </div>
      </div>

      <PanelState
        loading={loading}
        error={error}
        empty={visibleAssets.length === 0}
        emptyMessage={
          search || categoryFilter || statusFilter
            ? "No assets match the current filters."
            : "No assets yet. Use Add Asset to record your first one."
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="h-11 bg-[#FAFAF8] border-b border-[#E4E6E1] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                <th className="whitespace-nowrap px-5 py-3">Asset ID</th>
                <th className="whitespace-nowrap px-5 py-3">Asset Name</th>
                <th className="whitespace-nowrap px-5 py-3">Category</th>
                <th className="hidden whitespace-nowrap px-5 py-3 2xl:table-cell">
                  Brand / Model
                </th>
                <th className="whitespace-nowrap px-5 py-3">Assigned To</th>
                <th className="hidden whitespace-nowrap px-5 py-3 min-[1700px]:table-cell">
                  Issue Date
                </th>
                <th className="whitespace-nowrap px-5 py-3">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleAssets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  menuOpen={menu?.id === asset.id}
                  onOpenMenu={(trigger) => toggleMenu(asset.id, trigger)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={(next) => setFilter("page", next)}
        summary={`Showing ${firstRow} to ${lastRow} of ${total} assets`}
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
            className="fixed z-50 w-40 rounded-lg border border-[#E4E6E1] bg-white p-1 shadow-lg"
          >
            {menuAsset && (
              <>
                <MenuItem
                  icon={Eye}
                  label="View details"
                  onClick={() => {
                    onViewAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={Pencil}
                  label="Edit asset"
                  onClick={() => {
                    onEditAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                <MenuItem
                  icon={RotateCcw}
                  label="Request return"
                  onClick={() => {
                    onReturnAsset(menuAsset);
                    setMenu(null);
                  }}
                />
                {/* The API refuses to delete an asset somebody still holds, so the
                    action is withheld rather than offered as a guaranteed 409. */}
                {!menuAsset.assigned_to_employee_id && (
                  <MenuItem
                    icon={Trash2}
                    label="Delete asset"
                    tone="danger"
                    onClick={() => {
                      onDeleteAsset(menuAsset);
                      setMenu(null);
                    }}
                  />
                )}
              </>
            )}
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
    <tr className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors">
      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-[#2F5FD0]">
        {asset.asset_tag}
      </td>

      <td className="px-5 py-3.5 text-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFB] text-[#2F5FD0]">
            <Icon className="h-4 w-4 shrink-0" />
          </span>
          <span className="whitespace-nowrap font-medium text-[#1F2933]">{asset.name}</span>
        </div>
      </td>

      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">{asset.category}</td>
      <td className="hidden whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D] 2xl:table-cell">
        {asset.brand_model ?? "-"}
      </td>

      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">
        {asset.assigned_to_name ?? "-"}
      </td>

      <td className="hidden whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D] min-[1700px]:table-cell">
        {formatDate(asset.issue_date)}
      </td>

      <td className="px-5 py-3.5 text-sm">
        <AssetStatusBadge status={asset.status} />
      </td>

      <td className="px-5 py-3.5 text-sm">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(event) => onOpenMenu(event.currentTarget)}
            aria-label={`Actions for ${asset.asset_tag}`}
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#7B8794] transition hover:bg-[#F0F1EE] hover:text-[#1F2933] cursor-pointer"
          >
            <MoreVertical className="h-4 w-4 shrink-0" />
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
  tone = "default",
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${tone === "danger" ? "text-rose-400" : "text-gray-400"}`}
      />
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

function AssetCategoriesPanel({
  categoryCounts,
  total,
}: {
  categoryCounts: CategoryCount[];
  total: number;
}) {
  const countByCategory = new Map(
    categoryCounts.map((entry) => [entry.category, entry.count]),
  );

  const counts = ASSET_CATEGORIES.map((meta) => countByCategory.get(meta.label) ?? 0);

  // Driven by ASSET_CATEGORIES rather than the response order, so the donut
  // slices and legend colours always match regardless of what the API returns.
  const segments = ASSET_CATEGORIES.map((meta, index) => {
    const count = counts[index];
    const dash = total ? (count / total) * DONUT_CIRCUMFERENCE : 0;
    const offset = counts
      .slice(0, index)
      .reduce(
        (sum, previous) => sum + (total ? (previous / total) * DONUT_CIRCUMFERENCE : 0),
        0,
      );

    return { ...meta, count, dash, offset };
  });

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle title="Asset Categories" />

      <div className="p-5 flex items-center gap-4">
        <svg
          viewBox="0 0 160 160"
          className="h-[140px] w-[140px] shrink-0"
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

          <text x="80" y="76" textAnchor="middle" className="fill-[#1F2933] text-[22px] font-bold">
            {total}
          </text>
          <text x="80" y="94" textAnchor="middle" className="fill-[#7B8794] text-xs">
            Total Assets
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-1">
          {segments.map((segment) => (
            <li key={segment.label} className="flex h-6 items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[#52606D]">{segment.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-right text-[#1F2933]">{segment.count}</span>
              <span className="w-12 shrink-0 text-right tabular-nums text-[#7B8794]">
                {((segment.count / Math.max(1, total)) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const RECENT_ALLOCATION_LIMIT = 5;

const ALL_ALLOCATIONS_LIMIT = 100;

/**
 * Who was handed what, most recently first.
 *
 * This reads the assets that currently have a holder rather than the request
 * queue: an allocation has happened by the time it shows up here, whereas a
 * request is only an intention.
 */
function RecentAllocationPanel({ version }: { version: number }) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : RECENT_ALLOCATION_LIMIT;

  const { data, loading, error } = useAssetQuery<Asset[]>(
    () => assetService.listRecentAllocations(limit),
    [limit, version],
  );

  const allocations = data ?? [];

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle
        title="Recent Allocation"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less" : "View All"}
          />
        }
      />

      <div className="p-5">
        <PanelState
          loading={loading}
          error={error}
          empty={allocations.length === 0}
          emptyMessage="Nothing has been allocated yet."
        >
          <ul className="flex flex-col gap-2.5">
            {allocations.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-lg border border-[#E4E6E1] p-3 hover:bg-[#F6F7F5]/50 transition-colors"
              >
                <PersonAvatar name={asset.assigned_to_name ?? "?"} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1F2933]">
                    {asset.assigned_to_name ?? "Unassigned"}
                  </p>
                  <p className="truncate text-xs text-[#7B8794]">
                    {asset.asset_tag} - {asset.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#7B8794]">
                    Allocated on {formatDate(asset.issue_date)}
                  </p>
                </div>

                <AssetStatusBadge status={asset.status} />
              </li>
            ))}
          </ul>
        </PanelState>
      </div>
    </div>
  );
}

interface QuickAction {
  /** Stable across label changes, so a tile keeps its identity while busy. */
  id: string;
  label: string;
  icon: typeof Plus;
  iconBg: string;
  iconColor: string;
  /** Undefined marks a decorative button that is not wired up yet. */
  run?: () => void;
  /** Marks a wired tile that is temporarily unavailable. */
  busy?: boolean;
}

interface QuickActionsPanelProps {
  onAdd: () => void;
  onAssign: () => void;
  onReturn: () => void;
  onViewAll: () => void;
  onGenerateReport: () => void;
  /** True while the report is being assembled, so the tile can show progress. */
  generatingReport: boolean;
}

function QuickActionsPanel({
  onAdd,
  onAssign,
  onReturn,
  onViewAll,
  onGenerateReport,
  generatingReport,
}: QuickActionsPanelProps) {
  const actions: QuickAction[] = [
    {
      id: "add",
      label: "Add Asset",
      icon: Plus,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
      run: onAdd,
    },
    {
      id: "assign",
      label: "Assign Asset",
      icon: UserPlus,
      iconBg: "bg-[#E3F5E1]",
      iconColor: "text-[#1E6B45]",
      run: onAssign,
    },
    {
      id: "return",
      label: "Request Return",
      icon: RotateCcw,
      iconBg: "bg-[#FDF3D6]",
      iconColor: "text-[#8A5A00]",
      run: onReturn,
    },
    {
      id: "view-all",
      label: "View All Assets",
      icon: Eye,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#7E22CE]",
      run: onViewAll,
    },
    {
      id: "generate-report",
      label: generatingReport ? "Building..." : "Generate Report",
      icon: BarChart3,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
      run: generatingReport ? undefined : onGenerateReport,
      busy: generatingReport,
    },
    {
      id: "settings",
      label: "Asset Settings",
      icon: Settings2,
      iconBg: "bg-[#FDF3D6]",
      iconColor: "text-[#8A5A00]",
    },
  ];

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle title="Quick Actions" />

      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const disabled = !action.run;

            return (
              <button
                key={action.id}
                type="button"
                disabled={disabled}
                onClick={action.run}
                title={
                  disabled
                    ? action.busy
                      ? "Generating the report"
                      : "Not available yet"
                    : undefined
                }
                className={`flex min-w-0 items-center gap-2.5 rounded-lg border border-[#E4E6E1] bg-white h-12 px-3 text-left transition ${
                  disabled
                    ? `cursor-not-allowed opacity-60 ${action.busy ? "animate-pulse" : ""}`
                    : "hover:bg-[#F6F7F5] hover:border-[#CBD2D9] cursor-pointer group"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.iconBg} ${action.iconColor}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
                <span className="min-w-0 text-xs font-medium leading-tight text-[#1F2933] truncate">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Allocation & returns                           */
/* -------------------------------------------------------------------------- */

type AllocationTab = "employee" | "department";

const ALLOCATION_PAGE_SIZE = 5;

function AssetAllocationPanel({
  version,
  onViewAllocation,
}: {
  version: number;
  onViewAllocation: (target: AllocationDetailTarget) => void;
}) {
  const [tab, setTab] = useState<AllocationTab>("employee");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data, loading, error } = useAssetQuery<Paginated<AllocationRow>>(
    () =>
      assetService.getAllocation({
        view: tab,
        search: search.trim() || undefined,
        category: (categoryFilter || undefined) as AssetCategory | undefined,
        page,
        limit: ALLOCATION_PAGE_SIZE,
      }),
    [tab, search, categoryFilter, page, version],
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const pageCount = Math.max(1, Math.ceil(total / ALLOCATION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const firstRow = total ? (currentPage - 1) * ALLOCATION_PAGE_SIZE + 1 : 0;
  const lastRow = Math.min(currentPage * ALLOCATION_PAGE_SIZE, total);

  function resetFilters() {
    setSearch("");
    setCategoryFilter("");
    setPage(1);
  }

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle title="Asset Allocation" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E4E6E1] bg-white">
        <div className="flex items-center gap-1 bg-[#F0F1EE] p-1 rounded-md">
          <button
            type="button"
            onClick={() => {
              setTab("employee");
              setPage(1);
            }}
            className={`rounded-[6px] px-3 py-1.5 text-xs transition cursor-pointer ${
              tab === "employee"
                ? "bg-white text-[#2F5FD0] border border-[#E4E6E1] font-semibold shadow-sm"
                : "text-[#52606D] hover:text-[#1F2933] font-medium"
            }`}
          >
            By Employee
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("department");
              setPage(1);
            }}
            className={`rounded-[6px] px-3 py-1.5 text-xs transition cursor-pointer ${
              tab === "department"
                ? "bg-white text-[#2F5FD0] border border-[#E4E6E1] font-semibold shadow-sm"
                : "text-[#52606D] hover:text-[#1F2933] font-medium"
            }`}
          >
            By Department
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={tab === "employee" ? "Search employee..." : "Search department..."}
              className="h-10 w-44 rounded-[6px] border border-[#E4E6E1] bg-white pl-9 pr-3 text-xs text-[#1F2933] transition hover:border-[#CBD2D9] focus:border-[#2F5FD0] focus:outline-none"
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
              className={`${FILTER_CONTROL_CLASS} w-32`}
            >
              <option value="">All Assets</option>
              {ASSET_CATEGORIES.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8794]" />
          </div>
        </div>
      </div>

      <PanelState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyMessage="No records match the current filters."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="h-11 bg-[#FAFAF8] border-b border-[#E4E6E1] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                {tab === "employee" ? (
                  <>
                    <th className="whitespace-nowrap px-5 py-3">Employee ID</th>
                    <th className="whitespace-nowrap px-5 py-3">Employee Name</th>
                    <th className="whitespace-nowrap px-5 py-3">Assets Assigned</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">View</th>
                  </>
                ) : (
                  <>
                    <th className="whitespace-nowrap px-5 py-3">Department</th>
                    <th className="whitespace-nowrap px-5 py-3">Employees</th>
                    <th className="whitespace-nowrap px-5 py-3">Assets Assigned</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">View</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors">
                  {tab === "employee" ? (
                    <>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-[#2F5FD0]">
                        {row.id}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-[#1F2933]">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">{row.asset_count}</td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-[#1F2933]">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">{row.employees}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">{row.asset_count}</td>
                    </>
                  )}

                  <td className="whitespace-nowrap px-5 py-3.5 text-sm text-right">
                    <button
                      type="button"
                      onClick={() => onViewAllocation({ view: tab, row })}
                      className="h-8 px-3 py-0 text-[13px] font-medium rounded-md border border-[#E4E6E1] text-[#1F2933] bg-white hover:bg-[#F0F1EE] transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <Pagination
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`Showing ${firstRow} to ${lastRow} of ${total} ${
          tab === "employee" ? "employees" : "departments"
        }`}
      />

      {error && (
        <div className="px-5 py-2">
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-[#2F5FD0] hover:underline cursor-pointer"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}

function AssetReturnRequestsPanel({
  version,
  onConfirmReturn,
}: {
  version: number;
  onConfirmReturn: (request: AssetRequest) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : 5;

  const { data, loading, error } = useAssetQuery<Paginated<AssetRequest>>(
    () => assetService.listRequests({ request_type: "return", limit }),
    [limit, version],
  );

  const requests = data?.items ?? [];

  // A return request sits on Pending until the admin confirms receipt, and only
  // then does the asset actually leave the employee. Both halves have to hold
  // for the action to be offered: still pending on the request, and still held
  // by somebody on the asset (`asset_status` is resolved by the API for
  // exactly this reason).
  const canMarkReturned = (request: AssetRequest) =>
    request.status === "pending" &&
    request.asset_id !== null &&
    (request.asset_status === "in_use" || request.asset_status === "pending_return");

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle
        title="Asset Return Requests"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less" : "View All"}
          />
        }
      />

      <PanelState
        loading={loading}
        error={error}
        empty={requests.length === 0}
        emptyMessage="No return requests yet."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="h-11 bg-[#FAFAF8] border-b border-[#E4E6E1] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                <th className="whitespace-nowrap px-5 py-3">Request ID</th>
                <th className="whitespace-nowrap px-5 py-3">Asset Name</th>
                <th className="whitespace-nowrap px-5 py-3">Employee</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors">
                  <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-[#2F5FD0]">
                    {request.request_tag}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium text-[#1F2933]">{request.asset_name}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">{request.employee_name}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    {canMarkReturned(request) ? (
                      <button
                        type="button"
                        onClick={() => onConfirmReturn(request)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#E3F5E1] border border-[#BCE8B5] px-2.5 py-1 text-xs font-medium text-[#1E6B45] transition hover:bg-[#D5EED1] cursor-pointer"
                      >
                        <Check className="h-4 w-4 shrink-0" />
                        Mark Returned
                      </button>
                    ) : (
                      <span className="text-xs text-[#7B8794]">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>
    </div>
  );
}

function AssetIssueRequestsPanel({
  version,
  onReviewed,
}: {
  version: number;
  onReviewed: (message: string) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : 5;

  const { data, loading, error } = useAssetQuery<Paginated<AssetRequest>>(
    () =>
      assetService.listRequests({
        request_type: "issue",
        status: "pending",
        limit,
      }),
    [limit, version],
  );

  const requests = data?.items ?? [];

  async function handleReview(
    request: AssetRequest,
    status: "approved" | "rejected",
  ) {
    setBusyId(request.id);
    setActionError(null);

    try {
      await assetService.reviewRequest(request.id, status);
      await onReviewed(
        status === "approved"
          ? `Asset request ${request.request_tag} approved.`
          : `Asset request ${request.request_tag} rejected.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to review this asset request. Please try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col`}>
      <SectionTitle
        title="Asset Issue Requests"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less" : "View All"}
          />
        }
      />

      {actionError && (
        <p
          role="alert"
          className="mx-5 mt-4 rounded-lg bg-[#FBE4E1] border border-[#FBE4E1] px-3.5 py-2.5 text-xs text-[#A12D22]"
        >
          {actionError}
        </p>
      )}

      <PanelState
        loading={loading}
        error={error}
        empty={requests.length === 0}
        emptyMessage="No pending asset issue requests."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="h-11 bg-[#FAFAF8] border-b border-[#E4E6E1] text-xs font-medium uppercase tracking-wider text-[#7B8794]">
                <th className="whitespace-nowrap px-5 py-3">Request</th>
                <th className="whitespace-nowrap px-5 py-3">Asset</th>
                <th className="whitespace-nowrap px-5 py-3">Employee</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Status</th>
                <th className="whitespace-nowrap px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="min-h-[52px] border-b border-[#E4E6E1]/50 last:border-0 hover:bg-[#FAFAF8] transition-colors"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-[#2F5FD0]">
                    {request.request_tag}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium text-[#1F2933]">
                    {request.asset_name}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-sm text-[#52606D]">
                    {request.employee_name}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handleReview(request, "approved")}
                        className="h-8 px-3 py-0 text-[13px] font-medium rounded-md border border-[#BCE8B5] bg-[#E3F5E1] text-[#1E6B45] hover:bg-[#D5EED1] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {busyId === request.id ? "Saving…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => handleReview(request, "rejected")}
                        className="h-8 px-3 py-0 text-[13px] font-medium rounded-md border border-[#FBE4E1] bg-[#FBE4E1] text-[#A12D22] hover:bg-[#F7D5D1] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

type ModalState =
  | { kind: "form"; asset: Asset | null }
  | { kind: "assign"; assetId?: string }
  | { kind: "return"; assetId?: string }
  | { kind: "detail"; asset: Asset }
  | { kind: "allocation"; target: AllocationDetailTarget }
  | { kind: "delete"; asset: Asset }
  | { kind: "markReturned"; request: AssetRequest }
  | null;

export default function AdminAssets() {
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState<OverviewFilters>(EMPTY_FILTERS);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const { data: stats, error: statsError } = useAssetQuery<AssetStats>(
    () => assetService.getStats(),
    [version],
  );

  // Every panel watches `version`, so one bump refetches stats, categories,
  // assets, allocation and requests together after a mutation.
  function refresh() {
    setVersion((previous) => previous + 1);
  }

  async function handleSaved(message: string) {
    refresh();
    setNotice({ type: "success", text: message });
  }

  function handleViewAllAssets() {
    setShowAllAssets(true);
    setFilters(EMPTY_FILTERS);
    overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * Exports the asset register as CSV.
   *
   * The filters in the overview panel are respected, so the report matches what
   * the admin was looking at - but it walks every page of the match instead of
   * exporting only the rows on screen.
   */
  async function handleGenerateReport() {
    if (generatingReport) return;

    setGeneratingReport(true);

    const params = {
      search: filters.search.trim() || undefined,
      category: (filters.category || undefined) as AssetCategory | undefined,
      status: (filters.status || undefined) as AssetStatus | undefined,
    };

    try {
      const collected: Asset[] = [];
      let page = 1;
      let total = 0;

      // The endpoint caps a page at 100, so walk until the rows run out. The
      // empty-page break guards against a server that reports a total it will
      // not actually hand over.
      do {
        const batch = await assetService.listAssets({
          ...params,
          page,
          limit: REPORT_PAGE_SIZE,
        });

        collected.push(...batch.items);
        total = batch.total;
        page += 1;

        if (batch.items.length === 0) break;
      } while (collected.length < total);

      if (collected.length === 0) {
        setNotice({
          type: "error",
          text: "No assets match the current filters to report on.",
        });
        return;
      }

      downloadBlob(buildAssetsCsv(collected), reportFilename());
      setNotice({
        type: "success",
        text: `Report generated with ${formatCount(collected.length)} asset${collected.length === 1 ? "" : "s"}.`,
      });
    } catch {
      setNotice({
        type: "error",
        text: "Unable to generate the asset report.",
      });
    } finally {
      setGeneratingReport(false);
    }
  }

  // Wrapped in useCallback because the popup restarts its auto-dismiss timer
  // whenever onDismiss changes identity. An inline arrow would keep resetting
  // the countdown on every render and the popup would never disappear.
  const dismissNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const counts = {
    total: stats?.total_assets ?? 0,
    // Pending returns are still in somebody's hands, so they count as assigned
    // here exactly as they did when this was computed client-side.
    assigned: (stats?.in_use ?? 0) + (stats?.pending_return ?? 0),
    available: stats?.available ?? 0,
    pendingReturn: stats?.pending_return ?? 0,
    categories: ASSET_CATEGORIES.length,
    // How many of those categories actually hold an asset, so the card can
    // say something instead of leaving a blank line under the number.
    categoriesInUse: (stats?.category_counts ?? []).filter(
      (entry) => entry.count > 0,
    ).length,
  };

  const share = (value: number) =>
    counts.total ? `${((value / counts.total) * 100).toFixed(1)}% of total` : "0% of total";

  const statCards = [
    {
      label: "Total Assets",
      value: formatCount(counts.total),
      note: "↑ 5% from last month",
      noteClass: "text-[#1E6B45]",
      icon: Laptop,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
    {
      label: "Assigned",
      value: formatCount(counts.assigned),
      note: share(counts.assigned),
      noteClass: "text-[#7B8794]",
      icon: Users,
      iconBg: "bg-[#E3F5E1]",
      iconColor: "text-[#1E6B45]",
    },
    {
      label: "Available",
      value: formatCount(counts.available),
      note: share(counts.available),
      noteClass: "text-[#7B8794]",
      icon: Package,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#7E22CE]",
    },
    {
      label: "Pending Return",
      value: formatCount(counts.pendingReturn),
      note: share(counts.pendingReturn),
      noteClass: "text-[#7B8794]",
      icon: Clock,
      iconBg: "bg-[#FDF3D6]",
      iconColor: "text-[#8A5A00]",
    },
    {
      label: "Asset Categories",
      value: String(counts.categories),
      note: `${counts.categoriesInUse} of ${counts.categories} in use`,
      noteClass: "text-[#7B8794]",
      icon: FileText,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Title Treatment */}
      <div className="flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold text-[#1F2933]">Asset Management</h1>
        <p className="text-sm text-[#7B8794]">
          Track, assign and manage company assets assigned to employees.
        </p>
      </div>

      {statsError && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600">
          Could not load asset summary: {statsError}
        </p>
      )}

      <NoticePopup notice={notice} onDismiss={dismissNotice} />

      {/* Summary cards - 5 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div key={card.label} className={KPI_CARD_CLASS}>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[13px] font-medium text-[#7B8794] truncate">
                  {card.label}
                </span>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${card.iconColor}`} />
                </div>
              </div>

              <div className="mt-2">
                <span className="text-[28px] font-semibold text-[#1F2933] tracking-tight leading-[1.1] block">
                  {card.value}
                </span>
              </div>
              {card.note && (
                <span className={`text-xs mt-1 truncate block m-0 ${card.noteClass}`}>
                  {card.note}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Two bands with different column templates: the top band keeps the wide
          layout (Overview + 340px rail), while the bottom band is a 50/50 split
          so Asset Allocation takes exactly half the page and Return Requests /
          Quick Actions share the other half. */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div ref={overviewRef} className="min-w-0 scroll-mt-24">
            <AssetOverview
              filters={filters}
              onFiltersChange={setFilters}
              version={version}
              showAll={showAllAssets}
              onToggleShowAll={() => setShowAllAssets((previous) => !previous)}
              onViewAsset={(asset) => setModal({ kind: "detail", asset })}
              onEditAsset={(asset) => setModal({ kind: "form", asset })}
              onReturnAsset={(asset) => setModal({ kind: "return", assetId: asset.id })}
              onDeleteAsset={(asset) => setModal({ kind: "delete", asset })}
            />
          </div>

          <div className="flex flex-col gap-6 min-w-0">
            <AssetCategoriesPanel
              categoryCounts={stats?.category_counts ?? []}
              total={stats?.total_assets ?? 0}
            />
            <RecentAllocationPanel version={version} />
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <AssetAllocationPanel
            version={version}
            onViewAllocation={(target) => setModal({ kind: "allocation", target })}
          />

          <div className="flex flex-col gap-6 min-w-0">
            <AssetIssueRequestsPanel
              version={version}
              onReviewed={handleSaved}
            />
            <AssetReturnRequestsPanel
              version={version}
              onConfirmReturn={(request) => setModal({ kind: "markReturned", request })}
            />
            <QuickActionsPanel
              onAdd={() => setModal({ kind: "form", asset: null })}
              onAssign={() => setModal({ kind: "assign" })}
              onReturn={() => setModal({ kind: "return" })}
              onViewAll={handleViewAllAssets}
              onGenerateReport={handleGenerateReport}
              generatingReport={generatingReport}
            />
          </div>
        </div>
      </div>

      {modal?.kind === "form" && (
        <AssetFormModal
          asset={modal.asset}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "assign" && (
        <AssetAssignModal
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "return" && (
        <AssetReturnModal
          assetId={modal.assetId}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal?.kind === "detail" && (
        <AssetDetailModal asset={modal.asset} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "allocation" && (
        <AssetAllocationDetailModal
          target={modal.target}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "markReturned" && (
        <MarkReturnedModal
          request={modal.request}
          onClose={() => setModal(null)}
          onConfirmed={handleSaved}
        />
      )}

      {modal?.kind === "delete" && (
        <AssetDeleteModal
          asset={modal.asset}
          onClose={() => setModal(null)}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}