import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS === "true") {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker({ quiet: false });
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("[portal] root element #root not found in index.html");

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
