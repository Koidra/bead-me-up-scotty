import type { Bead } from "./schema";
import { BEAD_STATUSES, BEAD_TYPES, PRIORITIES } from "./schema";
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
  assignee: string[];
  epic: string[];
  search: string;
}

export const emptyFilters: Filters = {
  status: [],
  type: [],
  priority: [],
  origin: [],
  labels: [],
  assignee: [],
  epic: [],
  search: "",
};

/**
 * URL ↔ Filters. Filters are BOOKMARKABLE: a link has to reproduce the view it
 * was copied from, so every facet gets a query parameter.
 *
 * REPEATED params (`type=epic&type=bug`) rather than a comma-joined list: three
 * of these facets carry values we do not control — labels, assignees and epic
 * ids are data, so a comma or a space inside one is only a matter of time
 * ("Sinh Tran" already has the space) — and repeating the key needs no escaping
 * convention layered on top of the one URLSearchParams already applies.
 *
 * Epic values stay TAGGED (`epic:<id>`, hence the `%3A` in the URL) exactly as
 * the facet holds them. Stripping the tag for a prettier link would put real
 * epic ids back in the same value space as the untagged "no-epic" sentinel,
 * which is precisely the collision epicValue() exists to prevent.
 */
const FACET_PARAMS = [
  "status",
  "type",
  "priority",
  "origin",
  "label",
  "assignee",
  "epic",
  "q",
] as const;

const ORIGINS = ["human", "agent"] as const;

/** The read side of URLSearchParams — Next's ReadonlyURLSearchParams satisfies it too. */
type ParamsReader = Pick<URLSearchParams, "get" | "getAll">;

const distinct = (p: ParamsReader, name: string) => [...new Set(p.getAll(name).filter(Boolean))];

/**
 * Parse the shared Board/List filters out of a URL.
 *
 * Values of the four ENUM facets are validated away when they name something
 * that no longer exists, because a stale `status=wontfix` would otherwise match
 * no bead and leave a link's recipient staring at an empty board. The three
 * DATA-derived facets (labels, assignee, epic) can't be checked here — their
 * options come from beads that haven't loaded yet at parse time — so they are
 * taken at face value and reported by staleFilterValues() once data is in.
 */
export function filtersFromParams(params: ParamsReader): Filters {
  const oneOf = <T extends string>(name: string, allowed: readonly T[]): T[] =>
    distinct(params, name).filter((v): v is T => (allowed as readonly string[]).includes(v));
  return {
    status: oneOf("status", BEAD_STATUSES),
    type: oneOf("type", BEAD_TYPES),
    priority: distinct(params, "priority")
      .map(Number)
      .filter((n) => (PRIORITIES as readonly number[]).includes(n)),
    origin: oneOf("origin", ORIGINS),
    labels: distinct(params, "label"),
    assignee: distinct(params, "assignee"),
    epic: distinct(params, "epic"),
    // Raw, NOT trimmed: the input is driven by this value, so trimming here
    // would eat the space the moment you typed it and make "foo bar" untypable.
    search: params.get("q") ?? "",
  };
}

/** Write the filters into `params`, leaving every parameter we don't own alone. */
export function writeFiltersToParams(params: URLSearchParams, f: Filters): void {
  for (const name of FACET_PARAMS) params.delete(name);
  for (const v of f.status) params.append("status", v);
  for (const v of f.type) params.append("type", v);
  for (const v of f.priority) params.append("priority", String(v));
  for (const v of f.origin) params.append("origin", v);
  for (const v of f.labels) params.append("label", v);
  for (const v of f.assignee) params.append("assignee", v);
  for (const v of f.epic) params.append("epic", v);
  if (f.search) params.set("q", f.search);
}

/** True when only the free-text search differs — see useUrlFilters for why. */
export function sameFacets(a: Filters, b: Filters): boolean {
  const key = (f: Filters) =>
    [f.status, f.type, f.priority, f.origin, f.labels, f.assignee, f.epic]
      .map((vs) => vs.join("\u0000"))
      .join("\u0001");
  return key(a) === key(b);
}

/** Selected values of the data-derived facets that this project no longer offers. */
export interface StaleValues {
  labels: string[];
  assignee: string[];
  epic: string[];
}

/**
 * A shared link outlives the data it points at: the epic it filtered on can be
 * closed and the assignee can leave. Rather than silently showing an empty
 * board, the FilterBar names the values that no longer exist and offers to drop
 * them — so a stale link degrades into an explained one, not a blank screen.
 * Callers must wait for beads to load; before that EVERY value looks stale.
 */
