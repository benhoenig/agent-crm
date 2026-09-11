/* What a page needs to know about the parser BEFORE offering it — no OpenAI
   SDK, no `server-only`, so the paste box (a client component) and the job
   runner can share one sentence instead of drifting into two.

   `aiConfigured()` lives in extract.ts next to the throw it mirrors; only the
   wording is here, because that is the part both sides render. */

/** Shown when OPENAI_API_KEY is unset: on the disabled paste box up front,
    and by messageFor() if a job somehow reaches the runner anyway. */
export const AI_NOT_CONFIGURED =
  "ยังไม่ได้ตั้งค่า AI (ไม่มี API key) — แจ้งแอดมิน";
