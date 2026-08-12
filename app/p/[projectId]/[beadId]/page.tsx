import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { projectTitle } from "@/lib/app-title";
import { getProject } from "@/lib/config";

/**
 * Permalink to a single bead: /p/<projectId>/<beadId> opens the project with
 * that bead's detail drawer already open. The AppShell keeps the address bar
 * in sync as the drawer opens/closes, so this URL is always shareable.
 */
type Props = {
  params: Promise<{ projectId: string; beadId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId, beadId } = await params;
  const project = getProject(projectId);

  return project ? { title: projectTitle(`${beadId} · ${project.name}`) } : {};
}

export default async function BeadPermalinkPage({ params }: Props) {
  const { projectId, beadId } = await params;
  return <AppShell projectId={projectId} initialBeadId={beadId} />;
}
