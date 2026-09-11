import { PageHeader } from "@/components/ui";
import { getViewer } from "@/lib/auth/session";
import { getZoneOptions } from "@/lib/repo/listings";
import { createProject } from "../actions";
import { ProjectForm } from "../ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await getViewer(); // auth gate — any role may add to the knowledge base
  const zones = await getZoneOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="เพิ่มโครงการ"
        sub="กรอกเท่าที่รู้ — ทุกฟิลด์เป็นข้อความอิสระตามชีตเดิม เติมเพิ่มทีหลังได้"
      />
      <ProjectForm
        action={createProject}
        zones={zones}
        cancelHref="/projects"
        submitLabel="บันทึกโครงการ"
      />
    </div>
  );
}
