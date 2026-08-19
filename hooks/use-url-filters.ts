"use client";
import * as React from "react";
import {
  emptyFilters,
  filtersFromParams,
  sameFacets,
  writeFiltersToParams,
  type Filters,
} from "@/lib/filters";
import { useUrlState } from "@/hooks/use-url-state";

/**
 * The shared Board/List filter state, held in the URL so a filtered view is a
 * link. Both views read the SAME parameters, which is what makes the link
 * shareable at all — and has the welcome side effect that switching Board→List
 * carries the filters across instead of resetting them.
 *
 * HISTORY: a facet toggle PUSHES, so Back undoes one filter. Typing in the
 * search box pushes once — the keystroke that starts a search — and replaces
 * from then on, so a ten-letter query leaves one entry behind rather than ten
 * and Back still returns to the unfiltered board (bead-me-up-scotty GH #32
 * settled on the same rule).
 */
export function useUrlFilters() {
  const { searchParams, updateUrl } = useUrlState();
  const urlFilters = React.useMemo(() => filtersFromParams(searchParams), [searchParams]);

  // THE SEARCH BOX IS THE ONE FACET THAT CANNOT BE DRIVEN BY THE URL. The
  // router applies a history write as a transition, so a text input whose value
  // came from useSearchParams is re-rendered with the PREVIOUS character still
  // in it and drops keystrokes — typing "adapter schema" into a URL-driven box
  // lands as "aa". So the draft is local state and the URL is its output; a
  // history entry (back, forward, a fresh link) hands the box its value back.
  const [search, setSearch] = React.useState(urlFilters.search);
  React.useEffect(() => {
    const onPop = () => setSearch(new URLSearchParams(window.location.search).get("q") ?? "");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const filters = React.useMemo(() => ({ ...urlFilters, search }), [urlFilters, search]);

  const showArchived = searchParams.get("archived") === "1";

  const setFilters = React.useCallback(
    (next: Filters) => {
      const stillTyping =
        sameFacets(filters, next) && next.search !== filters.search && filters.search !== "";
      setSearch(next.search);
      updateUrl((p) => writeFiltersToParams(p, next), stillTyping ? "replace" : "push");
    },
    [filters, updateUrl],
  );

  const setShowArchived = React.useCallback(
    (show: boolean) =>
      updateUrl((p) => {
        if (show) p.set("archived", "1");
        else p.delete("archived");
      }),
    [updateUrl],
  );

  const clearFilters = React.useCallback(() => {
    setSearch("");
    updateUrl((p) => {
      writeFiltersToParams(p, emptyFilters);
      p.delete("archived");
    });
  }, [updateUrl]);

  return { filters, setFilters, showArchived, setShowArchived, clearFilters };
}
