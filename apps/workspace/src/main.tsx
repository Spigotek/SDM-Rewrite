import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sdm/design-system/tokens.css";
import "@sdm/design-system/reset.css";
import "@sdm/design-system/fonts.css";
import { I18nProvider, bootstrapI18n } from "@sdm/i18n";
import App from "./App";
import { loadConfig } from "./bootstrap/config";
import { initSentry } from "./bootstrap/sentry";

async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker({ quiet: false });
  }

  const [config] = await Promise.all([loadConfig(), bootstrapI18n({ app: "workspace" })]);
  // Sentry init runs BEFORE React render so render-time throws are captured.
  // No-op when DSN is missing (mock mode / dev without a Sentry project).
  initSentry({ observability: config.observability, appVersion: config.meta.appVersion });

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("[workspace] root element #root not found in index.html");

  createRoot(rootEl).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

bootstrap().catch((err: unknown) => {
  console.error("[workspace] bootstrap failed", err);
  const root = document.getElementById("root");
  if (root) {
    const message = err instanceof Error ? err.message : String(err);
    const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    root.innerHTML = `<main role="alert" aria-live="assertive" style="padding:2rem;max-width:48rem;margin:0 auto;font-family:system-ui,sans-serif;color:#1f2937"><h1 style="font-size:1.5rem;margin:0 0 1rem">Workspace sa nepodarilo načítať</h1><p style="margin:0 0 0.5rem">Workspace nemohol kontaktovať server. Skús stránku obnoviť o chvíľu.</p><p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#7f1d1d;background:#fee2e2;padding:0.75rem;border-radius:0.375rem;border:1px solid #fecaca">${safe}</p></main>`;
  }
});
