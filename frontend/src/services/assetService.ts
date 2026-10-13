import { api } from "./api";
import type {
  AllocationRow,
  Asset,
  AssetCategory,
  AssetInput,
  AssetRequest,
  AssetRequestStatus,
  AssetRequestType,
  AssetStatus,
  AssetStats,
  Paginated,
} from "../types/asset";

export interface ListAssetsParams {
  status?: AssetStatus;
  category?: AssetCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AllocationParams {
  view?: "employee" | "department";
  search?: string;
  category?: AssetCategory;
  page?: number;
  limit?: number;
}

export interface ListRequestsParams {
  request_type?: AssetRequestType;
  status?: AssetRequestStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const assetService = {
  getStats() {
    return api.get<AssetStats>("/assets/stats");
  },

  listAssets(params: ListAssetsParams = {}) {
    return api.get<Paginated<Asset>>("/assets", { ...params });
  },

  getAllocation(params: AllocationParams = {}) {
    return api.get<Paginated<AllocationRow>>("/assets/allocation", { ...params });
  },

  listRequests(params: ListRequestsParams = {}) {
    return api.get<Paginated<AssetRequest>>("/assets/requests", { ...params });
  },

  getAsset(id: string) {
    return api.get<Asset>(`/assets/${id}`);
  },

  createAsset(data: AssetInput) {
    return api.post<Asset>("/assets", data);
  },

  updateAsset(id: string, data: Partial<AssetInput>) {
    return api.put<Asset>(`/assets/${id}`, data);
  },

  deleteAsset(id: string) {
    return api.delete<null>(`/assets/${id}`);
  },

  assignAsset(id: string, employeeId: string, issueDate?: string) {
    return api.post<Asset>(`/assets/${id}/assign`, {
      employee_id: employeeId,
      issue_date: issueDate,
    });
  },

  returnAsset(id: string) {
    return api.post<Asset>(`/assets/${id}/return`);
  },

  createRequest(data: {
    request_type: AssetRequestType;
    asset_id: string;
    employee_id: string;
    detail?: string;
    reason?: string;
  }) {
    return api.post<AssetRequest>("/assets/requests", data);
  },

  reviewRequest(id: string, status: AssetRequestStatus, adminNote?: string) {
    return api.patch<AssetRequest>(`/assets/requests/${id}/review`, {
      status,
      admin_note: adminNote,
    });
  },
};