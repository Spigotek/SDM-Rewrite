import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { sseEmitFromTest } from "./handlers/events";

// J.3 — expose SSE test seam so Playwright evaluate() can push events.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__sdm_sse_emit"] = sseEmitFromTest;
}

export const worker = setupWorker(...handlers);

export interface StartMockWorkerOptions {
  readonly serviceWorkerUrl?: string;
  readonly quiet?: boolean;
}

export async function startMockWorker(opts: StartMockWorkerOptions = {}): Promise<void> {
  const startOptions: Parameters<typeof worker.start>[0] = {
    onUnhandledRequest: "bypass",
    quiet: opts.quiet ?? false,
  };
  if (opts.serviceWorkerUrl) {
    startOptions.serviceWorker = { url: opts.serviceWorkerUrl };
  }
  await worker.start(startOptions);
}
