import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList, ReactNode } from "react";
import { Avatar, Button, TableSkeleton } from "../../components/ui";
import { PageHeading } from "../../components/ui/PageHeading";
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
  PackageOpen,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { ASSET_CATEGORIES, ASSET_CATEGORY_ICONS } from "./assetData";
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

const PANEL_CLASS = "rounded-lg border border-[#E5E7EB] bg-white overflow-hidden shadow-none";

// KPI cards share one row and clip rather than letting large numbers overflow.
const KPI_CARD_CLASS =
  "min-w-0 h-[104px] rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-kpi flex flex-col justify-between";

const FILTER_CONTROL_CLASS =
  "h-8 w-full appearance-none rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 pr-7 text-[12px] font-medium " +
  "text-[#111827] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none cursor-pointer";

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
    return <p className="py-8 px-5 text-center text-xs text-[#9B1C1C]">{error}</p>;
  }

  if (empty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 px-5 text-center min-h-[120px] gap-2">
        <PackageOpen className="w-5 h-5 text-[#7B8794] stroke-[1.5]" />
        <p className="text-xs text-[#6B7280]">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

const assetStatusStyles: Record<AssetStatus, { pill: string; dot: string }> = {
  in_use: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
  available: {
    pill: "bg-[#E8EEFB] text-[#2F5FD0] border border-[#2F5FD0]/20",
    dot: "bg-[#2F5FD0]",
  },
  pending_return: {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  maintenance: {
    pill: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
    dot: "bg-[#7B8794]",
  },
};

const requestStatusStyles: Record<AssetRequestStatus, { pill: string; dot: string }> = {
  pending: {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  },
  approved: {
    pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
    dot: "bg-[#03543F]",
  },
  rejected: {
    pill: "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]",
    dot: "bg-[#9B1C1C]",
  },
};

function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const style = assetStatusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] leading-normal font-medium h-[22px] ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}

function RequestStatusBadge({ status }: { status: AssetRequestStatus }) {
  const style = requestStatusStyles[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] leading-normal font-medium h-[22px] capitalize ${style.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
      {status}
    </span>
  );
}

