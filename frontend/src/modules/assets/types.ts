export type AssetStatus = "in_use" | "available" | "pending_return" | "maintenance";

export type AssetRequestStatus = "pending" | "approved" | "rejected";

export type AssetRequestType = "issue" | "return";

/** Wire values are the human labels the API uses as the category key. */
export type AssetCategory =
  | "Laptop"
  | "Mobile"
  | "Monitor"
  | "Accessories"
  | "Furniture"
  | "Electronics"
  | "Software"
  | "Others";

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_use: "In Use",
  available: "Available",
  pending_return: "Pending Return",
  maintenance: "Maintenance",
};

/** Order fixes the status filter options. The donut uses the API's order. */
export const ASSET_STATUS_ORDER: AssetStatus[] = [
  "in_use",
  "available",
  "pending_return",
  "maintenance",
];

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  category: AssetCategory;
  brand_model: string | null;
  serial_number: string | null;
  status: AssetStatus;
  assigned_to_employee_id: string | null;
  assigned_to_name: string | null;
  department_id: string | null;
  department_name: string | null;
  issue_date: string | null;
  returned_at: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  vendor: string | null;
  warranty_expiry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetInput {
  name: string;
  category: AssetCategory;
  brand_model?: string;
  serial_number?: string;
  status?: AssetStatus;
  purchase_date?: string;
  purchase_cost?: number;
  vendor?: string;
  warranty_expiry?: string;
  notes?: string;
}

/**
 * One row of the allocation table. The employee tab fills `department`, the
 * department tab fills `employees`; both fill `asset_count`.
 */
export interface AllocationRow {
  id: string;
  name: string;
  department: string | null;
  employees: number;
  asset_count: number;
}

export interface AssetRequest {
  id: string;
  request_tag: string;
  request_type: AssetRequestType;
  asset_id: string | null;
  asset_tag: string | null;
  asset_name: string;
  employee_id: string;
  employee_name: string;
  detail: string | null;
  reason: string | null;
  status: AssetRequestStatus;
  /** Live state of the referenced asset, so the UI knows if a return can be completed. */
  asset_status: AssetStatus | null;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CategoryCount {
  category: AssetCategory;
  count: number;
  percentage: number;
}

/**
 * Figures behind the KPI cards, plus the donut's breakdown. Both come from one
 * endpoint so the cards and the chart can never disagree.
 */
export interface AssetStats {
  total_assets: number;
  in_use: number;
  available: number;
  pending_return: number;
  maintenance: number;
  total_purchase_value: number;
  pending_requests: number;
  allocated_this_month: number;
  category_counts: CategoryCount[];
}