import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sdm/design-system/tokens.css";
import "@sdm/design-system/reset.css";
import "@sdm/design-system/fonts.css";
import { I18nProvider, bootstrapI18n } from "@sdm/i18n";
import App from "./App";
import { loadConfig } from "./bootstrap/config";

async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker({ quiet: false });
  }

  await Promise.all([loadConfig(), bootstrapI18n({ app: "workspace" })]);

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
    root.innerHTML = `<pre style="padding: 2rem; font-family: monospace; color: #f38ba8">Bootstrap failed: ${
      err instanceof Error ? err.message : String(err)
    }</pre>`;
  }
});
