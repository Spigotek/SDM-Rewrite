/**
 * J.3 — MSW SSE handler for /api/events.
 *
 * Returns a ReadableStream with Content-Type text/event-stream so the SPA's
 * EventSourceProvider can connect in the browser-test / Storybook environment.
 *
 * Test-fixture seam: `sseTestBus` is module-level. Browser-tests call
 * `window.__sdm_sse_emit(event)` (wired via `packages/api-mocks/src/browser.ts`)
 * to push events into the stream from the Playwright evaluate context.
 *
 * MSW v2 verifies: MSW v2 supports `ReadableStream` responses in both the
 * Node.js integration (using undici's readable-stream polyfill) and the
 * browser Service Worker. Tested against MSW 2.6.6 (the version in package.json).
 *
 * Known limitation: a single stream controller is stored per module instance.
 * Multiple tabs in the same Playwright context share the same MSW worker, so
 * `sseTestBus` emits to ALL connected streams. This is acceptable for J.3's
 * browser-test scenarios (single-tab path for the suspend→logout test).
 */

import { http, HttpResponse } from "msw";

type SseEventType = "connected" | "tenant.suspended" | "session.expired";

interface SsePayload {
  readonly type: SseEventType;
  readonly tenantId?: string;
  readonly reason?: string;
  readonly at: string;
  readonly sessionId?: string;
}

type StreamController = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();

/** All active SSE stream controllers (one per open /api/events connection). */
const controllers = new Set<StreamController>();

/**
 * Emit an SSE event to all open streams.
 * Called by browser-tests via `window.__sdm_sse_emit(payload)`.
 */
export function sseEmitFromTest(payload: SsePayload): void {
  const chunk = encoder.encode(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`);
  for (const ctrl of controllers) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      // Stream already closed — will be cleaned up by cancel.
    }
  }
}

export const sseHandlers = [
  http.get("*/api/events", () => {
    let ctrl: StreamController;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        controllers.add(ctrl);

        // Send initial connected event.
        const connected: SsePayload = {
          type: "connected",
          sessionId: "msw-session",
          at: new Date().toISOString(),
        };
        ctrl.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify(connected)}\n\n`));
      },
      cancel() {
        controllers.delete(ctrl);
      },
    });

    return new HttpResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }),
];
