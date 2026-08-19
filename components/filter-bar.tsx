"use client";
import * as React from "react";
import { Icon } from "@/components/icons";
import { MultiSelectFilter, type FilterOption } from "@/components/multi-select-filter";
import { typeLabel, statusLabel, prioLabel } from "@/lib/beads-view";
import { BEAD_TYPES, BEAD_STATUSES } from "@/lib/schema";
import {
  type Filters,
  toggleStr,
  toggleNum,
  activeFilterCount,
  staleFilterValues,
  staleCount,
  withoutStale,
} from "@/lib/filters";

/**
 * Search + multi-select facet filters, shared by the Board and List views so
 * both expose the same controls (status, type, priority, labels, assignee,
 * epic, origin) + archived. Purely presentational: `labelOptions`,
 * `assigneeOptions` and `epicOptions` are the data-derived facets (the rest
 * come from static enums) and are passed in rather than read from context here.
 */
export function FilterBar({
  filters,
  onChange,
  onClearAll,
  labelOptions,
  assigneeOptions,
  epicOptions,
  showArchived,
  onShowArchived,
  ready,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Reset everything at once — one call, so it costs one history entry. */
  onClearAll: () => void;
  labelOptions: FilterOption[];
  assigneeOptions: FilterOption[];
  epicOptions: FilterOption[];
  showArchived: boolean;
  onShowArchived: (v: boolean) => void;
  /** Beads have loaded, so the option lists can be trusted to spot stale filters. */
  ready: boolean;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  // Count active filters (each non-empty facet + a non-empty search + archived)
  // so we can offer a one-click reset (bead 3it). The facets are counted by
  // activeFilterCount rather than re-enumerated here, so adding a facet can't
  // leave the badge counting one fewer than the bar shows; search and archived
  // are added on top since that helper deliberately excludes them.
  const active =
    activeFilterCount(filters) + (filters.search.trim() ? 1 : 0) + (showArchived ? 1 : 0);

  // Filters arrive by LINK now, and a link outlives its data: the epic it
  // filtered on gets closed, the assignee moves on. Those facets would then
  // match nothing and leave the recipient staring at an empty board with no
  // hint why, so name them and offer one click to drop them. Only once the
  // beads are in — before that every value looks stale.
  const stale = staleFilterValues(
    filters,
    ready
      ? {
          labels: labelOptions.map((o) => o.value),
          assignee: assigneeOptions.map((o) => o.value),
          epic: epicOptions.map((o) => o.value),
        }
      : { labels: filters.labels, assignee: filters.assignee, epic: filters.epic },
  );
  const staleN = staleCount(stale);

  return (
    <>
      <div className="flex h-9 max-w-[280px] flex-1 items-center gap-[7px] rounded-[9px] border border-border bg-[var(--surface-2)] px-[11px]">
        <Icon name="search" size={15} className="flex-shrink-0 text-[var(--text-3)]" />
        <input
          data-search
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search beads…  (/)"
          className="w-full border-none bg-transparent text-[13px] text-[var(--text)] outline-none"
        />
      </div>

      <div className="flex items-center gap-[7px]">
        <MultiSelectFilter
          label="Status"
          options={BEAD_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
          selected={filters.status}
          onToggle={(v) => set({ status: toggleStr(filters.status, v) })}
          onClear={() => set({ status: [] })}
        />
        {/* Epic is offered like any other type, and ticking it is the only way
            to get epic cards onto the Board and List — they stay hidden while
            the facet is untouched (see matchesFilters). */}
        <MultiSelectFilter
          label="Type"
          options={BEAD_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))}
          selected={filters.type}
          onToggle={(v) => set({ type: toggleStr(filters.type, v) })}
          onClear={() => set({ type: [] })}
        />
        <MultiSelectFilter
          label="Priority"
          options={[0, 1, 2, 3, 4].map((p) => ({ value: String(p), label: prioLabel(p) }))}
          selected={filters.priority.map(String)}
          onToggle={(v) => set({ priority: toggleNum(filters.priority, Number(v)) })}
          onClear={() => set({ priority: [] })}
        />
        {labelOptions.length > 0 && (
          <MultiSelectFilter
            label="Labels"
            options={labelOptions}
            selected={filters.labels}
            onToggle={(v) => set({ labels: toggleStr(filters.labels, v) })}
            onClear={() => set({ labels: [] })}
          />
        )}
        {assigneeOptions.length > 0 && (
          <MultiSelectFilter
            label="Assignee"
            options={assigneeOptions}
            selected={filters.assignee}
            onToggle={(v) => set({ assignee: toggleStr(filters.assignee, v) })}
            onClear={() => set({ assignee: [] })}
          />
        )}
        {epicOptions.length > 0 && (
          <MultiSelectFilter
            label="Epic"
            options={epicOptions}
            selected={filters.epic}
            onToggle={(v) => set({ epic: toggleStr(filters.epic, v) })}
            onClear={() => set({ epic: [] })}
          />
        )}
        <MultiSelectFilter
          label="Origin"
          options={[
            { value: "human", label: "Human" },
            { value: "agent", label: "Agent" },
          ]}
          selected={filters.origin}
          onToggle={(v) => set({ origin: toggleStr(filters.origin, v) })}
          onClear={() => set({ origin: [] })}
        />
        <button
          onClick={() => onShowArchived(!showArchived)}
          title="Toggle archived"
          className="flex h-9 items-center gap-[6px] rounded-[9px] px-[11px] text-[12.5px] font-medium"
          style={{
            border: `1px solid ${showArchived ? "var(--brand)" : "var(--border)"}`,
            background: showArchived ? "var(--brand-weak)" : "var(--surface-2)",
            color: showArchived ? "var(--brand)" : "var(--text-2)",
          }}
        >
          <Icon name="archive" size={14} />
          <span>Archived</span>
        </button>
        {staleN > 0 && (
          <button
            onClick={() => onChange(withoutStale(filters, stale))}
            title={`No longer in this project: ${[...stale.epic, ...stale.assignee, ...stale.labels].join(", ")}`}
            className="flex h-9 items-center gap-[6px] rounded-[9px] px-[11px] text-[12.5px] font-medium"
            style={{
              border: "1px solid var(--destructive)",
              background: "var(--surface-2)",
              color: "var(--destructive)",
            }}
          >
            <Icon name="x" size={14} />
            <span>
              {staleN} missing filter{staleN > 1 ? "s" : ""} · Drop
            </span>
          </button>
        )}
        {active > 0 && (
          <button
            onClick={onClearAll}
            title="Clear all filters"
            className="flex h-9 items-center gap-[6px] rounded-[9px] border border-border bg-[var(--surface-2)] px-[11px] text-[12.5px] font-medium text-[var(--text-2)] hover:bg-[var(--surface-3)]"
          >
            <Icon name="x" size={14} />
            <span>Clear · {active}</span>
          </button>
        )}
      </div>
    </>
  );
}
