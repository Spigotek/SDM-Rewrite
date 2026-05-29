/**
 * Workspace route configuration — `createBrowserRouter` data router per ADR-05.
 *
 * The root route is `<AppShell />`. Every child route uses `lazy:` for
 * code-splitting. The index route redirects to `/queue` (Anna persona's
 * default landing per `screen-inventory.md`).
 *
 * Permission guards are introduced by feature chunks (H.7+) — H.0 wires the
 * `guardedLazy()` helper but applies it sparingly so placeholder content
 * remains reachable for the existing smoke tests.
 */

import { createBrowserRouter, Outlet, redirect } from "react-router-dom";
import { AppShell } from "../shell/app-shell";
import { ErrorBoundary } from "../shell/error-boundary";
import { SessionProvider } from "../shell/session-context";
import { RootErrorBoundary, NotFoundElement } from "./error-boundaries";

function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppShell appName="Service Desk Workspace">
          <Outlet />
        </AppShell>
      </SessionProvider>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        index: true,
        loader: () => redirect("/queue"),
      },
      {
        path: "queue",
        lazy: async () => ({
          Component: (await import("../features/queue/QueueRoute")).default,
        }),
      },
      {
        path: "tickets/:id",
        lazy: async () => ({
          Component: (await import("../features/tickets/TicketDetailRoute")).default,
        }),
      },
      {
        path: "changes",
        lazy: async () => ({
          Component: (await import("../features/changes/ChangesRoute")).default,
        }),
      },
      {
        path: "changes/calendar",
        lazy: async () => ({
          Component: (await import("../features/changes/ChangeCalendarRoute")).default,
        }),
      },
      {
        path: "changes/:id",
        lazy: async () => ({
          Component: (await import("../features/changes/ChangeDetailRoute")).default,
        }),
      },
      {
        path: "problems",
        lazy: async () => ({ Component: (await import("./placeholders/problems")).default }),
      },
      {
        path: "cmdb",
        lazy: async () => ({ Component: (await import("./placeholders/cmdb")).default }),
      },
      {
        path: "cmdb/ci/:id",
        lazy: async () => ({ Component: (await import("./placeholders/cmdb-ci")).default }),
      },
      {
        path: "kb",
        lazy: async () => ({ Component: (await import("./placeholders/kb")).default }),
      },
      { path: "*", element: <NotFoundElement /> },
    ],
  },
]);
