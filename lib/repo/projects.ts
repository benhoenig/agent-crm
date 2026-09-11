// Projects repository — the ~50-col survey of each โครงการ.
//
// READS STAY OPEN TO EVERYONE and that is still deliberate (DATA_MODEL §2).
// Ben, 2026-09-11, weighing it again with the numbers in front of him: 616
// surveys, every one attributed, and 1,626 listings pointing at one. Scoping
// reads to the surveyor would mean Su sees 27 of 616 and an agent standing in
// a building somebody else surveyed loses everything known about it — the
// asset is worth having precisely because it is pooled. Reading is now
// RECORDED instead (lib/repo/views.ts), which answers "who took it" without
// breaking "who can use it".
//
// WRITES ARE NOT OPEN ANY MORE. canEditProject() below: the person who did the
// survey owns what it says. Before this, any role could overwrite any of the
// 50 fields of somebody else's fieldwork with no trace — projects have no
// edit history, unlike listings.
//
// Reads therefore still take no Viewer, deliberately, and the write path does.

import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  projectMedia,
  projectPersonas,
  projects,
  users,
  zones,
} from "@/lib/db/schema";
import type { Viewer } from "@/lib/auth/session";

export const PROJECTS_PAGE_SIZE = 25;

export interface ProjectFilters {
  q?: string;
  zoneId?: string;
  page?: number;
}

function projectWhere(f: ProjectFilters): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    parts.push(
      or(
        ilike(projects.nameEng, like),
        ilike(projects.nameThai, like),
        ilike(projects.developer, like),
        ilike(projects.keywords, like)
      )
    );
  }
  if (f.zoneId) parts.push(eq(projects.zoneId, f.zoneId));
  // and() drops undefined and returns undefined for none
  return and(...parts);
}

export async function listProjects(f: ProjectFilters) {
  const db = getDb();
  const where = projectWhere(f);
  const page = Math.max(1, f.page ?? 1);

  // Persona count per project (agent sheets had Persona 1–10 as columns).
  const pc = db
    .select({
      projectId: projectPersonas.projectId,
      personaCount: count(projectPersonas.id).as("persona_count"),
    })
    .from(projectPersonas)
    .groupBy(projectPersonas.projectId)
    .as("pc");

  /* The cover photo per project, in one pass.

     array_agg(...)[1] rather than DISTINCT ON: drizzle has no first-class
     DISTINCT ON, and a correlated subquery in the SELECT would run once per
     row — twenty-five extra lookups a page for a thumbnail. The ordering
     inside the aggregate is the same one getProjectMedia uses, so the list's
     cover is always the record's cover. */
  const cover = db
    .select({
      projectId: projectMedia.projectId,
      r2Key: sql<string>`(array_agg(${projectMedia.r2Key} order by ${projectMedia.sortOrder}, ${projectMedia.createdAt}))[1]`.as(
        "cover_key"
      ),
    })
    .from(projectMedia)
    .groupBy(projectMedia.projectId)
    .as("cover");

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        coverKey: cover.r2Key,
        id: projects.id,
        nameEng: projects.nameEng,
        nameThai: projects.nameThai,
        propertyType: projects.propertyType,
        developer: projects.developer,
        yearBuilt: projects.yearBuilt,
        units: projects.units,
        zoneName: zones.nameThai,
        zoneCode: zones.code,
        personaCount: pc.personaCount,
      })
      .from(projects)
      .leftJoin(zones, eq(projects.zoneId, zones.id))
      .leftJoin(pc, eq(pc.projectId, projects.id))
      .leftJoin(cover, eq(cover.projectId, projects.id))
      .where(where)
      .orderBy(desc(projects.updatedAt))
      .limit(PROJECTS_PAGE_SIZE)
      .offset((page - 1) * PROJECTS_PAGE_SIZE),
    db.select({ total: count() }).from(projects).where(where),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE)),
  };
}

export type ProjectRow = Awaited<
  ReturnType<typeof listProjects>
>["rows"][number];

export async function getProject(id: string) {
  const [row] = await getDb()
    .select({
      project: projects,
      zone: {
        code: zones.code,
        nameEng: zones.nameEng,
        nameThai: zones.nameThai,
      },
      /* Who did the fieldwork. Shown on the record because the survey is one
         person's work and, since canEditProject(), the name also explains why
         the แก้ไข button is missing for everybody else — a disabled control
         with no reason beside it reads as a bug. */
      surveyorName: users.name,
    })
    .from(projects)
    .leftJoin(zones, eq(projects.zoneId, zones.id))
    .leftJoin(users, eq(users.id, projects.createdBy))
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * May this viewer change the survey — its fields, and its photos?
 *
 * THE SURVEYOR, OR SOMEBODY HOLDING `settings`. The survey is one person's
 * fieldwork and there is no edit history on projects, so an anonymous
 * overwrite of another agent's 50 fields is unrecoverable — that is the hole
 * being closed.
 *
 * WHY THE OVERRIDE EXISTS AT ALL: 616 surveys are attributed to six people,
 * and the day one of them leaves their 136 surveys must not become permanently
 * uneditable. `settings` (ซูเปอร์แอดมิน) is the escape hatch, and the durable
 * fix for a departure is to hand the rows over — reassigning created_by — not
 * to widen this.
 *
 * ADDING A PERSONA IS NOT EDITING and is deliberately left open to everyone:
 * it is contributing what you know about who buys there, which is the one part
 * of this record the whole team writes together.
 */
export function canEditProject(
  viewer: Viewer,
  createdBy: string | null
): boolean {
  return viewer.perms.settings || (createdBy !== null && createdBy === viewer.userId);
}

/** The gallery, cover first. See projectMedia — order IS the cover choice. */
export async function getProjectMedia(projectId: string) {
  return getDb()
    .select({
      id: projectMedia.id,
      r2Key: projectMedia.r2Key,
      caption: projectMedia.caption,
      sortOrder: projectMedia.sortOrder,
      uploaderName: users.name,
    })
    .from(projectMedia)
    .leftJoin(users, eq(users.id, projectMedia.uploadedBy))
    .where(eq(projectMedia.projectId, projectId))
    .orderBy(asc(projectMedia.sortOrder), asc(projectMedia.createdAt));
}

export async function getPersonas(projectId: string) {
  return getDb()
    .select({
      id: projectPersonas.id,
      persona: projectPersonas.persona,
      trustTrigger: projectPersonas.trustTrigger,
      salesName: users.name,
      createdAt: projectPersonas.createdAt,
    })
    .from(projectPersonas)
    .leftJoin(users, eq(projectPersonas.salesId, users.id))
    .where(eq(projectPersonas.projectId, projectId))
    .orderBy(asc(projectPersonas.createdAt));
}
