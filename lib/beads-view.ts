import type { Bead } from "./schema";
import { BLOCKING_DEP_TYPES } from "./schema";

/**
 * Pure view-model helpers, ported from the Claude Design export prototype.
 * Framework-agnostic so they can run on the server and the client.
 */

/**
 * A bead needs a human decision when it carries the `human` label (set by
 * `bd human`) and is still actionable (not closed or deferred). Drives the
 * "Needs You" inbox and its sidebar count badge.
 */
export function needsHuman(b: Bead): boolean {
  return (b.labels ?? []).includes("human") && b.status !== "closed" && b.status !== "deferred";
}

/**
 * A human-approval gate: an `issue_type === "gate"` bead created by
 * `bd gate create --type human`. Unlike `bd human` (a label on a normal bead),
 * a gate is its own bead whose sub-type lives in `await_type`, so it never
 * carries the `human` label and `needsHuman()` misses it.
 */
export function isHumanGate(b: Bead): boolean {
  return b.issue_type === "gate" && b.await_type === "human";
}

/**
 * A human-approval gate that is unresolved and not itself blocked — its own
 * blockers (if any) are all closed, so a person can approve/resolve it now.
 * These belong on the "Needs You" inbox alongside `needsHuman()` beads
 * (bead 8qc / gh-6). Resolving = closing the gate, which unblocks its dependents.
 */
export function readyHumanGate(b: Bead, index: Map<string, Bead>): boolean {
  return isHumanGate(b) && b.status !== "closed" && !isBlocked(b, index);
}

/** Beads that this gate blocks (they depend on it via a blocking dep). */
export function gateBlocks(gateId: string, beads: Bead[]): Bead[] {
  return beads.filter((b) =>
    (b.dependencies ?? []).some((d) => d.depends_on_id === gateId && BLOCKING_DEP_TYPES.includes(d.type as never)),
  );
}

/**
 * GFM task-list ("- [ ]" / "- [x]") helpers. Checklists live in the bead
 * description text itself (zero new schema), so toggling rewrites the markdown.
 */
const TASK_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/gm;

export function checklistProgress(text?: string | null): { done: number; total: number } {
  if (!text) return { done: 0, total: 0 };
  const re = new RegExp(TASK_RE);
  let done = 0;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    total++;
    if (m[2].toLowerCase() === "x") done++;
  }
  return { done, total };
}

/** Flip the Nth task checkbox (0-based, document order) and return the new text. */
export function toggleTask(text: string, index: number): string {
  let i = 0;
  return text.replace(TASK_RE, (full, prefix: string, mark: string) => {
    if (i++ !== index) return full;
    return `${prefix}[${mark.toLowerCase() === "x" ? " " : "x"}]`;
  });
}

/**
 * `bd close` with no `--reason` still records a reason: the literal "Closed".
 * That placeholder carries no information, so treat it as absent rather than
 * rendering a "Close reason" section that just says "Closed".
 */
export function closeReasonOf(b: Bead): string {
  const reason = b.close_reason?.trim() ?? "";
  return reason.toLowerCase() === "closed" ? "" : reason;
}

export type StatusCategory = "done" | "wip" | "blocked" | "frozen" | "active";

export function category(status: string): StatusCategory {
  if (status === "closed") return "done";
  if (status === "in_progress" || status === "hooked") return "wip";
  if (status === "blocked") return "blocked";
  if (status === "deferred" || status === "pinned") return "frozen";
  return "active";
}

const CAT_COLORS: Record<StatusCategory, string> = {
  done: "#16a34a",
  wip: "#d97706",
  blocked: "#ef4444",
  frozen: "#64748b",
  active: "#3b82f6",
};
export function catColor(status: string): string {
  return CAT_COLORS[category(status)];
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  deferred: "Deferred",
  closed: "Closed",
  pinned: "Pinned",
  hooked: "Hooked",
};
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

const PRIO_COLORS = ["#ef4444", "#f97316", "#eab308", "#0ea5e9", "#64748b"];
const PRIO_LABELS = ["Critical", "High", "Medium", "Low", "Backlog"];
export function prioColor(p: number): string {
  return PRIO_COLORS[p] ?? "#64748b";
}
export function prioLabel(p: number): string {
  return PRIO_LABELS[p] ?? String(p);
}

export function typeColor(t: string): string {
  if (t === "epic") return "var(--brand)";
  if (t === "bug") return "#ef4444";
  return "var(--text-3)";
}
export function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const AVATARS = [
  "#6d5ef0",
  "#0ea5e9",
  "#16a34a",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#7c3aed",
];
export function avatarColor(name: string): string {
  if (!name) return "#9aa0aa";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}
