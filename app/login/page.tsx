import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { lineLoginConfigured } from "@/lib/auth/line-login";
import { LoginPanel } from "./LoginPanel";
import { APP_NAME, BRAND } from "@/lib/brand";

export const metadata = { title: `เข้าสู่ระบบ — ${APP_NAME}` };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight">
            {BRAND}<span className="text-accent-text">.</span>
          </div>
          <p className="pt-1 text-sm text-ink-3">เข้าสู่ระบบเพื่อใช้งาน CRM</p>
        </div>
        <LoginPanel lineEnabled={lineLoginConfigured()} error={error} />
      </div>
    </main>
  );
}