export function staleFilterValues(f: Filters, available: StaleValues): StaleValues {
  const missing = (sel: string[], opts: string[]) => {
    const known = new Set(opts);
    return sel.filter((v) => !known.has(v));
  };
  return {
    labels: missing(f.labels, available.labels),
    assignee: missing(f.assignee, available.assignee),
    epic: missing(f.epic, available.epic),
  };
}

export function staleCount(s: StaleValues): number {
  return s.labels.length + s.assignee.length + s.epic.length;
}

/** The same filters with every stale value removed. */
export function withoutStale(f: Filters, s: StaleValues): Filters {
  const drop = (sel: string[], gone: string[]) => sel.filter((v) => !gone.includes(v));
  return {
    ...f,
    labels: drop(f.labels, s.labels),
    assignee: drop(f.assignee, s.assignee),
    epic: drop(f.epic, s.epic),
  };
}

/**
 * Sentinel facet value for beads with no assignee, so "Unassigned" is
 * selectable alongside real assignees in the same multi-select.
 */
export const UNASSIGNED = "__unassigned__";

/** A bead's assignee normalized to a facet value (empty/blank → UNASSIGNED). */
export function beadAssignee(b: Bead): string {
  return b.assignee?.trim() || UNASSIGNED;
}

/**
 * The distinct assignees in use across a bead set, sorted, as filter options —
 * with "Unassigned" first when any bead lacks one. Callers pass ALL beads (not
 * the filtered set), same as labelOptionsFrom.
 */
export function assigneeOptionsFrom(beads: Bead[]): { value: string; label: string }[] {
  const s = new Set<string>();
  let hasUnassigned = false;
  for (const b of beads) {
    const a = beadAssignee(b);
    if (a === UNASSIGNED) hasUnassigned = true;
    else s.add(a);
  }
  const opts = [...s].sort().map((a) => ({ value: a, label: a }));
  return hasUnassigned ? [{ value: UNASSIGNED, label: "Unassigned" }, ...opts] : opts;
}

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
 * The epic a bead belongs to, or null when it belongs to none. An epic belongs
 * to ITSELF: an epic can now be a row of its own (Type = Epic), and someone who
 * ticks Type = Epic and Epic = X means "X", not "whatever X happens to hang
 * off". It also keeps the facet honest — no epic is ever "No epic".
 *
 * Otherwise the epic is an ANCESTOR rather than necessarily the direct parent —
 * any bead can be a parent, not just an epic — so a subtask of a task under an
 * epic still belongs to that epic. The walk stops at the first epic, so a nested
 * epic claims its own subtree, and `seen` guards against a parent cycle.
 */
export function epicOf(b: Bead, index: Map<string, Bead>): Bead | null {
  if (b.issue_type === "epic") return b;
  const seen = new Set<string>([b.id]);
  for (let p = parentOf(b, index); p && !seen.has(p.id); p = parentOf(p, index)) {
    if (p.issue_type === "epic") return p;
    seen.add(p.id);
  }
  return null;
}

/**
 * The epics beads belong to, as filter options labelled by epic title and
 * sorted by it — with "No epic" first when any bead has none. Callers pass ALL
 * beads (not the filtered set), same as labelOptionsFrom. Epics count as their
 * own (see epicOf), so every epic is offered here whether or not anything hangs
 * off it: an epic can be a row now, so picking a childless one still selects
 * something, and the options no longer depend on which types are on screen.
 */
export function epicOptionsFrom(
  beads: Bead[],
  index: Map<string, Bead>,
): { value: string; label: string }[] {
  const titles = new Map<string, string>();
  let hasNone = false;
  for (const b of beads) {
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
    (f.assignee.length ? 1 : 0) +
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
  // Epics are rows only when the Type facet explicitly asks for them: they have
  // their own screen, they are containers rather than work, and every existing
  // board would otherwise gain cards it never had. So an EMPTY Type facet means
  // "every type except epic" — the one facet whose "no constraint" isn't total.
  if (b.issue_type === "epic" && !f.type.includes("epic")) return false;
  if (f.status.length && !f.status.includes(b.status)) return false;
  if (f.type.length && !f.type.includes(b.issue_type)) return false;
  if (f.priority.length && !f.priority.includes(b.priority)) return false;
  if (f.origin.length && !f.origin.includes(beadOrigin(b, humanAllowlist))) return false;
  if (f.assignee.length && !f.assignee.includes(beadAssignee(b))) return false;
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
