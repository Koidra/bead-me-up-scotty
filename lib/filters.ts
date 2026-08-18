import type { Bead } from "./schema";
import { beadOrigin } from "./attribution";
import { parentOf } from "./beads-view";

/**
 * Shared bead filter model used by both the Board and List views. Every facet is
 * multi-select; an empty array means "no constraint" (show all). `search` matches
 * id / title / assignee.
 */
export interface Filters {
  status: string[];
  type: string[];
  priority: number[];
  origin: string[];
  labels: string[];
  epic: string[];
  search: string;
}

export const emptyFilters: Filters = {
  status: [],
  type: [],
  priority: [],
  origin: [],
  labels: [],
  epic: [],
  search: "",
};

/**
 * `archived` is state, not a tag — it has its own dedicated toggle in the
 * FilterBar and the views hide on it — so it never appears as a label facet
 * option.
 */
export const ARCHIVED_LABEL = "archived";

/**
 * The distinct labels in use across a bead set, sorted, as filter options.
 * Callers pass ALL beads (not the filtered set) so selecting one label doesn't
 * make the other options vanish from the dropdown.
 */
export function labelOptionsFrom(beads: Bead[]): { value: string; label: string }[] {
  const s = new Set<string>();
  for (const b of beads) for (const l of b.labels ?? []) if (l !== ARCHIVED_LABEL) s.add(l);
  return [...s].sort().map((l) => ({ value: l, label: l }));
}

/**
 * Epic facet values are TAGGED rather than raw ids — every epic is `epic:<id>`
 * — so the "no epic" option below occupies a value no epic can ever produce.
 * A bare sentinel string would be one unlucky bead id away from misfiltering.
 */
export function epicValue(id: string): string {
  return `epic:${id}`;
}

/** Facet value for beads under no epic, so "No epic" is selectable alongside
 *  real epics in the same multi-select. Untagged, hence collision-free. */
export const NO_EPIC = "no-epic";

/**
 * The epic a bead belongs to, or null when it belongs to none. Any bead can be
 * a parent, not just an epic, so the epic is an ANCESTOR rather than necessarily
 * the direct parent: a subtask of a task under an epic still belongs to that
 * epic. The walk stops at the first epic, so a nested epic claims its own
 * subtree, and `seen` guards against a parent cycle in the data.
 */
export function epicOf(b: Bead, index: Map<string, Bead>): Bead | null {
  const seen = new Set<string>([b.id]);
  for (let p = parentOf(b, index); p && !seen.has(p.id); p = parentOf(p, index)) {
    if (p.issue_type === "epic") return p;
    seen.add(p.id);
  }
  return null;
}

/**
 * The epics that beads actually hang off, as filter options labelled by epic
 * title and sorted by it — with "No epic" first when any bead has none. Callers
 * pass ALL beads (not the filtered set), same as labelOptionsFrom. Epics
 * themselves are skipped: the Board and List never render them as rows, so an
 * epic's own membership is not something either view can filter on.
 */
export function epicOptionsFrom(
  beads: Bead[],
  index: Map<string, Bead>,
): { value: string; label: string }[] {
  const titles = new Map<string, string>();
  let hasNone = false;
  for (const b of beads) {
    if (b.issue_type === "epic") continue;
    const e = epicOf(b, index);
    if (e) titles.set(e.id, e.title);
    else hasNone = true;
  }
  const opts = [...titles]
    .map(([id, title]) => ({ value: epicValue(id), label: title }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return hasNone ? [{ value: NO_EPIC, label: "No epic" }, ...opts] : opts;
}

/**
 * How many facets are constraining the view — each non-empty facet counts once,
 * however many values are ticked inside it. The FilterBar's reset badge adds the
 * free-text search and the archived toggle on top; the facets are counted here
 * so a new facet only ever has to be taught to one counter.
 */
export function activeFilterCount(f: Filters): number {
  return (
    (f.status.length ? 1 : 0) +
    (f.type.length ? 1 : 0) +
    (f.priority.length ? 1 : 0) +
    (f.origin.length ? 1 : 0) +
    (f.labels.length ? 1 : 0) +
    (f.epic.length ? 1 : 0)
  );
}

/** `index` is the bead index — the epic facet resolves parentage through it. */
export function matchesFilters(
  b: Bead,
  f: Filters,
  humanAllowlist: string[],
  index: Map<string, Bead>,
): boolean {
  if (f.status.length && !f.status.includes(b.status)) return false;
  if (f.type.length && !f.type.includes(b.issue_type)) return false;
  if (f.priority.length && !f.priority.includes(b.priority)) return false;
  if (f.origin.length && !f.origin.includes(beadOrigin(b, humanAllowlist))) return false;
  if (f.epic.length) {
    const e = epicOf(b, index);
    if (!f.epic.includes(e ? epicValue(e.id) : NO_EPIC)) return false;
  }
  // OR within the facet, like every other facet above; AND across facets.
  if (f.labels.length && !f.labels.some((l) => (b.labels ?? []).includes(l))) return false;
  const q = f.search.trim().toLowerCase();
  if (
    q &&
    !(
      b.title.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.assignee ?? "").toLowerCase().includes(q) ||
      (b.labels ?? []).some((l) => l.toLowerCase().includes(q))
    )
  )
    return false;
  return true;
}

/** Immutable toggle of a value in a string array. */
export function toggleStr(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Immutable toggle of a value in a number array. */
export function toggleNum(arr: number[], v: number): number[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}
