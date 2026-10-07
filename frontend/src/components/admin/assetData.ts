/**
 * Asset Management is built frontend-only for now, so every value below is a
 * deterministic placeholder. Each shape maps 1:1 to the endpoint that will
 * eventually back it, so swapping a placeholder for a live fetch means replacing
 * the constant below and nothing else.
 *
 * The asset list is generated rather than hand-written so the summary cards,
 * the category donut and the allocation table all agree on the same numbers.
 */
import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Package,
  Projector,
  Smartphone,
} from "lucide-react";

export type AssetStatus = "in_use" | "available" | "pending_return" | "maintenance";

export type AssetRequestStatus = "pending" | "approved" | "rejected";

export interface Asset {
  id: string;
  name: string;
  category: string;
  brandModel: string;
  /** null when the asset sits in the store and has no holder yet. */
  assignedToId: string | null;
  assignedToName: string | null;
  /** null for assets that were never issued. */
  issueDate: string | null;
  status: AssetStatus;
}

export interface AssetCategory {
  label: string;
  color: string;
  icon: LucideIcon;
  products: string[];
  brands: string[];
}

export interface Employee {
  id: string;
  name: string;
  department: string;
}

export interface AssetRequest {
  id: string;
  type: "Issue Request" | "Return Request";
  detail: string;
  employeeId: string;
  employeeName: string;
  requestDate: string;
  status: AssetRequestStatus;
}

export interface ReturnRequest {
  id: string;
  assetName: string;
  employeeName: string;
  requestDate: string;
  status: AssetRequestStatus;
}

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_use: "In Use",
  available: "Available",
  pending_return: "Pending Return",
  maintenance: "Maintenance",
};

/** Order fixes the donut slices and the "All Status" filter options. */
export const ASSET_STATUS_ORDER: AssetStatus[] = [
  "in_use",
  "available",
  "pending_return",
  "maintenance",
];

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    label: "Laptop",
    color: "#2563eb",
    icon: Laptop,
    products: [
      'Dell Laptop (15.6")',
      'MacBook Pro (14")',
      "HP EliteBook 840",
      "Lenovo ThinkPad X1",
      "Acer Aspire 5",
    ],
    brands: [
      "Dell / Inspiron 15",
      "Apple / MacBook Pro 14",
      "HP / EliteBook 840",
      "Lenovo / ThinkPad X1",
      "Acer / Aspire 5",
    ],
  },
  {
    label: "Mobile",
    color: "#10b981",
    icon: Smartphone,
    products: [
      "Mobile Phone (iPhone 14)",
      "Mobile Phone (Galaxy S23)",
      "Mobile Phone (Pixel 7a)",
      "Mobile Phone (OnePlus 11)",
    ],
    brands: [
      "Apple / iPhone 14",
      "Samsung / Galaxy S23",
      "Google / Pixel 7a",
      "OnePlus / OnePlus 11",
    ],
  },
  {
    label: "Monitor",
    color: "#f59e0b",
    icon: Monitor,
    products: ['Dell Monitor (24")', 'LG Monitor (27")', 'HP Monitor (22")', 'ViewSonic Monitor (24")'],
    brands: ["Dell / P2422H", "LG / 27UP850", "HP / V22", "ViewSonic / VA2447"],
  },
  {
    label: "Accessories",
    color: "#ef4444",
    icon: Keyboard,
    products: ["Keyboard", "LOGITECH Mouse", "Headset", "Webcam", "Docking Station", "USB Hub"],
    brands: [
      "Logitech / K120",
      "Logitech / M350",
      "Jabra / Evolve 20",
      "Logitech / C920",
      "Kensington / K362",
      "Anker / USB-C Hub",
    ],
  },
  {
    label: "Furniture",
    color: "#22c55e",
    icon: Armchair,
    products: ["Office Chair", "Study Table", "Cabinet", "Standing Desk"],
    brands: ["Nilkamal / Ergonomic", "Godrej / Compact", "Steelcase / Ledger", "IKEA / Karlby"],
  },
  {
    label: "Electronics",
    color: "#06b6d4",
    icon: Projector,
    products: ["Projector", "Conference Speaker", "Whiteboard", "Camera"],
    brands: ["Epson / EB-X41", "Jabra / Confluence", "Staedtler / Lumos", "Logitech / Rally"],
  },
  {
    label: "Software",
    color: "#475569",
    icon: Package,
    products: [
      "Windows 11 Pro (License)",
      "Microsoft 365 (License)",
      "Adobe CC (License)",
      "Figma (License)",
      "Antivirus (1 Year)",
    ],
    brands: ["Microsoft / Windows", "Microsoft / M365", "Adobe / CC", "Figma / Org", "Kaspersky / Std"],
  },
  {
    label: "Others",
    color: "#a855f7",
    icon: Headphones,
    products: ["ID Card Printer", "First Aid Kit", "Fire Extinguisher", "Coffee Vending Pass"],
    brands: ["Evolve / IDCP", "Medline / FA-12", "Kidde / KS-10", "Refresh / Pass"],
  },
];

