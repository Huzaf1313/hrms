import { createContext, useContext } from "react";

/**
 * The day picked in the header calendar, shared with every page that has
 * date-driven data. The provider itself lives in GlobalDateProvider.tsx; this
 * file holds only the contract so Fast Refresh can swap the component.
 */
export interface GlobalDateValue {
  /** Always a valid YYYY-MM-DD string. Never null, so pages need no guard. */
  date: string;
  setDate: (next: string) => void;
  /** Steps the selected day by whole months, keeping the day of month where
   *  the target month is long enough. */
  stepMonth: (amount: number) => void;
  resetDate: () => void;
  /** False once the user has picked a day other than today, which is what
   *  decides whether a page shows an active-filter badge. */
  isDefault: boolean;
}

export const GlobalDateContext = createContext<GlobalDateValue | null>(null);

export function useGlobalDate(): GlobalDateValue {
  const context = useContext(GlobalDateContext);

  if (!context) {
    throw new Error(
      "useGlobalDate must be used inside a GlobalDateProvider.",
    );
  }

  return context;
}