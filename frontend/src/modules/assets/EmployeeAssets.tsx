
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Laptop,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { assetService } from "./assetService";
import type { Asset, AssetRequest } from "./types";

type Tab = "my-assets" | "request-asset" | "my-requests";

const normalize = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[_-]/g, " ").trim();

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const err = error as {
      response?: {
        data?: {
          detail?: unknown;
          message?: string;
        };
      };
      detail?: unknown;
      message?: string;
    };

    const detail = err.response?.data?.detail ?? err.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          typeof item === "object" && item !== null && "msg" in item
            ? String(item.msg)
            : String(item)
        )
        .join(", ");
    }

    if (err.response?.data?.message) {
      return err.response.data.message;
    }

    if (err.message) {
      return err.message;
    }
  }

  return "Something went wrong. Please try again.";
};

const statusStyle = (status: string): { pill: string; dot: string } => {
  const value = normalize(status);

  if (value === "approved" || value === "in use") {
    return {
      pill: "bg-[#DEF7EC] text-[#03543F] border border-[#BCF0DA]",
      dot: "bg-[#03543F]",
    };
  }

  if (value === "rejected" || value === "maintenance") {
    return {
      pill: "bg-[#FDE8E8] text-[#9B1C1C] border border-[#F8B4B4]",
      dot: "bg-[#9B1C1C]",
    };
  }

  if (value === "available" || value === "completed") {
    return {
      pill: "bg-[#E8EEFB] text-[#2F5FD0] border border-[#2F5FD0]/20",
      dot: "bg-[#2F5FD0]",
    };
  }

  return {
    pill: "bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]",
    dot: "bg-[#92400E]",
  };
};

/**
 * Supports Axios responses and API envelopes such as:
 * { success, message, data: { items: [...] } }
 * { data: { items: [...] } }
 * { data: [...] }
 * { items: [...] }
 */
const extractItems = <T,>(response: unknown): T[] => {
  if (!response || typeof response !== "object") {
    return [];
  }

  if (Array.isArray(response)) {
    return response as T[];
  }

  const root = response as {
    data?: unknown;
    items?: unknown;
  };

  if (Array.isArray(root.items)) {
    return root.items as T[];
  }

  if (root.data && typeof root.data === "object") {
    const data = root.data as {
      data?: unknown;
      items?: unknown;
    };

    if (Array.isArray(data.items)) {
      return data.items as T[];
    }

    if (Array.isArray(data.data)) {
      return data.data as T[];
    }

    if (data.data && typeof data.data === "object") {
      const nested = data.data as { items?: unknown };

      if (Array.isArray(nested.items)) {
        return nested.items as T[];
      }
    }
  }

  return [];
};

