import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { projectTitle } from "@/lib/app-title";
import { getProject } from "@/lib/config";
import { isView } from "@/lib/views";

/**
 * The one addressable segment under a project — a VIEW or a BEAD:
 *
 *   /p/<projectId>/board      → the Board (canonical view URL, plus filters
 *                               in the query string; see AppShell)
 *   /p/<projectId>/<beadId>   → that bead's drawer (the original permalink)
 *
 * ONE dynamic segment rather than two, because Next.js can't have `[view]` and
 * `[beadId]` occupy the same position — and because a project has exactly one
 * "thing you named" here. The ten view names win the tie; anything else is a
 * bead id, which is also what makes an unknown segment degrade into the
 * existing "bead not found" toast instead of a 404 (see AppShell).
 *
 * The AppShell keeps the address bar in sync as the view, the filters and the
 * drawer change, so these URLs are always shareable. It normalizes this bead
 * form to /p/<projectId>/<view>?bead=<beadId> on arrival, which is the shape
 * that can also carry a view and its filters; old links keep working.
 *
 * Suspense: AppShell reads useSearchParams, which opts this route's client tree
 * out of prerendering up to the nearest boundary.
 */
type Props = {
  params: Promise<{ projectId: string; segment: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, segment } = await params;
  const project = getProject(projectId);
  if (!project) return {};
  return {
    title: isView(segment) ? projectTitle(project.name) : projectTitle(`${segment} · ${project.name}`),
  };
}

export default async function ProjectSegmentPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <Suspense fallback={null}>
      <AppShell projectId={projectId} />
    </Suspense>
  );
}
