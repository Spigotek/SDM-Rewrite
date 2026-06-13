/**
 * Critical-path i18n dictionary — every string reachable from the portal entry
 * graph at FCP.
 *
 * I.0 Resolution 4: `vendor-i18n` (27 KB gz) is moved out of the eager bundle
 * via `i18n-shim.ts`. While the full `@sdm/i18n` catalog is lazy-loading after
 * first render, components that call `useTranslation()` resolve keys through
 * this tiny static map instead.
 *
 * Coverage requirement: ANY key used by a component reachable from
 * `main.tsx → <App> → <RouterProvider> → <RootLayout> → <SessionProvider> →
 * <AppShell> → <TopBar>/<HomeRoute>/...` MUST appear here. A missing key
 * surfaces the raw `errors.foo` string in the UI until hydration completes —
 * a visible bug. The keys + Slovak/English values mirror the catalogs in
 * `packages/i18n/catalogs/portal/{sk,en}.json` and the shared catalog so the
 * post-hydration re-render does not change text (no flicker, no layout shift).
 *
 * Bundle weight target: < 1 KB gz. Two locales × ~30 keys = trivial.
 */

import type { Locale } from "@sdm/i18n";

type CriticalDict = Readonly<Record<string, string>>;

// Mirrors `packages/i18n/catalogs/{shared,portal}/sk.json` for every key listed
// below. If you add a `t("foo")` call to a component on the FCP path, add the
// key here BEFORE shipping the change.
const CRITICAL_SK: CriticalDict = {
  // shared.meta
  "meta.loading": "Načítavam…",
  "meta.noRoles": "bez rolí",
  // shared.actions (login + idle modal + topbar)
  "actions.signIn": "Prihlásiť sa",
  "actions.signOut": "Odhlásiť sa",
  "actions.signingIn": "Prihlasujem…",
  "actions.continue": "Pokračovať",
  // shared.errors (login + boundaries + session)
  "errors.loginCredentialsRequired": "Vyplň meno aj heslo.",
  "errors.loginFailed": "Prihlásenie zlyhalo.",
  "errors.sessionLoadFailed": "Reláciu sa nepodarilo načítať: {detail}",
  "errors.boundaryTitle": "Niečo sa pokazilo",
  "errors.boundaryBody": "Skús obnoviť stránku. Ak to pokračuje, kontaktuj podporu.",
  "errors.boundaryRefresh": "Obnoviť stránku",
  "errors.notFoundTitle": "Stránka sa nenašla",
  "errors.notFoundBody":
    "Hľadanú stránku sme nenašli. Možno bola presunutá alebo si zadal zlú URL.",
  "errors.notFoundHome": "Späť na hlavnú",
  // shared.session (idle modal — countdown text uses simplified plural)
  "session.idleTitle": "Relácia čoskoro vyprší",
  "session.idleBody": "Tvoja relácia vyprší o {count} s. Chceš pokračovať?",
  // shared.language (language switcher in topbar)
  "language.label": "Jazyk",
  "language.sk": "Slovenčina",
  "language.en": "Angličtina",
  // portal:shell (login page)
  "portal:shell.loginHint": "Prihlás sa do Service Desk-u.",
  "portal:shell.username": "Používateľské meno",
  "portal:shell.password": "Heslo",
  // portal.appName (Home H1 visually-hidden)
  appName: "SDM Portál",
  // portal.home (HomeRoute + HeroGreeting + QuickActions + KbSearchBar + KPI + cards)
  "home.greeting": "Dobrý deň, {name}.",
  "home.greetingAnonymous": "Dobrý deň.",
  "home.subgreeting": "Akú pomoc dnes potrebujete?",
  "home.hero.popularLabel": "Populárne:",
  "home.kbSearch.label": "Hľadať v báze znalostí",
  "home.kbSearch.placeholder": "Hľadať v báze znalostí alebo katalógu služieb…",
  "home.kbSearch.resultsLabel": "Návrhy z bázy znalostí",
  "home.kbSearch.emptyTitle": "Nič som nenašiel",
  "home.kbSearch.emptyDescription": "Skús inú formuláciu alebo otvor ticket.",
  "home.stats.ariaLabel": "Prehľad mojich ticketov",
  "home.stats.open": "Otvorené",
  "home.stats.awaiting": "Čakajúce na odpoveď",
  "home.stats.resolvedThisWeek": "Vybavené tento týždeň",
  "home.quickActions.ariaLabel": "Rýchle akcie",
  "home.quickActions.report.title": "Nahlásiť problém",
  "home.quickActions.report.body": "Niečo nefunguje — laptop, prístup, sieť.",
  "home.quickActions.catalog.title": "Hardvér / Softvér",
  "home.quickActions.catalog.body": "Vyber si zo služobného katalógu.",
  "home.quickActions.password.title": "Reset hesla",
  "home.quickActions.password.body": "Rýchly tiket na obnovu prístupu.",
  "home.myTickets.title": "Moje otvorené tickety",
  "home.myTickets.seeAll": "Všetky →",
  "home.myTickets.empty":
    "Zatiaľ žiadne tickety. Keď niečo budeš potrebovať, nahlás problém alebo požiadaj o niečo.",
  "home.myTickets.emptyTitle": "Žiadne otvorené tickety",
  "home.myTickets.error": "Tickety sa nepodarilo načítať. Skús stránku obnoviť.",
  "home.announcements.title": "Oznámenia",
  "home.announcements.items.wifi.title": "Wi-Fi servis 13. 6.",
  "home.announcements.items.catalog.title": "Nový katalóg služieb otvorený",
  "home.announcements.items.vpn.title": "VPN reauth každých 12 hodín",
  "home.catalog.title": "Katalóg služieb",
  "home.catalog.seeAll": "Všetko →",
  "home.activity.title": "Posledná aktivita",
  "home.activity.actorSystem": "Systém",
  "home.activity.verbStatusChange": "aktualizoval stav ticketu",
  "home.activity.empty": "Tu sa budú zobrazovať najnovšie zmeny tvojich ticketov.",
  "home.activity.emptyTitle": "Žiadna aktivita",
  "home.activity.error": "Aktivitu sa nepodarilo načítať.",
  // catalog labels reused by CatalogTeaser tiles
  "catalogBrowse.categories.hardware": "Hardvér",
  "catalogBrowse.categories.software": "Softvér",
  "catalogBrowse.categories.access": "Prístupy",
  "catalogBrowse.categories.other": "Iné",
};

