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
import { EventSourceProvider } from "../shell/event-source";
import { SessionProvider } from "../shell/session-context";
import { RootErrorBoundary, NotFoundElement } from "./error-boundaries";

function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <EventSourceProvider>
          <AppShell appName="Service Desk Portal">
            <Outlet />
          </AppShell>
        </EventSourceProvider>
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
        lazy: async () => {
          const mod = await import("../features/incidents/NewIncidentRoute");
          return { Component: mod.NewIncidentRoute };
        },
      },
      {
        path: "tickets",
        lazy: async () => {
          const mod = await import("../features/tickets/MyTicketsRoute");
          return { Component: mod.MyTicketsRoute };
        },
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
        lazy: async () => {
          const mod = await import("../features/catalog/CatalogRoute");
          return { Component: mod.CatalogRoute };
        },
      },
      {
        path: "catalog/:itemId",
        lazy: async () => {
          const mod = await import("../features/catalog/CatalogItemRoute");
          return { Component: mod.CatalogItemRoute };
        },
      },
      {
        path: "kb",
        lazy: async () => {
          const mod = await import("../features/kb/KbRoute");
          return { Component: mod.KbRoute };
        },
      },
      {
        path: "kb/article/:id",
        lazy: async () => {
          const mod = await import("../features/kb/KbArticleRoute");
          return { Component: mod.KbArticleRoute };
        },
      },
      { path: "*", element: <NotFoundElement /> },
    ],
  },
]);
