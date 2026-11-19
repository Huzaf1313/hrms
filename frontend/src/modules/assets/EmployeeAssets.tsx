
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

const statusStyle = (status: string) => {
  const value = normalize(status);

  if (value === "approved" || value === "in use") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (value === "rejected" || value === "maintenance") {
    return "bg-red-50 text-red-700";
  }

  if (value === "available" || value === "completed") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-amber-50 text-amber-700";
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
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Employee Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            My Assets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View assigned equipment, request available assets, and track
            requests from your HR team.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Assigned Assets
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {myAllocatedAssets.length}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Laptop size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Pending Requests
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <Clock3 size={23} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Approved Requests
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={23} />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
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
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assets or requests..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1">{error}</p>
              <button
                type="button"
                onClick={() => setError("")}
                className="rounded p-1 hover:bg-red-100"
                aria-label="Dismiss error"
              >
                <XCircle size={17} />
              </button>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1">{success}</p>
              <button
                type="button"
                onClick={() => setSuccess("")}
                className="rounded p-1 hover:bg-emerald-100"
                aria-label="Dismiss success message"
              >
                <XCircle size={17} />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-slate-500">
            <RefreshCw size={25} className="animate-spin text-blue-600" />
            <p className="text-sm">Loading assets...</p>
          </div>
        ) : (
          <>
            {activeTab === "my-assets" && (
              <div className="p-4">
                {myAllocatedAssets.length === 0 ? (
                  <div className="py-14 text-center">
                    <Package
                      className="mx-auto text-slate-300"
                      size={40}
                    />
                    <h3 className="mt-3 font-semibold text-slate-800">
                      No assigned assets found
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your assigned equipment will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("request-asset")}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      <ArrowUpRight size={16} />
                      Request an asset
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {myAllocatedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                              <Laptop size={22} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="break-words font-semibold text-slate-900">
                                {asset.name}
                              </h3>
                              <p className="mt-1 text-xs text-slate-500">
                                {asset.asset_tag}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(
                              asset.status,
                            )}`}
                          >
                            {normalize(asset.status)}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Category</span>
                            <span className="text-right font-medium text-slate-700">
                              {asset.category || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Brand / Model</span>
                            <span className="text-right font-medium text-slate-700">
                              {asset.brand_model || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Serial Number</span>
                            <span className="break-all text-right font-medium text-slate-700">
                              {asset.serial_number || "—"}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Issue Date</span>
                            <span className="text-right font-medium text-slate-700">
                              {asset.issue_date
                                ? new Date(
                                    asset.issue_date,
                                  ).toLocaleDateString()
                                : "—"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          For returns, please follow the return request issued
                          by HR/Admin/Manager and hand over the asset as
                          instructed.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "request-asset" && (
              <div className="space-y-4 p-4">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Available inventory
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose an available asset to submit an issue request.
                  </p>
                </div>

                {filteredAvailableAssets.length === 0 ? (
                  <div className="py-12 text-center">
                    <Package
                      className="mx-auto text-slate-300"
                      size={38}
                    />
                    <p className="mt-3 font-medium text-slate-700">
                      No available assets found
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
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
                        className={`rounded-xl border p-4 text-left transition ${
                          selectedAsset === asset.id
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {asset.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {asset.asset_tag}
                            </p>
                          </div>
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Available
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                          {asset.category}
                          {asset.brand_model
                            ? ` · ${asset.brand_model}`
                            : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-w-xl space-y-3 border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Reason / details (optional)
                    <textarea
                      value={requestDetail}
                      onChange={(event) =>
                        setRequestDetail(event.target.value)
                      }
                      rows={3}
                      placeholder="Explain why you need this asset..."
                      className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!selectedAsset || submitting}
                    onClick={() => void submitRequest()}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowUpRight size={17} />
                    {submitting ? "Submitting..." : "Submit asset request"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "my-requests" && (
              <div className="p-4">
                {filteredRequests.length === 0 ? (
                  <div className="py-14 text-center">
                    <Package
                      className="mx-auto text-slate-300"
                      size={40}
                    />
                    <h3 className="mt-3 font-semibold text-slate-800">
                      No requests found
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Your asset issue requests and return requests issued by
                      HR/Admin/Manager will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-3 font-semibold">Request</th>
                          <th className="px-3 py-3 font-semibold">Asset</th>
                          <th className="px-3 py-3 font-semibold">Type</th>
                          <th className="px-3 py-3 font-semibold">Date</th>
                          <th className="px-3 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRequests.map((request) => (
                          <tr
                            key={request.id}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-3 py-4 font-medium text-slate-900">
                              {request.request_tag}
                            </td>
                            <td className="px-3 py-4">
                              <p className="font-medium text-slate-800">
                                {request.asset_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {request.asset_tag}
                              </p>
                            </td>
                            <td className="px-3 py-4 capitalize text-slate-600">
                              {normalize(request.request_type)}
                            </td>
                            <td className="px-3 py-4 text-slate-600">
                              {request.created_at
                                ? new Date(
                                    request.created_at,
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(
                                  request.status,
                                )}`}
                              >
                                {normalize(request.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
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