const CRITICAL_EN: CriticalDict = {
  "meta.loading": "Loading…",
  "meta.noRoles": "no roles",
  "actions.signIn": "Sign in",
  "actions.signOut": "Sign out",
  "actions.signingIn": "Signing in…",
  "actions.continue": "Continue",
  "errors.loginCredentialsRequired": "Fill in both username and password.",
  "errors.loginFailed": "Login failed.",
  "errors.sessionLoadFailed": "Couldn't load session: {detail}",
  "errors.boundaryTitle": "Something went wrong",
  "errors.boundaryBody": "Try refreshing the page. If this keeps happening, contact support.",
  "errors.boundaryRefresh": "Refresh page",
  "errors.notFoundTitle": "Page not found",
  "errors.notFoundBody": "We couldn't find that page. It may have moved or the URL is wrong.",
  "errors.notFoundHome": "Back to home",
  "session.idleTitle": "Session expiring soon",
  "session.idleBody": "Your session expires in {count}s. Continue?",
  "language.label": "Language",
  "language.sk": "Slovak",
  "language.en": "English",
  "portal:shell.loginHint": "Sign in to Service Desk.",
  "portal:shell.username": "Username",
  "portal:shell.password": "Password",
  appName: "SDM Portal",
  "home.greeting": "Hello, {name}.",
  "home.greetingAnonymous": "Hello.",
  "home.subgreeting": "What can we help you with today?",
  "home.hero.popularLabel": "Popular:",
  "home.kbSearch.label": "Search the knowledge base",
  "home.kbSearch.placeholder": "Search the knowledge base or service catalog…",
  "home.kbSearch.resultsLabel": "Knowledge base suggestions",
  "home.kbSearch.emptyTitle": "Nothing found",
  "home.kbSearch.emptyDescription": "Try different wording, or open a ticket.",
  "home.stats.ariaLabel": "My ticket overview",
  "home.stats.open": "Open",
  "home.stats.awaiting": "Awaiting response",
  "home.stats.resolvedThisWeek": "Resolved this week",
  "home.quickActions.ariaLabel": "Quick actions",
  "home.quickActions.report.title": "Report a problem",
  "home.quickActions.report.body": "Something isn't working — laptop, access, network.",
  "home.quickActions.catalog.title": "Hardware / Software",
  "home.quickActions.catalog.body": "Pick from the service catalog.",
  "home.quickActions.password.title": "Password reset",
  "home.quickActions.password.body": "Quick ticket to restore your access.",
  "home.myTickets.title": "My open tickets",
  "home.myTickets.seeAll": "All →",
  "home.myTickets.empty":
    "No tickets yet. When you need something, report a problem or request something.",
  "home.myTickets.emptyTitle": "No open tickets",
  "home.myTickets.error": "Couldn't load tickets. Try refreshing the page.",
  "home.announcements.title": "Announcements",
  "home.announcements.items.wifi.title": "Wi-Fi maintenance Jun 13",
  "home.announcements.items.catalog.title": "New service catalog is open",
  "home.announcements.items.vpn.title": "VPN re-auth every 12 hours",
  "home.catalog.title": "Service catalog",
  "home.catalog.seeAll": "All →",
  "home.activity.title": "Recent activity",
  "home.activity.actorSystem": "System",
  "home.activity.verbStatusChange": "updated ticket status",
  "home.activity.empty": "Recent ticket updates will appear here.",
  "home.activity.emptyTitle": "No activity",
  "home.activity.error": "Couldn't load activity.",
  "catalogBrowse.categories.hardware": "Hardware",
  "catalogBrowse.categories.software": "Software",
  "catalogBrowse.categories.access": "Access",
  "catalogBrowse.categories.other": "Other",
};

