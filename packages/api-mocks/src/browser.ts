import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

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