export default function EmployeeAssets() {
  const [activeTab, setActiveTab] = useState<Tab>("my-assets");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [requestDetail, setRequestDetail] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [myAssetsResponse, availableResponse, requestResponse] =
        await Promise.all([
          assetService.listAssets(),
          assetService.listAssets({ status: "available" }),
          assetService.listRequests(),
        ]);

      const allAssets = extractItems<Asset>(myAssetsResponse);
      const availableInventory = extractItems<Asset>(availableResponse);
      const employeeRequests = extractItems<AssetRequest>(requestResponse);

      // The backend must scope the employee's asset list to their account.
      setAssets(allAssets);

      // Only assets explicitly marked available can be requested.
      setAvailableAssets(
        availableInventory.filter(
          (asset) => normalize(asset.status) === "available",
        ),
      );

      // Includes issue requests and any return requests issued by HR/Admin/Manager,
      // provided the backend's listRequests endpoint returns them to this employee.
      setRequests(employeeRequests);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) =>
        [
          asset.name,
          asset.asset_tag,
          asset.category,
          asset.brand_model,
          asset.serial_number,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [assets, search],
  );

  const filteredAvailableAssets = useMemo(
    () =>
      availableAssets.filter((asset) => {
        const matchesStatus = normalize(asset.status) === "available";

        const matchesSearch = [
          asset.name,
          asset.asset_tag,
          asset.category,
          asset.brand_model,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase());

        return matchesStatus && matchesSearch;
      }),
    [availableAssets, search],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) =>
        [
          request.request_tag,
          request.asset_name,
          request.asset_tag,
          request.request_type,
          request.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [requests, search],
  );

  const submitRequest = async () => {
    if (!selectedAsset) {
      setError("Please select an asset first.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const asset = availableAssets.find(
        (item) => item.id === selectedAsset,
      );

      if (!asset) {
        throw new Error(
          "The selected asset could not be found. Refresh and try again.",
        );
      }

      if (normalize(asset.status) !== "available") {
        throw new Error(
          "This asset is no longer available. Refresh the page and try again.",
        );
      }

      await assetService.createRequest({
        request_type: "issue",
        asset_id: selectedAsset,
        detail: requestDetail.trim() || undefined,
        reason: requestDetail.trim() || undefined,
      });

      setSuccess("Asset request submitted successfully.");
      setSelectedAsset("");
      setRequestDetail("");
      setSearch("");

      await loadData();
      setActiveTab("my-requests");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const myAllocatedAssets = filteredAssets.filter(
    (asset) =>
      Boolean(asset.assigned_to_employee_id) &&
      normalize(asset.status) !== "available",
  );

  const pendingCount = requests.filter(
    (request) => normalize(request.status) === "pending",
  ).length;

  const approvedCount = requests.filter(
    (request) => normalize(request.status) === "approved",
  ).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "my-assets", label: "My Assets" },
    { id: "request-asset", label: "Request an Asset" },
    { id: "my-requests", label: "My Requests" },
  ];

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-lg border border-[#E5E7EB] shadow-none">
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
            Employee Portal
          </p>
          <h1 className="text-[18px] font-semibold text-[#111827]">
            My Assets
          </h1>
          <p className="text-xs text-[#4B5563]">
            View assigned equipment, request available assets, and track
            requests from your HR team.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={loading}
          leftIcon={
            <RefreshCw
              className={`h-3.5 w-3.5 shrink-0 ${loading ? "animate-spin" : ""}`}
            />
          }
          className="h-8 px-3 rounded-[6px] text-[12px] font-medium shadow-none shrink-0"
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 h-[104px] shadow-kpi flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-[#4B5563] truncate">
              Assigned Assets
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
              <Laptop className="h-4 w-4 shrink-0" />
            </div>
          </div>
          <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
            {myAllocatedAssets.length}
          </span>
        </div>

        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 h-[104px] shadow-kpi flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-[#4B5563] truncate">
              Pending Requests
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#FEF3C7] text-[#92400E]">
              <Clock3 className="h-4 w-4 shrink-0" />
            </div>
          </div>
          <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
            {pendingCount}
          </span>
        </div>

        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4 h-[104px] shadow-kpi flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs font-medium text-[#4B5563] truncate">
              Approved Requests
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#DEF7EC] text-[#03543F]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            </div>
          </div>
          <span className="text-[24px] font-semibold text-[#111827] tabular-nums tracking-tight leading-none block">
            {approvedCount}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-none">
        <div className="border-b border-[#E5E7EB] px-6 pt-1 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] lg:border-b-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearch("");
                    setError("");
                    setSuccess("");
                  }}
                  className={`px-3.5 py-2.5 text-[13px] font-medium transition-colors cursor-pointer border-b-2 -mb-[1px] whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-[#2F5FD0] text-[#2F5FD0]"
                      : "border-transparent text-[#4B5563] hover:text-[#111827] hover:border-[#D1D5DB]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7B8794]"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assets or requests..."
                className="h-8 w-full rounded-[6px] border border-[#E5E7EB] bg-white pl-8 pr-3 text-[12px] text-[#111827] placeholder:text-[#7B8794] outline-none transition hover:border-[#D1D5DB] focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#F8B4B4] bg-[#FDE8E8] p-3 text-xs text-[#9B1C1C]">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1">{error}</p>
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded p-0.5 hover:bg-[#F8B4B4]/40 cursor-pointer"
                aria-label="Dismiss error"
              >
                <XCircle size={15} />
              </button>
            </div>
          )}

          {success && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#BCF0DA] bg-[#DEF7EC] p-3 text-xs text-[#03543F]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <p className="flex-1">{success}</p>
              <button
                type="button"
                onClick={() => setSuccess("")}
                className="rounded p-0.5 hover:bg-[#BCF0DA]/50 cursor-pointer"
                aria-label="Dismiss success message"
              >
                <XCircle size={15} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-[#6B7280]">
            <RefreshCw size={22} className="animate-spin text-[#2F5FD0]" />
            <p className="text-xs">Loading assets...</p>
          </div>
        ) : (
          <>
            {activeTab === "my-assets" && (
              <div className="p-6">
                {myAllocatedAssets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package
                      className="mx-auto text-[#7B8794]"
                      size={32}
                    />
                    <h3 className="mt-3 text-[13px] font-semibold text-[#111827]">
                      No assigned assets found
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Your assigned equipment will appear here.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveTab("request-asset")}
                      leftIcon={<ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
                      className="mt-4 h-8 px-3.5 rounded-[6px] text-[12px] font-medium shadow-none"
                    >
                      Request an asset
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {myAllocatedAssets.map((asset) => {
                      const badge = statusStyle(asset.status);
                      return (
                        <div
                          key={asset.id}
                          className="rounded-lg border border-[#E5E7EB] p-4 transition hover:border-[#D1D5DB]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFB] text-[#2F5FD0]">
                                <Laptop className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="break-words text-[13px] font-semibold text-[#111827]">
                                  {asset.name}
                                </h3>
                                <p className="mt-0.5 text-[11px] tabular-nums text-[#6B7280]">
                                  {asset.asset_tag}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] leading-normal font-medium h-5 capitalize ${badge.pill}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                              {normalize(asset.status)}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 text-[12px]">
                            <div className="flex justify-between gap-3">
                              <span className="text-[#6B7280]">Category</span>
                              <span className="text-right font-medium text-[#111827]">
                                {asset.category || "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-[#6B7280]">Brand / Model</span>
                              <span className="text-right font-medium text-[#111827]">
                                {asset.brand_model || "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-[#6B7280]">Serial Number</span>
                              <span className="break-all text-right font-medium text-[#111827]">
                                {asset.serial_number || "—"}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-[#6B7280]">Issue Date</span>
                              <span className="text-right font-medium tabular-nums text-[#111827]">
                                {asset.issue_date
                                  ? new Date(
                                      asset.issue_date,
                                    ).toLocaleDateString()
                                  : "—"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-[11px] text-[#4B5563]">
                            For returns, please follow the return request issued
                            by HR/Admin/Manager and hand over the asset as
                            instructed.
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "request-asset" && (
              <div className="space-y-4 p-6">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#111827]">
                    Available inventory
                  </h3>
                  <p className="mt-0.5 text-xs text-[#4B5563]">
                    Choose an available asset to submit an issue request.
                  </p>
                </div>

                {filteredAvailableAssets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package
                      className="mx-auto text-[#7B8794]"
                      size={32}
                    />
                    <p className="mt-3 text-[13px] font-medium text-[#111827]">
                      No available assets found
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Check back later or contact your HR team.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {filteredAvailableAssets.map((asset) => (
                      <button
                        type="button"
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset.id)}
                        className={`rounded-lg border p-4 text-left transition cursor-pointer ${
                          selectedAsset === asset.id
                            ? "border-[#2F5FD0] bg-[#E8EEFB] ring-1 ring-[#2F5FD0]"
                            : "border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827]">
                              {asset.name}
                            </p>
                            <p className="mt-0.5 text-[11px] tabular-nums text-[#6B7280]">
                              {asset.asset_tag}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2F5FD0]/20 bg-[#E8EEFB] px-2.5 py-0.5 text-[11px] leading-normal font-medium h-5 text-[#2F5FD0]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2F5FD0] shrink-0" />
                            Available
                          </span>
                        </div>
                        <p className="mt-2.5 text-xs text-[#4B5563]">
                          {asset.category}
                          {asset.brand_model
                            ? ` · ${asset.brand_model}`
                            : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-w-xl space-y-3 border-t border-[#E5E7EB] pt-4">
                  <label className="block text-[12px] font-medium text-[#4B5563]">
                    Reason / details (optional)
                    <textarea
                      value={requestDetail}
                      onChange={(event) =>
                        setRequestDetail(event.target.value)
                      }
                      rows={3}
                      placeholder="Explain why you need this asset..."
                      className="mt-1.5 w-full rounded-[6px] border border-[#E5E7EB] bg-white p-3 text-[13px] text-[#111827] placeholder:text-[#7B8794] outline-none focus:border-[#2F5FD0] focus:ring-1 focus:ring-[#2F5FD0]"
                    />
                  </label>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedAsset || submitting}
                    isLoading={submitting}
                    onClick={() => void submitRequest()}
                    leftIcon={<ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
                    className="h-9 px-4 rounded-[6px] text-[13px] font-medium shadow-none"
                  >
                    {submitting ? "Submitting..." : "Submit asset request"}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "my-requests" && (
              <div>
                {filteredRequests.length === 0 ? (
                  <div className="py-12 px-6 text-center">
                    <Package
                      className="mx-auto text-[#7B8794]"
                      size={32}
                    />
                    <h3 className="mt-3 text-[13px] font-semibold text-[#111827]">
                      No requests found
                    </h3>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Your asset issue requests and return requests issued by
                      HR/Admin/Manager will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] border-collapse text-left text-[12px]">
                      <thead>
                        <tr className="h-10 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wider text-[#4B5563]">
                          <th className="px-6 py-0 align-middle font-semibold">Request</th>
                          <th className="px-4 py-0 align-middle font-semibold">Asset</th>
                          <th className="px-4 py-0 align-middle font-semibold">Type</th>
                          <th className="px-4 py-0 align-middle font-semibold">Date</th>
                          <th className="px-6 py-0 align-middle font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
                        {filteredRequests.map((request) => {
                          const badge = statusStyle(request.status);
                          return (
                            <tr
                              key={request.id}
                              className="h-12 hover:bg-[#F9FAFB] transition-colors"
                            >
                              <td className="px-6 py-2.5 font-semibold text-[#2F5FD0] tabular-nums">
                                {request.request_tag}
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-[#111827]">
                                  {request.asset_name}
                                </p>
                                <p className="mt-0.5 text-[11px] tabular-nums text-[#6B7280]">
                                  {request.asset_tag}
                                </p>
                              </td>
                              <td className="px-4 py-2.5 capitalize text-[#4B5563]">
                                {normalize(request.request_type)}
                              </td>
                              <td className="px-4 py-2.5 tabular-nums text-[#4B5563]">
                                {request.created_at
                                  ? new Date(
                                      request.created_at,
                                    ).toLocaleDateString()
                                  : "—"}
                              </td>
                              <td className="px-6 py-2.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] leading-normal font-medium h-5 capitalize ${badge.pill}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${badge.dot}`} />
                                  {normalize(request.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
