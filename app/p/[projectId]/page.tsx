import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { projectTitle } from "@/lib/app-title";
import { getProject } from "@/lib/config";

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { projectId } = await params;
  const project = getProject(projectId);

  return project ? { title: projectTitle(project.name) } : {};
}

/**
 * Bare project link. The AppShell resolves it against the per-project last-view
 * memory and normalizes the address bar to /p/<projectId>/<view>, so this URL
 * stays a valid "just open the project" entry point without being a state of
 * its own. Suspense: AppShell reads useSearchParams (the filters live there).
 */
export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  return (
    <Suspense fallback={null}>
      <AppShell projectId={projectId} />
    </Suspense>
  );
}