function PersonAvatar({ name }: { name: string }) {
  return <Avatar name={name} className="!w-8 !h-8 text-[11px] shrink-0" />;
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
      className={`flex items-center justify-between px-6 py-3.5 border-b border-[#E5E7EB] bg-white shrink-0 ${className}`}
    >
      <h3 className="shrink-0 text-[13px] font-semibold text-[#111827]">{title}</h3>
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
      className="shrink-0 whitespace-nowrap text-[12px] font-medium text-[#2F5FD0] hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] rounded"
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
  className = "px-6 py-3 border-t border-[#E5E7EB] bg-white",
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
        <p className="text-[12px] text-[#6B7280]">{summary}</p>
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-wrap items-center justify-between gap-3`}>
      <p className="text-[12px] text-[#6B7280]">{summary}</p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#4B5563] transition hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
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
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold tabular-nums transition cursor-pointer ${entry === page
                ? "border-[#2F5FD0] bg-[#2F5FD0] text-white"
                : "border-[#E5E7EB] text-[#4B5563] hover:bg-[#F0F1EE] hover:text-[#111827]"
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
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] text-[#4B5563] transition hover:bg-[#F0F1EE] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
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

    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < menuHeight && rect.top > menuHeight
        ? rect.top - menuHeight - 4
        : Math.min(
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
      <SectionTitle
        title="Asset Overview"
        action={
          <ViewAllLink
            onClick={onToggleShowAll}
            label={showAll ? "Show Less" : "View All Assets"}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-[#E5E7EB] bg-white">
        <div className="relative w-full sm:flex-1 sm:max-w-[360px] sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Search by name or ID..."
            className="h-8 w-full rounded-[6px] border border-[#E5E7EB] bg-white pl-8 pr-3 text-[12px] text-[#111827] placeholder:text-[#7B8794] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none"
          />
        </div>

        <div className="relative shrink-0">
          <select
            value={categoryFilter}
            onChange={(event) => setFilter("category", event.target.value)}
            aria-label="Filter by category"
            className={`${FILTER_CONTROL_CLASS} w-36`}
          >
            <option value="">All Categories</option>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category.label} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
        </div>

        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={(event) => setFilter("status", event.target.value)}
            aria-label="Filter by status"
            className={`${FILTER_CONTROL_CLASS} w-32`}
          >
            <option value="">All Status</option>
            {ASSET_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {ASSET_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
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
        <div className="overflow-x-auto w-full">
          <table className="min-w-[814px] w-full table-fixed border-collapse text-left text-[12px]">
            <thead>
              <tr className="h-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                <th scope="col" className="w-[84px] whitespace-nowrap pl-4 pr-2 py-0 align-middle font-semibold">Asset ID</th>
                <th scope="col" className="w-[120px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Asset Name</th>
                <th scope="col" className="w-[90px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Category</th>
                <th scope="col" className="min-w-[132px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Brand / Model</th>
                <th scope="col" className="w-[108px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Assigned To</th>
                <th scope="col" className="w-[94px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Issue Date</th>
                <th scope="col" className="w-[114px] whitespace-nowrap px-2 py-0 align-middle font-semibold">Status</th>
                <th scope="col" className="w-[72px] sticky right-0 z-10 bg-[#F9FAFB] border-l border-[#E5E7EB] whitespace-nowrap pl-2 pr-4 py-0 align-middle text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
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
            className="fixed z-50 w-40 rounded-lg border border-[#E5E7EB] bg-white p-1 shadow-lg"
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
  const brandModelText = asset.brand_model ?? "-";

  return (
    <tr className="group h-12 hover:bg-[#F9FAFB] transition-colors">
      <td className="whitespace-nowrap pl-4 pr-2 py-2 text-[12px] font-semibold text-[#2F5FD0] truncate tabular-nums">
        {asset.asset_tag}
      </td>

      <td className="px-2 py-2 text-[12px] truncate">
        <div className="flex items-center gap-2 min-w-0" title={asset.name}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
            <Icon className="h-3.5 w-3.5 shrink-0" />
          </span>
          <span className="font-medium text-[#111827] truncate">{asset.name}</span>
        </div>
      </td>

      <td className="px-2 py-2 text-[12px] text-[#4B5563] truncate" title={asset.category}>
        {asset.category}
      </td>

      <td
        className="px-2 py-2 text-[12px] text-[#4B5563] truncate"
        onMouseEnter={(event) => {
          const el = event.currentTarget;
          el.title = el.scrollWidth > el.clientWidth ? brandModelText : "";
        }}
      >
        {brandModelText}
      </td>

      <td className="px-2 py-2 text-[12px] text-[#4B5563] truncate" title={asset.assigned_to_name ?? "-"}>
        {asset.assigned_to_name ?? "-"}
      </td>

      <td className="whitespace-nowrap px-2 py-2 text-[12px] text-[#4B5563] tabular-nums">
        {formatDate(asset.issue_date)}
      </td>

      <td className="px-2 py-2 text-[12px]">
        <AssetStatusBadge status={asset.status} />
      </td>

      <td className={`w-[72px] sticky right-0 z-10 border-l border-[#E5E7EB] pl-2 pr-4 py-2 text-[12px] text-right ${menuOpen ? "bg-[#F9FAFB]" : "bg-white group-hover:bg-[#F9FAFB]"}`}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(event) => onOpenMenu(event.currentTarget)}
            aria-label="Row actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#4B5563] transition-colors hover:bg-[#F0F1EE] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] cursor-pointer"
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
      className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs font-medium transition cursor-pointer ${tone === "danger"
        ? "text-[#9B1C1C] hover:bg-[#FDE8E8]"
        : "text-[#4B5563] hover:bg-[#F0F1EE] hover:text-[#111827]"
        }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${tone === "danger" ? "text-[#9B1C1C]" : "text-[#6B7280]"}`}
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

      <div className="p-4 flex flex-col sm:flex-row items-center gap-5">
        <div className="shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className="h-[130px] w-[130px] shrink-0"
            role="img"
            aria-label="Asset distribution by category"
          >
            <g transform="translate(80, 80) rotate(-90)">
              <circle
                r={DONUT_RADIUS}
                fill="none"
                stroke="#E5E7EB"
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

            <text x="80" y="76" textAnchor="middle" className="fill-[#111827] text-[22px] font-semibold tabular-nums">
              {total}
            </text>
            <text x="80" y="94" textAnchor="middle" className="fill-[#6B7280] text-[11px] font-medium">
              Total Assets
            </text>
          </svg>
        </div>

        <ul className="min-w-0 flex-1 w-full space-y-1.5">
          {segments.map((segment) => {
            const isZero = segment.count === 0;
            const pct = total > 0 ? ((segment.count / total) * 100).toFixed(1) : "0.0";
            return (
              <li key={segment.label} className="flex h-5 items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span
                    className={`whitespace-nowrap font-medium ${isZero ? "text-[#7B8794]" : "text-[#4B5563]"}`}
                  >
                    {segment.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`w-6 text-right font-semibold tabular-nums text-[12px] ${isZero ? "text-[#7B8794]" : "text-[#111827]"
                      }`}
                  >
                    {segment.count}
                  </span>
                  <span
                    className={`w-11 text-right tabular-nums text-[11px] ${isZero ? "text-[#7B8794]" : "text-[#6B7280]"
                      }`}
                  >
                    {pct}%
                  </span>
                </div>
              </li>
            );
          })}
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
function RecentAllocationPanel({
  version,
  className = "",
}: {
  version: number;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? ALL_ALLOCATIONS_LIMIT : RECENT_ALLOCATION_LIMIT;

  const { data, loading, error } = useAssetQuery<Asset[]>(
    () => assetService.listRecentAllocations(limit),
    [limit, version],
  );

  const allocations = data ?? [];

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col ${className}`}>
      <SectionTitle
        title="Recent Allocation"
        action={
          <ViewAllLink
            onClick={() => setShowAll((previous) => !previous)}
            label={showAll ? "Show Less" : "View All"}
          />
        }
      />

      <div className="p-4 flex-1 flex flex-col">
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
                className="flex items-center gap-3 rounded-lg border border-[#E5E7EB] p-3 hover:bg-[#F9FAFB] transition-colors"
              >
                <PersonAvatar name={asset.assigned_to_name ?? "?"} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#111827]">
                    {asset.assigned_to_name ?? "Unassigned"}
                  </p>
                  <p className="truncate text-[12px] text-[#4B5563]">
                    {asset.asset_tag} - {asset.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B7280] tabular-nums">
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
  onSettings: () => void;
  /** True while the report is being assembled, so the tile can show progress. */
  generatingReport: boolean;
}

