/**
 * Presentation-only asset metadata.
 *
 * The asset rows, categories, employees and requests all come from the API
 * now (see `types/asset.ts` and `services/assetService.ts`). What is left here
 * is the part the server has no business knowing about: which colour and icon
 * each category wears in the UI.
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

import type { AssetCategory } from "../../types/asset";

export interface AssetCategoryMeta {
  label: AssetCategory;
  color: string;
  icon: LucideIcon;
}

export const ASSET_CATEGORIES: AssetCategoryMeta[] = [
  { label: "Laptop", color: "#2563eb", icon: Laptop },
  { label: "Mobile", color: "#10b981", icon: Smartphone },
  { label: "Monitor", color: "#f59e0b", icon: Monitor },
  { label: "Accessories", color: "#ef4444", icon: Keyboard },
  { label: "Furniture", color: "#22c55e", icon: Armchair },
  { label: "Electronics", color: "#06b6d4", icon: Projector },
  { label: "Software", color: "#475569", icon: Package },
  { label: "Others", color: "#a855f7", icon: Headphones },
];

export const ASSET_CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((category) => [category.label, category.color]),
);

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