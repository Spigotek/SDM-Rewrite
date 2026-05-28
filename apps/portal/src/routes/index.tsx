/**
 * Portal route configuration — `createBrowserRouter` data router per ADR-05.
 *
 * The root route is `<AppShell />`. Every child route uses `lazy:` for
 * code-splitting; bundle budget assumes each placeholder chunk is < 2 KB
 * gzip and the feature content arriving in H.2+ stays under the
 * `performance.md §3` per-route 80 KB budget.
 *
 * Permission guards are introduced by feature chunks (H.2+) — H.0 wires the
 * `guardedLazy()` helper but applies it sparingly so placeholder content
 * remains reachable for the existing smoke tests (Anna `agent_l1` lacks
 * `app.portal.access`). Feature chunks will tighten this when they replace
 * placeholders with real content.
 */

import { createBrowserRouter, Outlet } from "react-router-dom";
import { AppShell } from "../shell/app-shell";
import { ErrorBoundary } from "../shell/error-boundary";
import { SessionProvider } from "../shell/session-context";
import { RootErrorBoundary, NotFoundElement } from "./error-boundaries";

function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <AppShell appName="Service Desk Portal">
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
        lazy: async () => {
          const mod = await import("../features/home/HomeRoute");
          return { Component: mod.HomeRoute, loader: mod.homeLoader };
        },
      },
      {
        path: "new-incident",
        lazy: async () => ({
          Component: (await import("./placeholders/new-incident")).default,
        }),
      },
      {
        path: "tickets",
        lazy: async () => ({ Component: (await import("./placeholders/my-tickets")).default }),
      },
      {
        path: "tickets/:id",
        lazy: async () => {
          const mod = await import("../features/tickets/TicketDetailRoute");
          return { Component: mod.TicketDetailRoute, loader: mod.ticketDetailLoader };
        },
      },
      {
        path: "catalog",
        lazy: async () => ({ Component: (await import("./placeholders/catalog")).default }),
      },
      {
        path: "catalog/:itemId",
        lazy: async () => ({
          Component: (await import("./placeholders/catalog-item")).default,
        }),
      },
      {
        path: "kb",
        lazy: async () => ({ Component: (await import("./placeholders/kb")).default }),
      },
      {
        path: "kb/article/:id",
        lazy: async () => ({ Component: (await import("./placeholders/kb-article")).default }),
      },
      { path: "*", element: <NotFoundElement /> },
    ],
  },
]);
