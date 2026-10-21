import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  GlobalDateContext,
  type GlobalDateValue,
} from "./globalDateContext";
import { isDateKey, toDateKey, todayKey } from "../utils/dateKeys";

const STORAGE_KEY = "hrms_global_date";
const QUERY_KEY = "date";

function readStoredDate(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return isDateKey(stored) ? stored : null;
  } catch {
    // Private browsing can make localStorage throw. The header date is not
    // worth crashing the app over, so fall back to today.
    return null;
  }
}

/**
 * Holds the one day picked in the header calendar and shares it with every
 * page that has date-driven data.
 *
 * localStorage is the source of truth and the query param is only a mirror of
 * it. A handful of navigate() calls across the app build a bare pathname, which
 * would drop the param on every sidebar click; keeping the authoritative value
 * outside the URL means those links cost shareability but never correctness.
 */
export function GlobalDateProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read once. From here on the URL is written by setDate and never consulted
  // again, so a param stripped by navigation cannot change what is on screen.
  const [date, setDateState] = useState<string>(() => {
    const fromQuery = searchParams.get(QUERY_KEY);

    if (isDateKey(fromQuery)) return fromQuery;

    return readStoredDate() ?? todayKey();
  });

  const setDate = useCallback(
    (next: string) => {
      const value = isDateKey(next) ? next : todayKey();

      setDateState(value);

      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        // Persisting is best effort; the date still applies for this session.
      }

      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);

          if (value === todayKey()) {
            // Leaving ?date= off the default keeps the URL clean, and a reader
            // of the link sees today's data, which is what it would have shown.
            params.delete(QUERY_KEY);
          } else {
            params.set(QUERY_KEY, value);
          }

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const stepMonth = useCallback(
    (amount: number) => {
      setDate(
        (() => {
          const current = new Date(`${date}T00:00:00`);

          // Day 1 first, so adding a month to a 31st cannot land on a short
          // month's 1st and silently jump two months.
          const target = new Date(
            current.getFullYear(),
            current.getMonth() + amount,
            1,
          );

          const lastDay = new Date(
            target.getFullYear(),
            target.getMonth() + 1,
            0,
          ).getDate();

          target.setDate(Math.min(current.getDate(), lastDay));

          return toDateKey(target);
        })(),
      );
    },
    [date, setDate],
  );

  const resetDate = useCallback(() => setDate(todayKey()), [setDate]);

  const value = useMemo<GlobalDateValue>(
    () => ({
      date,
      setDate,
      stepMonth,
      resetDate,
      isDefault: date === todayKey(),
    }),
    [date, setDate, stepMonth, resetDate],
  );

  return (
    <GlobalDateContext.Provider value={value}>
      {children}
    </GlobalDateContext.Provider>
  );
}