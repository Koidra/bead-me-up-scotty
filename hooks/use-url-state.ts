"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";

export type UrlHistoryMode = "push" | "replace";

/**
 * Read and write the current URL without a server round-trip, so views, filters
 * and the open bead can live in the address bar.
 *
 * Native history.pushState/replaceState rather than router.push/replace: every
 * URL this app writes selects client state that is already loaded, so re-running
 * the server route would cost a request and a flash for nothing. The App Router
 * patches both methods and syncs usePathname/useSearchParams with them (see the
 * "Native History API" section of the linking-and-navigating guide), so reading
 * stays declarative and browser back/forward keeps working.
 *
 * Every writer MUTATES the live URL rather than rebuilding one, so params owned
 * by someone else survive: the Board's filter writes can't drop `bead`, and the
 * drawer's writes can't drop the filters.
 */
export function useUrlState() {
  const searchParams = useSearchParams();

  const updateLocation = React.useCallback(
    (mutate: (url: URL) => void, mode: UrlHistoryMode = "push") => {
      const url = new URL(window.location.href);
      mutate(url);
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      // No-op guard: without it the normalizing effects below would push a
      // duplicate entry on every render they happen to re-run on.
      if (next === current) return;
      if (mode === "replace") window.history.replaceState(window.history.state, "", next);
      else window.history.pushState(null, "", next);
    },
    [],
  );

  const updateUrl = React.useCallback(
    (mutate: (params: URLSearchParams) => void, mode: UrlHistoryMode = "push") =>
      updateLocation((url) => mutate(url.searchParams), mode),
    [updateLocation],
  );

  return { searchParams, updateLocation, updateUrl };
}
