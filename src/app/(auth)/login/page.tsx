import { redirect } from "next/navigation";
import { getOwnerId } from "@/lib/auth/server";
import { safeNextPath } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNextPath((await searchParams).next);
  if (await getOwnerId()) redirect(next);

  const t = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <div className="mb-8 text-center">
        <div aria-hidden className="text-4xl">
          📍
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t.appName}
        </h1>
        <p className="mt-1 text-sm text-muted">{t.tagline}</p>
      </div>
      <LoginForm next={next} t={t.auth} />
    </main>
  );
}
