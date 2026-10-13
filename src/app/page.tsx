import { getDictionary } from "@/lib/i18n/server";

export default async function Home() {
  const t = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <header className="py-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.appName}</h1>
        <p className="mt-1 text-sm text-muted">{t.tagline}</p>
      </header>
      <section className="mt-4 rounded-2xl border border-border bg-surface px-5 py-10 text-center">
        <div aria-hidden className="text-4xl">
          📍
        </div>
        <h2 className="mt-3 text-base font-medium">{t.home.emptyTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.home.emptyBody}</p>
      </section>
    </main>
  );
}
