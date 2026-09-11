"use server";

// Project mutations.
//
// ANY ROLE MAY STILL CREATE ONE, and the whole team still reads them — a
// survey is pooled knowledge and 1,626 listings depend on it (see
// lib/repo/projects.ts).
//
// EDITING IS NOT POOLED ANY MORE (Ben, 2026-09-11). Until now any role could
// overwrite any of the ~50 fields of somebody else's fieldwork, and projects
// carry no edit history — unlike listings, which log every changed column —
// so the previous value was simply gone and nobody could say who took it. The
// person who did the survey owns what it says; canEditProject() is the rule
// and ซูเปอร์แอดมิน is the escape hatch for a surveyor who has left.
//
// EVERY WRITE RE-CHECKS. These are "use server" exports, so each one is an
// HTTP endpoint that anybody logged in can call with any id — hiding the edit
// button is not a permission.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deleteMedia, putMedia } from "@/lib/media/r2";
import { projectMedia, projectPersonas, projects } from "@/lib/db/schema";
import { getViewer } from "@/lib/auth/session";
import { reqStr, str } from "@/lib/forms";
import { optionStr } from "@/lib/repo/options";
import { canEditProject } from "@/lib/repo/projects";
import type { Viewer } from "@/lib/auth/session";

// All quantity-ish columns are TEXT on purpose — the sheet data is free text
// ("ประมาณ 2,248 ยูนิต", "45 บาท/ตรม./เดือน"). Never parsed, stored as typed.
// zoneRaw is import provenance and is intentionally NOT form-editable.
function parseProjectForm(fd: FormData) {
  return {
    nameEng: str(fd, "nameEng"),
    nameThai: str(fd, "nameThai"),
    propertyType: str(fd, "propertyType"),
    zoneId: str(fd, "zoneId"),
    developer: str(fd, "developer"),
    yearBuilt: str(fd, "yearBuilt"),
    buildings: str(fd, "buildings"),
    floors: str(fd, "floors"),
    units: str(fd, "units"),
    unitsPerFloor: str(fd, "unitsPerFloor"),
    segment: str(fd, "segment"),
    commonFee: str(fd, "commonFee"),
    commonFeeTerms: str(fd, "commonFeeTerms"),
    commonFeeCollectionPct: str(fd, "commonFeeCollectionPct"),
    juristicPerson: str(fd, "juristicPerson"),
    parkingRatio: str(fd, "parkingRatio"),
    extraParkingPurchasable: str(fd, "extraParkingPurchasable"),
    extraParkingFee: str(fd, "extraParkingFee"),
    avgPricePerSqm: str(fd, "avgPricePerSqm"),
    rentalYield: str(fd, "rentalYield"),
    comparables: str(fd, "comparables"),
    unitTypes: str(fd, "unitTypes"),
    ceilingHeight: str(fd, "ceilingHeight"),
    bestView: str(fd, "bestView"),
    bestDirection: str(fd, "bestDirection"),
    bestPosition: str(fd, "bestPosition"),
    nationalityMix: str(fd, "nationalityMix"),
    petsAllowed: str(fd, "petsAllowed"),
    smokingAllowed: str(fd, "smokingAllowed"),
    shops: str(fd, "shops"),
    nearestStationInfo: str(fd, "nearestStationInfo"),
    shuttleInfo: str(fd, "shuttleInfo"),
    keywords: str(fd, "keywords"),
    targetCustomers: str(fd, "targetCustomers"),
    concept: str(fd, "concept"),
    pros: str(fd, "pros"),
    cons: str(fd, "cons"),
    highlights: str(fd, "highlights"),
    commonFacilities: str(fd, "commonFacilities"),
    quakeRepairHistory: str(fd, "quakeRepairHistory"),
    quakeSafetyCert: str(fd, "quakeSafetyCert"),
    quakeInsurance: str(fd, "quakeInsurance"),
    quakeExteriorCracks: str(fd, "quakeExteriorCracks"),
    quakeJointsCondition: str(fd, "quakeJointsCondition"),
    quakeInteriorCondition: str(fd, "quakeInteriorCondition"),
  };
}

export async function createProject(fd: FormData) {
  const viewer = await getViewer();
  const values = parseProjectForm(fd);

  const [created] = await getDb()
    .insert(projects)
    .values({ ...values, createdBy: viewer.userId })
    .returning({ id: projects.id });

  revalidatePath("/projects");
  redirect(`/projects/${created.id}`);
}

/**
 * The survey, if this viewer may change it. Redirects to the record otherwise
 * — a refusal here means somebody is looking at a stale edit button or calling
 * the endpoint directly, and neither wants an error page.
 */