const DICTIONARIES: Readonly<Record<Locale, CriticalDict>> = {
  sk: CRITICAL_SK,
  en: CRITICAL_EN,
};

/**
 * Detect the critical-path locale at module init. Read order matches
 * `@sdm/i18n`'s `detectLocale` so post-hydration `t()` produces the same
 * locale as the critical-path `t()` (no flicker on first user interaction).
 *
 * `<html lang>` is the primary signal — `apps/portal/index.html` ships
 * `lang="sk"` by default and the prerender's inline script flips it to "en"
 * when `localStorage["sdm.locale"]` or `navigator.language` resolves to EN.
 */
export function detectCriticalLocale(): Locale {
  if (typeof document !== "undefined") {
    const htmlLang = document.documentElement.lang?.toLowerCase() ?? "";
    if (htmlLang.startsWith("en")) return "en";
    if (htmlLang.startsWith("sk")) return "sk";
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("en")) return "en";
  }
  return "sk";
}

/**
 * Minimal `t(key, vars)` — looks up the critical dictionary for the resolved
 * locale, interpolates `{name}`-style placeholders, and falls back to the key
 * itself when missing. Coverage gaps surface as raw keys in the UI — a visible
 * red flag, not silent.
 *
 * Namespace prefixes (`portal:foo.bar`) are preserved as-is in the lookup key
 * so consumers can call `t("portal:shell.loginHint")` exactly as they would
 * against the real i18next.
 */
export function criticalT(
  key: string,
  vars?: Record<string, string | number>,
  locale?: Locale,
): string {
  const dict = DICTIONARIES[locale ?? detectCriticalLocale()];
  const raw = dict[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