export function initials(name: string): string {
  if (!name) return "?";
  const parts = name.split(/[-_ .]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Everyone else working on a bead, kept as `collaborator:<name>` labels.
 * `assignee` is a single column that also carries bd's claim (`--claim`,
 * `--if-assignee`, the leases table), so it has to stay one DRI; labels are a
 * real join table, which makes them the only multi-valued field bd offers. The
 * prefix never reaches the screen — nobody should have to read `collaborator:`
 * to see who is on a bead.
 */
export const COLLABORATOR_PREFIX = "collaborator:";
export const isCollaboratorLabel = (label: string) => label.startsWith(COLLABORATOR_PREFIX);
export const collaboratorName = (label: string) => label.slice(COLLABORATOR_PREFIX.length);

/** The people credited on a bead besides its assignee, in label order. */
export function collaboratorsOf(b: Bead): string[] {
  return (b.labels ?? []).filter(isCollaboratorLabel).map(collaboratorName);
}

/**
 * The labels worth showing as chips. `archived` is state — the views hide on it
 * and the archive button writes it — and `collaborator:` labels are people, so
 * neither is a tag anyone should have to read raw; the drawer already keeps both
 * out of its label editor and shows them as their own controls.
 */
export function displayLabels(b: Bead): string[] {
  return (b.labels ?? []).filter((l) => l !== "archived" && !isCollaboratorLabel(l));
}

// ---- relationship helpers (need the full bead set for lookups) ----

export function makeIndex(beads: Bead[]): Map<string, Bead> {
  const m = new Map<string, Bead>();
  for (const b of beads) m.set(b.id, b);
  return m;
}

export function isBlocked(b: Bead, index: Map<string, Bead>): boolean {
  if (b.status === "blocked") return true;
  if (b.status !== "open") return false;
  return (b.dependencies ?? []).some(
    (d) =>
      d.type === "blocks" &&
      (index.get(d.depends_on_id)?.status ?? "open") !== "closed",
  );
}

export function blockingDeps(b: Bead, index: Map<string, Bead>): string[] {
  return (b.dependencies ?? [])
    .filter(
      (d) =>
        BLOCKING_DEP_TYPES.includes(d.type as never) &&
        (index.get(d.depends_on_id)?.status ?? "open") !== "closed",
    )
    .map((d) => d.depends_on_id);
}

/**
 * The bead's parent, whatever its type. Resolved from the parent-child
 * dependency EDGE — never `bead.parent`, which `bd export --json` omits, so an
 * edge lookup is the only one correct on board/list data as well as in the
 * drawer.
 *
 * Replaces the former `epicOf`, which returned the same thing but was named as
 * though the parent were always an epic — so a task-parented bead rendered a
 * chip labelled "epic" and clicked through to the Epics screen, which renders
 * epics only. Callers now branch on `parent.issue_type` themselves.
 */
export function parentOf(b: Bead, index: Map<string, Bead>): Bead | null {
  const d = (b.dependencies ?? []).find((x) => x.type === "parent-child");
  return d ? index.get(d.depends_on_id) ?? null : null;
}

/**
 * Children per parent id, built in ONE pass over all beads. Callers render
 * per-card counts from this rather than calling childrenOf() per card, which
 * would be an O(n²) scan on a large board.
 */
export function childrenCountMap(beads: Bead[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of beads) {
    for (const d of b.dependencies ?? []) {
      if (d.type === "parent-child") m.set(d.depends_on_id, (m.get(d.depends_on_id) ?? 0) + 1);
    }
  }
  return m;
}

export function childrenOf(epicId: string, beads: Bead[]): Bead[] {
  return beads.filter((b) =>
    (b.dependencies ?? []).some(
      (d) => d.type === "parent-child" && d.depends_on_id === epicId,
    ),
  );
}

export interface ChildProgress {
  closed: number;
  total: number;
  pct: number;
}

/** A parent with nothing under it yet: 0 of 0, and 0% rather than NaN. */
export const NO_PROGRESS: ChildProgress = { closed: 0, total: 0, pct: 0 };

/**
 * Closed-vs-total children per parent id, built in ONE pass over all beads —
 * the progress counterpart to childrenCountMap. A view that renders many
 * parents at once (the Epics screen, and the Board once Type = Epic puts epic
 * cards on it) builds this once rather than calling epicProgress() per card,
 * which is a childrenOf() scan each and O(n^2) on a board that is all epics.
 *
 * A bead counts once per parent even if the data carries the edge twice, so
 * `total` always matches the children childrenOf() hands back.
 */
export function childProgressMap(beads: Bead[]): Map<string, ChildProgress> {
  const counts = new Map<string, { closed: number; total: number }>();
  for (const b of beads) {
    const parents = new Set<string>();
    for (const d of b.dependencies ?? []) {
      if (d.type === "parent-child") parents.add(d.depends_on_id);
    }
    for (const p of parents) {
      const c = counts.get(p) ?? { closed: 0, total: 0 };
      c.total++;
      if (b.status === "closed") c.closed++;
      counts.set(p, c);
    }
  }
  const m = new Map<string, ChildProgress>();
  for (const [id, { closed, total }] of counts) {
    m.set(id, { closed, total, pct: total ? Math.round((closed / total) * 100) : 0 });
  }
  return m;
}

/**
 * One parent's progress — the single-parent form of childProgressMap, so what
 * "% done" means is decided in exactly one place. Callers with more than a
 * couple of parents on screen should build the map once instead.
 */
export function epicProgress(epicId: string, beads: Bead[]): ChildProgress {
  return childProgressMap(beads).get(epicId) ?? NO_PROGRESS;
}

// ---- relative time ----

export function relTime(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const d = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
  return `${Math.floor(d / 2592000)}mo ago`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Full absolute timestamp, e.g. "Jun 24, 2026, 2:15 PM" — used as the hover
 *  title behind relative times like "3d ago" (bead hl2). */
export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
