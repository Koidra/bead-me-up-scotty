/**
 * The app's top-level screens, as data rather than a bare union type: the view
 * is a URL path segment now (/p/<project>/<view>), so both the router and the
 * last-view memory need to ask "is this string a view?" at runtime.
 *
 * Deliberately NOT a client module — `app/p/[projectId]/[segment]/page.tsx`
 * imports isView on the server to title a view URL differently from a bead
 * permalink.
 */
export const VIEWS = [
  "board",
  "list",
  "epics",
  "graph",
  "insights",
  "activity",
  "needsyou",
  "achievements",
  "publish",
  "settings",
] as const;

export type View = (typeof VIEWS)[number];

export function isView(v: string | null | undefined): v is View {
  return typeof v === "string" && (VIEWS as readonly string[]).includes(v);
}
