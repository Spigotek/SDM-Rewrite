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
import { EventSourceProvider } from "../shell/event-source";
import { SessionProvider } from "../shell/session-context";
import { RootErrorBoundary, NotFoundElement } from "./error-boundaries";
import { guardedLazy, screenGuardedLazy } from "./guards";

function RootLayout() {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <EventSourceProvider>
          <AppShell appName="Service Desk Workspace">
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
        loader: () => redirect("/queue"),
      },
      {
        path: "queue",
        lazy: () =>
          screenGuardedLazy(import("../features/queue/QueueRoute"), "WORKSPACE_INCIDENT_QUEUE"),
      },
      {
        path: "tickets/:id",
        lazy: () =>
          screenGuardedLazy(
            import("../features/tickets/TicketDetailRoute"),
            "WORKSPACE_INCIDENT_DETAIL",
          ),
      },
      {
        path: "changes",
        lazy: () =>
          screenGuardedLazy(import("../features/changes/ChangesRoute"), "WORKSPACE_CHANGE_LIST"),
      },
      {
        path: "changes/calendar",
        lazy: () =>
          screenGuardedLazy(
            import("../features/changes/ChangeCalendarRoute"),
            "WORKSPACE_CHANGE_CALENDAR",
          ),
      },
      {
        path: "changes/:id",
        lazy: () =>
          screenGuardedLazy(
            import("../features/changes/ChangeDetailRoute"),
            "WORKSPACE_CHANGE_DETAIL",
          ),
      },
      {
        path: "problems",
        lazy: () =>
          screenGuardedLazy(import("../features/problems/ProblemsRoute"), "WORKSPACE_PROBLEM_LIST"),
      },
      {
        path: "problems/:id",
        lazy: () =>
          screenGuardedLazy(
            import("../features/problems/ProblemDetailRoute"),
            "WORKSPACE_PROBLEM_DETAIL",
          ),
      },
      {
        path: "cmdb",
        lazy: () => screenGuardedLazy(import("../features/cmdb/CmdbRoute"), "WORKSPACE_CMDB_LIST"),
      },
      {
        path: "cmdb/ci/:id",
        lazy: () =>
          screenGuardedLazy(import("../features/cmdb/CmdbCiRoute"), "WORKSPACE_CI_DETAIL"),
      },
      {
        path: "kb",
        lazy: () => guardedLazy(import("../features/kb/KbBrowseRoute"), "kb.search"),
      },
      {
        path: "kb/article/:id",
        lazy: () => guardedLazy(import("../features/kb/KbArticleRoute"), "kb.search"),
      },
      {
        path: "kb/editor",
        lazy: () => guardedLazy(import("../features/kb/editor/KbEditorRoute"), "kb.write"),
      },
      {
        path: "kb/editor/:id",
        lazy: () => guardedLazy(import("../features/kb/editor/KbEditorRoute"), "kb.write"),
      },
      {
        path: "kb/analytics",
        lazy: () => guardedLazy(import("../features/kb/editor/KbAnalyticsRoute"), "kb.analytics"),
      },
      {
        path: "sp/cockpit",
        lazy: () =>
          guardedLazy(import("../features/sp-cockpit/SpCockpitRoute"), "ci.read.cross-tenant"),
      },
      { path: "*", element: <NotFoundElement /> },
    ],
  },
]);