/** Count of assets per category, matching the split in the design. */
const CATEGORY_COUNTS: Record<string, number> = {
  Laptop: 28,
  Mobile: 22,
  Monitor: 18,
  Accessories: 16,
  Furniture: 12,
  Electronics: 10,
  Software: 8,
  Others: 6,
};

export const ASSET_EMPLOYEES: Employee[] = [
  { id: "EMP001", name: "Rahul Sharma", department: "Engineering" },
  { id: "EMP002", name: "Priya Singh", department: "Sales" },
  { id: "EMP003", name: "Vikash Patel", department: "HR" },
  { id: "EMP004", name: "Neha Verma", department: "Finance" },
  { id: "EMP005", name: "Amit Kumar", department: "Marketing" },
  { id: "EMP006", name: "Karan Singh", department: "Operations" },
  { id: "EMP007", name: "Sneha Patel", department: "Engineering" },
  { id: "EMP008", name: "Pooja Sharma", department: "Finance" },
  { id: "EMP009", name: "Rahul Mehra", department: "Sales" },
  { id: "EMP010", name: "Anjali Rao", department: "Marketing" },
  { id: "EMP011", name: "Manish Gupta", department: "Operations" },
  { id: "EMP012", name: "Divya Nair", department: "Engineering" },
  { id: "EMP013", name: "Arjun Reddy", department: "HR" },
  { id: "EMP014", name: "Kavita Joshi", department: "Finance" },
  { id: "EMP015", name: "Rohan Das", department: "Sales" },
  { id: "EMP016", name: "Meera Iyer", department: "Marketing" },
  { id: "EMP017", name: "Sanjay Kapoor", department: "Operations" },
  { id: "EMP018", name: "Tanya Bhatt", department: "Engineering" },
  { id: "EMP019", name: "Nikhil Jain", department: "HR" },
  { id: "EMP020", name: "Riya Malhotra", department: "Finance" },
  { id: "EMP021", name: "Aditya Menon", department: "Sales" },
  { id: "EMP022", name: "Shreya Bose", department: "Marketing" },
  { id: "EMP023", name: "Vinay Joshi", department: "Operations" },
  { id: "EMP024", name: "Ankit Chauhan", department: "Engineering" },
];

export const ASSET_DEPARTMENTS: string[] = Array.from(
  new Set(ASSET_EMPLOYEES.map((employee) => employee.department)),
);

/** Linear congruential generator so the placeholder list is stable per reload. */
function createRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

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

/** Anchor for the generated issue dates; the seeded rows use explicit dates. */
const REFERENCE_DATE = new Date(2025, 4, 19);

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** In-place Fisher-Yates, so every mount produces the same ordering. */
function shuffle<T>(items: T[], random: () => number): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

/** The rows the design shows on first paint, kept verbatim. */
const SEED_ASSETS: Asset[] = [
  {
    id: "AST-001",
    name: 'Dell Laptop (15.6")',
    category: "Laptop",
    brandModel: "Dell / Inspiron 15",
    assignedToId: "EMP001",
    assignedToName: "Rahul Sharma",
    issueDate: "10 Apr 2025",
    status: "in_use",
  },
  {
    id: "AST-002",
    name: "LOGITECH Mouse",
    category: "Accessories",
    brandModel: "Logitech / M350",
    assignedToId: "EMP002",
    assignedToName: "Priya Singh",
    issueDate: "10 Apr 2025",
    status: "in_use",
  },
  {
    id: "AST-003",
    name: 'Dell Monitor (24")',
    category: "Monitor",
    brandModel: "Dell / P2422H",
    assignedToId: "EMP003",
    assignedToName: "Vikash Patel",
    issueDate: "12 Jan 2025",
    status: "in_use",
  },
  {
    id: "AST-004",
    name: "Office Chair",
    category: "Furniture",
    brandModel: "Nilkamal / Ergonomic",
    assignedToId: "EMP004",
    assignedToName: "Neha Verma",
    issueDate: "05 Aug 2024",
    status: "in_use",
  },
  {
    id: "AST-005",
    name: "Mobile Phone (iPhone 14)",
    category: "Mobile",
    brandModel: "Apple / iPhone 14",
    assignedToId: "EMP005",
    assignedToName: "Amit Kumar",
    issueDate: "05 Aug 2024",
    status: "pending_return",
  },
  {
    id: "AST-006",
    name: "Keyboard",
    category: "Accessories",
    brandModel: "Logitech / K120",
    assignedToId: null,
    assignedToName: null,
    issueDate: null,
    status: "available",
  },
  {
    id: "AST-007",
    name: "Projector",
    category: "Electronics",
    brandModel: "Epson / EB-X41",
    assignedToId: null,
    assignedToName: null,
    issueDate: null,
    status: "available",
  },
  {
    id: "AST-008",
    name: "Headset",
    category: "Accessories",
    brandModel: "Jabra / Evolve 20",
    assignedToId: null,
    assignedToName: null,
    issueDate: null,
    status: "maintenance",
  },
];

/** Totals the summary cards quote, chosen so every card reconciles. */
const TARGET_STATUS_COUNTS: Record<AssetStatus, number> = {
  in_use: 94,
  available: 18,
  pending_return: 4,
  maintenance: 4,
};

