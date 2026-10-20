import { QueryClient } from "@tanstack/react-query";
import { ApiError, setOnSessionClear } from "../services/api";

/**
 * Global TanStack QueryClient instance for the HRMS frontend.
 *
 * Defaults:
 * - staleTime: 60 seconds (data is considered fresh for 1 min unless overridden)
 * - gcTime: 10 minutes (cached data remains in memory for 10 min while unused)
 * - refetchOnWindowFocus: false (avoids disruptive refetches during admin workflows)
 * - retry: Does NOT retry client/auth errors (400, 401, 403, 404, 409, 422)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Do not retry client errors or authentication failures
        if (
          error instanceof ApiError &&
          [400, 401, 403, 404, 409, 422].includes(error.status)
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Resets and clears all cached queries in memory.
 * Must be called on logout, session expiration, and user account switching
 * to strictly prevent any cross-user data leakage.
 */
export function clearAuthQueries(): void {
  queryClient.clear();
}

// Automatically clear the entire query cache whenever the session is invalidated/cleared
setOnSessionClear(clearAuthQueries);

