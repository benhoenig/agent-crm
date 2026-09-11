import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClaimPicker } from "./ClaimPicker";
import { APP_NAME, BRAND } from "@/lib/brand";

export const metadata = { title: `เชื่อมบัญชี LINE — ${APP_NAME}` };

export default async function ClaimPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight">
            {BRAND}<span className="text-accent-text">.</span>
          </div>
          <p className="pt-1 text-sm text-ink-3">คุณคือใคร?</p>
        </div>
        <ClaimPicker />
      </div>
    </main>
  );
}