function QuickActionsPanel({
  onAdd,
  onAssign,
  onReturn,
  onViewAll,
  onGenerateReport,
  onSettings,
  generatingReport,
}: QuickActionsPanelProps) {
  const actions: QuickAction[] = [
    {
      id: "add",
      label: "Add Asset",
      icon: Plus,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#2563EB]",
      run: onAdd,
    },
    {
      id: "assign",
      label: "Assign Asset",
      icon: UserPlus,
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#059669]",
      run: onAssign,
    },
    {
      id: "return",
      label: "Request Return",
      icon: RotateCcw,
      iconBg: "bg-[#FFFBEB]",
      iconColor: "text-[#D97706]",
      run: onReturn,
    },
    {
      id: "view-all",
      label: "View All Assets",
      icon: Eye,
      iconBg: "bg-[#F5F3FF]",
      iconColor: "text-[#7C3AED]",
      run: onViewAll,
    },
    {
      id: "generate-report",
      label: generatingReport ? "Building..." : "Generate Report",
      icon: BarChart3,
      iconBg: "bg-[#F0FDFA]",
      iconColor: "text-[#0D9488]",
      run: generatingReport ? undefined : onGenerateReport,
      busy: generatingReport,
    },
    {
      id: "settings",
      label: "Asset Settings",
      icon: Settings2,
      iconBg: "bg-[#F1F5F9]",
      iconColor: "text-[#475569]",
      run: onSettings,
    },
  ];

  return (
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col w-full rounded-xl`}>
      <SectionTitle title="Quick Actions" />

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  disabled && action.busy
                    ? "Generating the report"
                    : undefined
                }
                className={`flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] px-4 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5FD0] ${disabled
                  ? `bg-[#F8FAFC] text-[#64748B] cursor-not-allowed ${action.busy ? "animate-pulse" : ""}`
                  : "bg-white text-[#1F2937] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer group"
                  }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.iconBg} ${action.iconColor}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
                <span
                  className={`min-w-0 text-[13px] font-medium leading-tight truncate ${disabled ? "text-[#64748B]" : "text-[#1F2937]"
                    }`}
                >
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
  className = "",
}: {
  version: number;
  onViewAllocation: (target: AllocationDetailTarget) => void;
  className?: string;
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
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col ${className}`}>
      <SectionTitle title="Asset Allocation" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-[#E5E7EB] bg-white">
        <div className="flex items-center gap-1 bg-[#F3F4F6] p-0.5 rounded-lg border border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => {
              setTab("employee");
              setPage(1);
            }}
            className={`h-7 px-3 text-[12px] rounded-md whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] ${tab === "employee"
              ? "bg-white text-[#2F5FD0] border border-[#E5E7EB] font-semibold shadow-xs"
              : "text-[#4B5563] hover:text-[#111827] font-medium"
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
            className={`h-7 px-3 text-[12px] rounded-md whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2F5FD0] ${tab === "department"
              ? "bg-white text-[#2F5FD0] border border-[#E5E7EB] font-semibold shadow-xs"
              : "text-[#4B5563] hover:text-[#111827] font-medium"
              }`}
          >
            By Department
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={tab === "employee" ? "Search employee..." : "Search department..."}
              className="h-8 w-44 rounded-[6px] border border-[#E5E7EB] bg-white pl-8 pr-3 text-[12px] text-[#111827] placeholder:text-[#7B8794] transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0] focus:outline-none"
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
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7B8794]" />
          </div>
        </div>
      </div>

      <PanelState
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyMessage="No records match the current filters."
      >
        <div className="overflow-x-auto flex-1">
          <table className="w-full min-w-[500px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="h-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                {tab === "employee" ? (
                  <>
                    <th scope="col" className="w-[120px] whitespace-nowrap pl-6 pr-3 py-0 align-middle font-semibold">Employee ID</th>
                    <th scope="col" className="whitespace-nowrap px-3 py-0 align-middle font-semibold">Employee Name</th>
                    <th scope="col" className="w-[140px] whitespace-nowrap px-3 py-0 align-middle font-semibold">Assets Assigned</th>
                    <th scope="col" className="w-[80px] whitespace-nowrap pl-3 pr-6 py-0 align-middle text-right font-semibold">View</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="w-[180px] whitespace-nowrap pl-6 pr-3 py-0 align-middle font-semibold">Department</th>
                    <th scope="col" className="w-[110px] whitespace-nowrap px-3 py-0 align-middle font-semibold">Employees</th>
                    <th scope="col" className="w-[140px] whitespace-nowrap px-3 py-0 align-middle font-semibold">Assets Assigned</th>
                    <th scope="col" className="w-[80px] whitespace-nowrap pl-3 pr-6 py-0 align-middle text-right font-semibold">View</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
              {rows.map((row) => (
                <tr key={row.id} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                  {tab === "employee" ? (
                    <>
                      <td className="whitespace-nowrap pl-6 pr-3 py-2.5 font-semibold text-[#2F5FD0] tabular-nums">
                        {row.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-[#111827]">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#4B5563] tabular-nums">{row.asset_count}</td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap pl-6 pr-3 py-2.5 font-semibold text-[#111827]">
                        {row.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#4B5563] tabular-nums">{row.employees}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#4B5563] tabular-nums">{row.asset_count}</td>
                    </>
                  )}

                  <td className="whitespace-nowrap pl-3 pr-6 py-2.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewAllocation({ view: tab, row })}
                      className="h-7 px-2.5 py-0 text-[12px] font-medium shadow-none"
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelState>

      <Pagination
        className="mt-auto px-6 py-3 border-t border-[#E5E7EB] bg-white"
        page={currentPage}
        pageCount={pageCount}
        onPageChange={setPage}
        summary={`Showing ${firstRow} to ${lastRow} of ${total} ${tab === "employee" ? "employees" : "departments"
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
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col h-full`}>
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
        <div className="overflow-x-auto flex-1 flex flex-col">
          <table className="w-full min-w-[590px] table-fixed border-collapse text-left text-[12px]">
            <thead>
              <tr className="h-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                <th scope="col" className="w-[90px] whitespace-nowrap pl-6 pr-3 py-0 align-middle font-semibold">Request ID</th>
                <th scope="col" className="whitespace-nowrap px-3 py-0 align-middle font-semibold">Asset Name</th>
                <th scope="col" className="w-[130px] whitespace-nowrap px-3 py-0 align-middle font-semibold">Employee</th>
                <th scope="col" className="w-[100px] whitespace-nowrap px-3 py-0 align-middle text-right font-semibold">Status</th>
                <th scope="col" className="w-[136px] whitespace-nowrap pl-2 pr-6 py-0 align-middle text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
              {requests.map((request) => (
                <tr key={request.id} className="h-12 hover:bg-[#F9FAFB] transition-colors">
                  <td className="whitespace-nowrap pl-6 pr-3 py-2 text-[12px] font-semibold text-[#2F5FD0] tabular-nums">
                    {request.request_tag}
                  </td>
                  <td className="truncate px-3 py-2 text-[12px] font-medium text-[#111827]" title={request.asset_name}>
                    {request.asset_name}
                  </td>
                  <td className="truncate px-3 py-2 text-[12px] text-[#4B5563]" title={request.employee_name}>
                    {request.employee_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap pl-2 pr-6 py-2 text-right">
                    {canMarkReturned(request) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onConfirmReturn(request)}
                        className="h-7 px-2.5 py-0 text-[12px] font-medium gap-1 text-[#03543F] hover:bg-[#DEF7EC] border-[#BCF0DA] shadow-none"
                        leftIcon={<Check className="w-3.5 h-3.5 shrink-0 text-[#03543F]" />}
                      >
                        Mark Returned
                      </Button>
                    ) : (
                      <span className="text-[12px] text-[#6B7280]">-</span>
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
    <div className={`${PANEL_CLASS} flex min-w-0 flex-col h-full`}>
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
          className="mx-6 mt-4 rounded-lg bg-[#FDE8E8] border border-[#F8B4B4] px-3.5 py-2.5 text-xs text-[#9B1C1C]"
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
        <div className="overflow-x-auto flex-1 flex flex-col">
          <table className="w-full min-w-[590px] table-fixed border-collapse text-left text-[12px]">
            <thead>
              <tr className="h-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                <th scope="col" className="w-[90px] whitespace-nowrap pl-6 pr-3 py-0 align-middle font-semibold">Request</th>
                <th scope="col" className="whitespace-nowrap px-3 py-0 align-middle font-semibold">Asset</th>
                <th scope="col" className="w-[130px] whitespace-nowrap px-3 py-0 align-middle font-semibold">Employee</th>
                <th scope="col" className="w-[100px] whitespace-nowrap px-3 py-0 align-middle text-right font-semibold">Status</th>
                <th scope="col" className="w-[180px] whitespace-nowrap pl-2 pr-6 py-0 align-middle text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="h-12 hover:bg-[#F9FAFB] transition-colors"
                >
                  <td className="whitespace-nowrap pl-6 pr-3 py-2 text-[12px] font-semibold text-[#2F5FD0] tabular-nums">
                    {request.request_tag}
                  </td>
                  <td className="truncate px-3 py-2 text-[12px] font-medium text-[#111827]" title={request.asset_name}>
                    {request.asset_name}
                  </td>
                  <td className="truncate px-3 py-2 text-[12px] text-[#4B5563]" title={request.employee_name}>
                    {request.employee_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap pl-2 pr-6 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => handleReview(request, "approved")}
                        className="h-7 px-2.5 py-0 text-[12px] font-medium gap-1 text-[#03543F] hover:bg-[#DEF7EC] border-[#BCF0DA] shadow-none"
                        leftIcon={<Check className="w-3.5 h-3.5 shrink-0 text-[#03543F]" />}
                      >
                        {busyId === request.id ? "Saving…" : "Approve"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => handleReview(request, "rejected")}
                        className="h-7 px-2.5 py-0 text-[12px] font-medium gap-1 text-[#9B1C1C] hover:bg-[#FDE8E8] border-[#F8B4B4] shadow-none"
                        leftIcon={<X className="w-3.5 h-3.5 shrink-0 text-[#9B1C1C]" />}
                      >
                        Reject
                      </Button>
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
    counts.total ? `${((value / counts.total) * 100).toFixed(1)}% of total` : "0.0% of total";

  const statCards = [
    {
      label: "Total Assets",
      value: formatCount(counts.total),
      note: "↑ 5% from last month",
      noteClass: "text-[#03543F]",
      icon: Laptop,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
    {
      label: "Assigned",
      value: formatCount(counts.assigned),
      note: share(counts.assigned),
      noteClass: "text-[#6B7280]",
      icon: Users,
      iconBg: "bg-[#DEF7EC]",
      iconColor: "text-[#03543F]",
    },
    {
      label: "Available",
      value: formatCount(counts.available),
      note: share(counts.available),
      noteClass: "text-[#6B7280]",
      icon: Package,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#7E22CE]",
    },
    {
      label: "Pending Return",
      value: formatCount(counts.pendingReturn),
      note: share(counts.pendingReturn),
      noteClass: "text-[#6B7280]",
      icon: Clock,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#92400E]",
    },
    {
      label: "Asset Categories",
      value: String(counts.categories),
      note: `${counts.categoriesInUse} of ${counts.categories} in use`,
      noteClass: "text-[#6B7280]",
      icon: FileText,
      iconBg: "bg-[#E8EEFB]",
      iconColor: "text-[#2F5FD0]",
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full pb-10">
      {/* Page Header */}
      <PageHeading title="Track, assign and manage company assets assigned to employees." />

      {statsError && (
        <p className="rounded-lg bg-[#FDE8E8] border border-[#F8B4B4] px-4 py-3 text-xs text-[#9B1C1C]">
          Could not load asset summary: {statsError}
        </p>
      )}

      <NoticePopup notice={notice} onDismiss={dismissNotice} />

      {/* Row 1: KPI cards, 5 equal columns at >=1280px */}
      <div className="flex flex-col gap-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
          Asset Overview
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <div key={card.label} className={KPI_CARD_CLASS}>
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-xs font-medium text-[#4B5563] truncate">
                    {card.label}
                  </span>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${card.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${card.iconColor}`} />
                  </div>
                </div>

                <div>
                  <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
                    {card.value}
                  </span>
                  {card.note && (
                    <span className={`text-[11px] block mt-1 truncate leading-none ${card.noteClass || "text-[#6B7280]"}`}>
                      {card.note}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: ONE grid with two INDEPENDENT stacked columns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-8 flex flex-col gap-4 min-w-0">
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
          <AssetAllocationPanel
            className="flex-1"
            version={version}
            onViewAllocation={(target) => setModal({ kind: "allocation", target })}
          />
        </div>

        <div className="xl:col-span-4 flex flex-col gap-4 min-w-0">
          <AssetCategoriesPanel
            categoryCounts={stats?.category_counts ?? []}
            total={stats?.total_assets ?? 0}
          />
          <RecentAllocationPanel version={version} />
          <QuickActionsPanel
            onAdd={() => setModal({ kind: "form", asset: null })}
            onAssign={() => setModal({ kind: "assign" })}
            onReturn={() => setModal({ kind: "return" })}
            onViewAll={handleViewAllAssets}
            onGenerateReport={handleGenerateReport}
            onSettings={() =>
              setNotice({
                type: "success",
                text: "Asset categories and organization policies can be managed in Settings.",
              })
            }
            generatingReport={generatingReport}
          />
        </div>
      </div>

      {/* Row 3: Asset Issue Requests | Asset Return Requests */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <AssetIssueRequestsPanel
          version={version}
          onReviewed={handleSaved}
        />
        <AssetReturnRequestsPanel
          version={version}
          onConfirmReturn={(request) => setModal({ kind: "markReturned", request })}
        />
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