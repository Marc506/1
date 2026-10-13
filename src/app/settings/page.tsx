import { cookies } from "next/headers";
import { BackLink, PageShell } from "@/components/page-shell";
import { logout } from "@/lib/auth/actions";
import { requireOwnerId } from "@/lib/auth/server";
import { LOCALE_COOKIE } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/server";
import { getNavApp } from "@/lib/prefs/server";
import { setLanguageAction, setNavAppAction } from "./actions";

export default async function SettingsPage() {
  await requireOwnerId();
  const [t, navApp, cookieStore] = await Promise.all([
    getDictionary(),
    getNavApp(),
    cookies(),
  ]);
  const s = t.settings;
  const langChoice = cookieStore.get(LOCALE_COOKIE)?.value ?? "auto";

  return (
    <PageShell>
      <BackLink href="/" label={t.home.backToCollections} />
      <h1 className="mt-1 mb-6 text-2xl font-semibold tracking-tight">
        {s.title}
      </h1>

      <Choice
        label={s.navAppLabel}
        help={s.navAppHelp}
        options={[
          { key: "apple", text: s.navApple, active: navApp === "apple" },
          { key: "google", text: s.navGoogle, active: navApp === "google" },
        ].map((o) => ({ ...o, action: setNavAppAction.bind(null, o.key) }))}
      />

      <Choice
        label={s.languageLabel}
        options={[
          { key: "auto", text: s.languageAuto },
          { key: "zh-CN", text: s.languageZh },
          { key: "en", text: s.languageEn },
        ].map((o) => ({
          ...o,
          active: langChoice === o.key,
          action: setLanguageAction.bind(null, o.key),
        }))}
      />

      <form action={logout} className="mt-10 border-t border-border pt-6">
        <button
          type="submit"
          className="h-11 w-full rounded-xl border border-border text-base active:bg-border"
        >
          {t.auth.logout}
        </button>
      </form>
    </PageShell>
  );
}

function Choice({
  label,
  help,
  options,
}: {
  label: string;
  help?: string;
  options: {
    key: string;
    text: string;
    active: boolean;
    action: () => Promise<void>;
  }[];
}) {
  return (
    <section role="group" aria-label={label} className="mb-6">
      <h2 className="mb-1.5 text-sm font-medium">{label}</h2>
      <div
        className="grid gap-1 rounded-xl bg-border/60 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      >
        {options.map((o) => (
          <form key={o.key} action={o.action}>
            <button
              type="submit"
              aria-pressed={o.active}
              className={`flex min-h-10 w-full items-center justify-center rounded-lg px-2 text-sm ${
                o.active ? "bg-surface font-medium shadow-sm" : "text-muted"
              }`}
            >
              {o.text}
            </button>
          </form>
        ))}
      </div>
      {help && <p className="mt-1.5 text-sm text-muted">{help}</p>}
    </section>
  );
}
