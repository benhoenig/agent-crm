import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getZoneOptions } from "@/lib/repo/listings";
import { canEditProject, getProject } from "@/lib/repo/projects";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../ProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getViewer();
  const [detail, zones] = await Promise.all([getProject(id), getZoneOptions()]);
  if (!detail) notFound();

  // The survey belongs to whoever did it (Ben, 2026-09-11). Back to the record
  // rather than an error: somebody landing here without the right is following
  // a stale link or an old bookmark, not doing anything wrong. updateProject
  // re-checks regardless — this page is not the boundary.
  if (!canEditProject(viewer, detail.project.createdBy)) redirect(`/projects/${id}`);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={`แก้ไข: ${detail.project.nameEng ?? detail.project.nameThai ?? "โครงการ"}`}
        sub="ทั้งทีมอ่านได้ · แก้ไขได้เฉพาะผู้สำรวจโครงการนี้"
      />
      <ProjectForm
        action={updateProject.bind(null, id)}
        zones={zones}
        defaults={detail.project}
        cancelHref={`/projects/${id}`}
        submitLabel="บันทึกการแก้ไข"
      />
    </div>
  );
}