function buildPlaceholderAssets(): Asset[] {
  const random = createRandom(20250519);

  const seededCounts = SEED_ASSETS.reduce<Record<AssetStatus, number>>(
    (counts, asset) => {
      counts[asset.status] = (counts[asset.status] ?? 0) + 1;
      return counts;
    },
    { in_use: 0, available: 0, pending_return: 0, maintenance: 0 },
  );

  // One pool per status, then shuffled so the seeded rows do not leave the
  // remaining ones clustered at the end of the table.
  const statusPool: AssetStatus[] = ASSET_STATUS_ORDER.flatMap((status) =>
    Array.from(
      { length: Math.max(0, TARGET_STATUS_COUNTS[status] - seededCounts[status]) },
      () => status,
    ),
  );

  const seededCategoryCounts = SEED_ASSETS.reduce<Record<string, number>>(
    (counts, asset) => {
      counts[asset.category] = (counts[asset.category] ?? 0) + 1;
      return counts;
    },
    // Zeroed first, otherwise `undefined + 1` makes the missing keys NaN.
    Object.fromEntries(ASSET_CATEGORIES.map((category) => [category.label, 0])),
  );

  const categoryPool: string[] = ASSET_CATEGORIES.flatMap((category) =>
    Array.from(
      {
        length: Math.max(
          0,
          (CATEGORY_COUNTS[category.label] ?? 0) -
            (seededCategoryCounts[category.label] ?? 0),
        ),
      },
      () => category.label,
    ),
  );

  shuffle(statusPool, random);
  shuffle(categoryPool, random);

  // Only issued assets can carry a holder; drop holders from the surplus.
  const issuedStatuses = new Set<AssetStatus>(["in_use", "pending_return"]);

  return [
    ...SEED_ASSETS,
    ...statusPool.map((status, index) => {
      const category = ASSET_CATEGORIES.find(
        (entry) => entry.label === categoryPool[index],
      ) as AssetCategory;
      const productIndex = Math.floor(random() * category.products.length);
      const holder = ASSET_EMPLOYEES[Math.floor(random() * ASSET_EMPLOYEES.length)];
      const hasHolder = issuedStatuses.has(status) && random() > 0.08;
      const issuedDaysAgo = 20 + Math.floor(random() * 420);
      const issueDate = new Date(
        REFERENCE_DATE.getTime() - issuedDaysAgo * 24 * 60 * 60 * 1000,
      );

      return {
        id: `AST-${String(index + SEED_ASSETS.length + 1).padStart(3, "0")}`,
        name: category.products[productIndex],
        category: category.label,
        brandModel: category.brands[productIndex],
        assignedToId: hasHolder ? holder.id : null,
        assignedToName: hasHolder ? holder.name : null,
        issueDate: hasHolder ? formatDate(issueDate) : null,
        status,
      };
    }),
  ];
}

export const assetPlaceholders: Asset[] = buildPlaceholderAssets();

export const assetCategoryPlaceholders = ASSET_CATEGORIES.map((category) => ({
  label: category.label,
  color: category.color,
  count: assetPlaceholders.filter((asset) => asset.category === category.label).length,
}));

export const recentAssetRequests: AssetRequest[] = [
  {
    id: "REQ-001",
    type: "Issue Request",
    detail: "Laptop (Dell)",
    employeeId: "EMP001",
    employeeName: "Rahul Sharma",
    requestDate: "19 May 2025",
    status: "pending",
  },
  {
    id: "REQ-002",
    type: "Issue Request",
    detail: "Headset (Jabra)",
    employeeId: "EMP002",
    employeeName: "Priya Singh",
    requestDate: "18 May 2025",
    status: "approved",
  },
  {
    id: "REQ-003",
    type: "Return Request",
    detail: "Monitor (Dell)",
    employeeId: "EMP003",
    employeeName: "Vikash Patel",
    requestDate: "16 May 2025",
    status: "pending",
  },
];

export const assetReturnRequests: ReturnRequest[] = [
  {
    id: "RET-001",
    assetName: "Mobile Phone",
    employeeName: "Amit Kumar",
    requestDate: "18 May 2025",
    status: "pending",
  },
  {
    id: "RET-002",
    assetName: "Laptop",
    employeeName: "Rahul Mehra",
    requestDate: "17 May 2025",
    status: "pending",
  },
  {
    id: "RET-003",
    assetName: "Monitor",
    employeeName: "Sneha Patel",
    requestDate: "16 May 2025",
    status: "approved",
  },
  {
    id: "RET-004",
    assetName: "Headset",
    employeeName: "Karan Singh",
    requestDate: "15 May 2025",
    status: "rejected",
  },
  {
    id: "RET-005",
    assetName: "Laptop",
    employeeName: "Pooja Sharma",
    requestDate: "14 May 2025",
    status: "approved",
  },
];

/** Static lookup so callers can read the icon without creating it mid-render. */
export const ASSET_CATEGORY_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  ASSET_CATEGORIES.map((category) => [category.label, category.icon]),
);

export function initialsForAsset(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
