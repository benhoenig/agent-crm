/* The survey's photos — cover, gallery, and (for whoever owns the survey) the
   upload box.
 *
 * Ben, 2026-09-11: "ใส่รูปได้ + ปรับให้ format อ่านง่ายขึ้นเหมือนดูทรัพย์ใน
 * website". A property site opens with the building, not with a field called
 * "ประเภทโครงการ", and the 616 surveys here had ~50 fields each and not one
 * picture. This is the half of "อ่านง่ายขึ้น" that is not typography.
 *
 * THE FIRST PHOTO IS THE COVER, because sort order IS the cover choice —
 * there is no is_cover column that could disagree with the order (see
 * projectMedia). "ตั้งเป็นปก" therefore just sorts one photo to the front,
 * which is a single UPDATE and cannot leave two covers behind.
 *
 * NO LIGHTBOX. Each photo links to the full image, which the browser already
 * renders well, and a survey gallery is looked at while somebody is on the
 * phone to an owner — a modal that traps focus is the wrong thing there. The
 * link also means ⌘-click and "open in new tab" behave, which a lightbox
 * breaks and which is how people actually compare two buildings.
 */

import { ImagePlus } from "lucide-react";
import { Button, Card, CardHeader, Field, Input } from "@/components/ui";
import {
  deleteProjectPhoto,
  makeProjectCover,
  uploadProjectPhoto,
} from "@/app/(app)/projects/actions";

export interface ProjectPhoto {
  id: string;
  r2Key: string;
  caption: string | null;
  uploaderName: string | null;
}

export function ProjectCover({
  photo,
  name,
  sub,
}: {
  photo: ProjectPhoto | null;
  name: string;
  sub: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface-2">
      {photo ? (
        /* Fixed aspect rather than the image's own: 616 surveys will carry
           photos shot on every phone in the office, and a hero that changes
           height per project makes the page jump as you move between them.
           object-cover crops; it never letterboxes a lobby into a grey band. */
        <div className="aspect-[16/7] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/media/${photo.r2Key}`}
            alt={photo.caption ?? name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/7] w-full items-center justify-center bg-surface-3">
          <span className="flex flex-col items-center gap-2 text-ink-3">
            <ImagePlus size={22} />
            <span className="text-xs">ยังไม่มีรูปโครงการ</span>
          </span>
        </div>
      )}

      {/* The name sits ON the photo, the way a listing page does it. The
          gradient is what keeps white text legible over a bright sky — a flat
          overlay would dim the picture everywhere to fix the top strip. */}
      {photo && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-4 pt-14">
          <h1 className="text-xl font-bold text-white drop-shadow-sm">{name}</h1>
          {sub && (
            <p className="pt-0.5 text-sm text-white/85 drop-shadow-sm">{sub}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectGallery({
  projectId,
  photos,
  canEdit,
}: {
  projectId: string;
  photos: ProjectPhoto[];
  canEdit: boolean;
}) {
  // Nothing to show and nothing they may do about it — render no card at all
  // rather than an empty shelf on every survey somebody else made.
  if (photos.length === 0 && !canEdit) return null;

  // The cover is already the hero above; the shelf is everything after it.
  const rest = photos.slice(1);

  return (
    <Card>
      <CardHeader
        title="รูปโครงการ"
        action={
          <span className="text-xs text-ink-3">
            {photos.length > 0
              ? `${photos.length} รูป · รูปแรกคือรูปปก`
              : "ล็อบบี้ · ส่วนกลาง · วิว · ทางเข้า"}
          </span>
        }
      />

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 lg:grid-cols-4">
          {rest.map((m) => (
            <figure key={m.id} className="group space-y-1.5">
              <a
                href={`/media/${m.r2Key}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-ctl border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/media/${m.r2Key}`}
                  alt={m.caption ?? ""}
                  className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </a>
              <figcaption className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[0.7rem] text-ink-3">
                  {m.caption ?? m.uploaderName ?? ""}
                </span>
                {canEdit && (
                  <span className="flex shrink-0 gap-1">
                    <form action={makeProjectCover.bind(null, projectId, m.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        className="px-1.5 py-0.5 text-[0.65rem]"
                      >
                        ตั้งเป็นปก
                      </Button>
                    </form>
                    <form
                      action={deleteProjectPhoto.bind(null, projectId, m.id)}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        className="px-1.5 py-0.5 text-[0.65rem]"
                      >
                        ลบ
                      </Button>
                    </form>
                  </span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {canEdit && (
        <form
          action={uploadProjectPhoto.bind(null, projectId)}
          className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4"
        >
          <Field label="เพิ่มรูป" className="w-full max-w-xs">
            {/* JPG/PNG/WebP only — the action refuses anything else, and the
                accept attribute keeps that refusal out of the user's way
                instead of letting them pick a HEIC and be redirected. */}
            <Input
              type="file"
              name="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="py-1.5 text-xs"
            />
          </Field>
          <Field label="คำอธิบาย (ไม่บังคับ)" className="w-full max-w-xs">
            <Input
              name="caption"
              placeholder="เช่น ล็อบบี้ชั้น 1 / วิวทิศเหนือ"
              className="py-1.5 text-xs"
            />
          </Field>
          <Button type="submit" variant="secondary">
            อัปโหลด
          </Button>
          {photos.length > 0 && (
            <span className="text-[0.7rem] text-ink-3">
              รูปที่เพิ่มใหม่จะต่อท้าย — กด “ตั้งเป็นปก” เพื่อเปลี่ยนรูปปก
            </span>
          )}
        </form>
      )}

      {photos.length > 0 && rest.length === 0 && !canEdit && (
        <p className="px-5 pb-4 text-xs text-ink-3">มีรูปเดียว — แสดงเป็นรูปปกด้านบน</p>
      )}
    </Card>
  );
}
