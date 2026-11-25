/**
 * Presentation-only asset metadata.
 *
 * The asset rows, categories, employees and requests all come from the API
 * now (see `types/asset.ts` and `services/assetService.ts`). What is left here
 * is the part the server has no business knowing about: which colour and icon
 * each category wears in the UI.
 */
import { useEffect, type RefObject } from "react";
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

import type { AssetCategory } from "./types";

export interface AssetCategoryMeta {
  label: AssetCategory;
  color: string;
  icon: LucideIcon;
}

export const ASSET_CATEGORIES: AssetCategoryMeta[] = [
  { label: "Laptop", color: "#2F5FD0", icon: Laptop },
  { label: "Mobile", color: "#1E6B45", icon: Smartphone },
  { label: "Monitor", color: "#92400E", icon: Monitor },
  { label: "Accessories", color: "#9B1C1C", icon: Keyboard },
  { label: "Furniture", color: "#059669", icon: Armchair },
  { label: "Electronics", color: "#06b6d4", icon: Projector },
  { label: "Software", color: "#4B5563", icon: Package },
  { label: "Others", color: "#7E22CE", icon: Headphones },
];

export const DIALOG_FIELD_CLASS =
  "h-9 w-full rounded border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#111827] " +
  "outline-none transition placeholder:text-[#7B8794] focus:border-[#2F5FD0] focus:ring-1 " +
  "focus:ring-[#2F5FD0] disabled:cursor-not-allowed disabled:bg-[#F6F7F5]";

export const DIALOG_LABEL_CLASS = "mb-1.5 block text-[12px] font-medium text-[#4B5563]";

/**
 * Accessible dialog keyboard handling: Escape to dismiss, Tab focus trapping,
 * body scroll lock, and focus restoration to the opener on close.
 */
export function useAssetDialogA11y(
  modalRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  disabled = false,
) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = modalRef.current;

    if (node) {
      const focusables = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length > 0 && !node.contains(document.activeElement)) {
        focusables[0].focus();
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!disabled) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first || !modalRef.current.contains(document.activeElement)) {
            last.focus();
            event.preventDefault();
          }
        } else if (document.activeElement === last || !modalRef.current.contains(document.activeElement)) {
          first.focus();
          event.preventDefault();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (opener && typeof opener.focus === "function") {
        opener.focus();
      }
    };
  }, [modalRef, onClose, disabled]);
}

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