import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import {
  GlobalDateContext,
  type GlobalDateValue,
} from "./globalDateContext";
import { isDateKey, toDateKey, todayKey } from "../utils/dateKeys";

const QUERY_KEY = "date";

/**
 * Holds the one day picked in the header calendar and shares it with every
 * page that has date-driven data.
 *
 * The selected date is session state. The query parameter is only a mirror of
 * it, so navigation can preserve the current filter without making an old date
 * reappear on the next login.
 */
export function GlobalDateProvider({ children }: { children: ReactNode }) {
  const [, setSearchParams] = useSearchParams();

  // Manual date selections apply to the current session only. A fresh login
  // must always start on the actual local calendar day.
  const [date, setDateState] = useState<string>(() => todayKey());

  const setDate = useCallback(
    (next: string) => {
      const value = isDateKey(next) ? next : todayKey();

      setDateState(value);

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

  useEffect(() => {
    let isActive = true;
    let timeout: number | undefined;

    function scheduleNextDayRefresh() {
      const now = new Date();
      const nextDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      );

      timeout = window.setTimeout(() => {
        if (!isActive) return;

        if (date !== todayKey()) {
          setDate(todayKey());
        }

        scheduleNextDayRefresh();
      }, Math.max(1, nextDay.getTime() - now.getTime()));
    }

    scheduleNextDayRefresh();

    function refreshAfterVisibilityChange() {
      if (document.visibilityState === "visible" && date !== todayKey()) {
        setDate(todayKey());
      }
    }

    document.addEventListener("visibilitychange", refreshAfterVisibilityChange);

    return () => {
      isActive = false;
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refreshAfterVisibilityChange);
    };
  }, [date, setDate]);

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