async function requireEditable(id: string): Promise<Viewer> {
  const viewer = await getViewer();
  const [row] = await getDb()
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!row) redirect("/projects");
  if (!canEditProject(viewer, row.createdBy)) redirect(`/projects/${id}`);
  return viewer;
}

export async function updateProject(id: string, fd: FormData) {
  await requireEditable(id);
  const values = parseProjectForm(fd);

  await getDb().update(projects).set(values).where(eq(projects.id, id));

  revalidatePath(`/projects/${id}`);
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

/* ── photos (R2) ───────────────────────────────────────────────────────── */

/* Images only, unlike listing media, which also takes MP4/MOV/PDF. A survey
   gallery is there to make the place legible at a glance; a video nobody can
   preview and a PDF are documents, and this is not a document store. */
const PHOTO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Add one photo to the survey gallery. Surveyor (or ซูเปอร์แอดมิน) only. */
export async function uploadProjectPhoto(projectId: string, fd: FormData) {
  const viewer = await requireEditable(projectId);
  const db = getDb();

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/projects/${projectId}`);
  }
  const ext = PHOTO_EXT[file.type];
  if (!ext) redirect(`/projects/${projectId}`);

  const key = `projects/${projectId}/${Date.now()}${ext}`;
  await putMedia(key, await file.arrayBuffer(), file.type);

  // Appended at the end, so the FIRST photo uploaded becomes the cover and
  // stays it until somebody moves one — no separate cover flag to disagree
  // with the order.
  const [{ maxOrder }] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${projectMedia.sortOrder}), -1)`,
    })
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId));

  await db.insert(projectMedia).values({
    projectId,
    r2Key: key,
    caption: str(fd, "caption"),
    sortOrder: Number(maxOrder) + 1,
    uploadedBy: viewer.userId,
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

/** Remove a photo: R2 object then row. */
export async function deleteProjectPhoto(projectId: string, mediaId: string) {
  await requireEditable(projectId);
  const db = getDb();
  const [row] = await db
    .select({ r2Key: projectMedia.r2Key })
    .from(projectMedia)
    .where(
      and(eq(projectMedia.id, mediaId), eq(projectMedia.projectId, projectId))
    )
    .limit(1);
  if (!row) redirect(`/projects/${projectId}`);

  await deleteMedia(row.r2Key);
  await db.delete(projectMedia).where(eq(projectMedia.id, mediaId));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

/** Make one photo the cover by sorting it to the front. */
export async function makeProjectCover(projectId: string, mediaId: string) {
  await requireEditable(projectId);
  const db = getDb();
  const [{ minOrder }] = await db
    .select({
      minOrder: sql<number>`coalesce(min(${projectMedia.sortOrder}), 0)`,
    })
    .from(projectMedia)
    .where(eq(projectMedia.projectId, projectId));

  await db
    .update(projectMedia)
    .set({ sortOrder: Number(minOrder) - 1 })
    .where(
      and(eq(projectMedia.id, mediaId), eq(projectMedia.projectId, projectId))
    );
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

/** Add a buyer persona; salesId = whoever contributes the knowledge. */
export async function addPersona(projectId: string, fd: FormData) {
  const viewer = await getViewer();

  await getDb().insert(projectPersonas).values({
    projectId,
    salesId: viewer.userId,
    persona: reqStr(fd, "persona"),
    trustTrigger: await optionStr(fd, "trustTrigger", "trust_trigger"),
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

/**
 * Delete a persona — YOUR OWN, or anybody's if you own the survey.
 *
 * It used to be open to every role ("personas are shared knowledge, curated
 * together"), which is true of ADDING one and not of deleting: a persona is a
 * named claim by one agent about who buys there, it is not versioned, and a
 * deletion took it away with no record of who or what. Contributing stays open
 * to everyone; removing somebody else's contribution does not.
 */
export async function deletePersona(projectId: string, personaId: string) {
  const viewer = await getViewer();
  const db = getDb();
  const [row] = await db
    .select({ salesId: projectPersonas.salesId, createdBy: projects.createdBy })
    .from(projectPersonas)
    .innerJoin(projects, eq(projects.id, projectPersonas.projectId))
    .where(
      and(
        eq(projectPersonas.id, personaId),
        eq(projectPersonas.projectId, projectId)
      )
    )
    .limit(1);
  if (!row) redirect(`/projects/${projectId}`);

  const mine = row.salesId !== null && row.salesId === viewer.userId;
  if (!mine && !canEditProject(viewer, row.createdBy)) {
    redirect(`/projects/${projectId}`);
  }

  await db.delete(projectPersonas).where(eq(projectPersonas.id, personaId));
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
