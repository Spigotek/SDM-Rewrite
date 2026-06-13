/**
 * K.3.C workspace mount for the DS `CommandPalette` primitive.
 *
 * Responsibilities the DS primitive does NOT own:
 *
 *   - opens/close state + the `Cmd+K` / `Ctrl+K` / `/` global hotkey
 *   - contributes the static "Navigate" + "Actions" groups (workspace scope)
 *   - lazy-loads "Tickets" (open queue, top 20) + "KB" + "CMDB" hits
 *   - wires React Router `useNavigate()` into each row's `onActivate` callback
 *
 * Mounted once from `app-shell.tsx` after the session is ready. Sibling shell
 * elements open the palette via the module-level `openWorkspaceCommandPalette()`
 * helper so they don't need a shared React context for one boolean.
 */

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "@sdm/i18n";
import { useNavigate } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery } from "@tanstack/react-query";
import {
  CommandPalette,
  useCommandPaletteRegistry,
  useTheme,
  type CommandPaletteAction,
  type ThemeChoice,
} from "@sdm/design-system";
import {
  AlertTriangle,
  BookOpen,
  Box,
  CalendarClock,
  ClipboardList,
  Cpu,
  GitBranch,
  LogOut,
  SunMoon,
  Ticket,
} from "lucide-react";
import { useSession } from "./session-context";

const BODY_OPEN_ATTR = "data-workspace-cmdk-open";

export function openWorkspaceCommandPalette(): void {
  if (typeof document === "undefined") return;
  document.body.setAttribute(BODY_OPEN_ATTR, "true");
}

export function closeWorkspaceCommandPalette(): void {
  if (typeof document === "undefined") return;
  document.body.removeAttribute(BODY_OPEN_ATTR);
}

function isWorkspaceCommandPaletteOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.hasAttribute(BODY_OPEN_ATTR);
}

function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

interface IncidentRow {
  readonly id: string;
  readonly ref?: string;
  readonly summary?: string;
  readonly status?: { readonly code?: string } | string;
}

interface KbRow {
  readonly id: string;
  readonly title?: string;
  readonly summary?: string | null;
}

interface CmdbRow {
  readonly id: string;
  readonly name?: string;
  readonly class?: string;
}

interface PageEnvelope<T> {
  readonly data?: ReadonlyArray<T>;
  readonly results?: ReadonlyArray<T>;
}

function rowsOf<T>(payload: PageEnvelope<T>): ReadonlyArray<T> {
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

async function fetchJson<T>(url: string, op: string): Promise<T> {
  const resp = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`[${op}] HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

async function fetchOpenIncidents(): Promise<ReadonlyArray<IncidentRow>> {
  const payload = await fetchJson<PageEnvelope<IncidentRow>>(
    "/api/incidents?size=20&sort=open_date%20DESC",
    "workspace-cmdk-tickets",
  );
  return rowsOf(payload).slice(0, 20);
}

async function fetchKbHits(query: string): Promise<ReadonlyArray<KbRow>> {
  const params = new URLSearchParams({ size: "6" });
  const trimmed = query.trim();
  if (trimmed.length > 0) params.set("q", trimmed);
  const payload = await fetchJson<PageEnvelope<KbRow>>(
    `/api/kb?${params.toString()}`,
    "workspace-cmdk-kb",
  );
  return rowsOf(payload).slice(0, 6);
}

async function fetchCmdbHits(query: string): Promise<ReadonlyArray<CmdbRow>> {
  const params = new URLSearchParams({ size: "6", q: query.trim() });
  const payload = await fetchJson<PageEnvelope<CmdbRow>>(
    `/api/cmdb/cis?${params.toString()}`,
    "workspace-cmdk-cmdb",
  );
  return rowsOf(payload).slice(0, 6);
}

function statusCodeOf(raw: IncidentRow["status"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.code ?? "";
}

export function CommandPaletteMount(): ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, status, logout } = useSession();
  const { choice, setChoice } = useTheme();
  const { registry, actions } = useCommandPaletteRegistry();

  const [open, setOpen] = useState<boolean>(() => isWorkspaceCommandPaletteOpen());
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const observer = new MutationObserver(() => setOpen(isWorkspaceCommandPaletteOpen()));
    observer.observe(document.body, { attributes: true, attributeFilter: [BODY_OPEN_ATTR] });
    return () => observer.disconnect();
  }, []);

  const openPalette = useCallback(() => openWorkspaceCommandPalette(), []);
  const closePalette = useCallback(() => closeWorkspaceCommandPalette(), []);

  useHotkeys(
    "mod+k",
    (event) => {
      event.preventDefault();
      openPalette();
    },
    { enableOnFormTags: true, enabled: status === "ready" },
  );
  useHotkeys(
    "/",
    (event) => {
      event.preventDefault();
      openPalette();
    },
    { enabled: status === "ready", preventDefault: false },
  );

  // ── Static contributions (Navigate + Actions) ──────────────────────────
  useEffect(() => {
    if (status !== "ready") return undefined;
    const ids: string[] = [];
    const register = (action: CommandPaletteAction) => {
      registry.register(action);
      ids.push(action.id);
    };

    register({
      id: "nav:queue",
      group: "navigate",
      title: t("nav.queue"),
      icon: <ClipboardList size={16} aria-hidden="true" />,
      shortcut: "G Q",
      onActivate: () => navigate("/queue"),
    });
    register({
      id: "nav:changes",
      group: "navigate",
      title: t("nav.changes"),
      icon: <GitBranch size={16} aria-hidden="true" />,
      shortcut: "G C",
      onActivate: () => navigate("/changes"),
    });
    register({
      id: "nav:problems",
      group: "navigate",
      title: t("nav.problems"),
      icon: <AlertTriangle size={16} aria-hidden="true" />,
      shortcut: "G P",
      onActivate: () => navigate("/problems"),
    });
    register({
      id: "nav:cmdb",
      group: "navigate",
      title: t("nav.cmdb"),
      icon: <Box size={16} aria-hidden="true" />,
      shortcut: "G M",
      onActivate: () => navigate("/cmdb"),
    });
    register({
      id: "nav:kb",
      group: "navigate",
      title: t("nav.kb"),
      icon: <BookOpen size={16} aria-hidden="true" />,
      shortcut: "G K",
      onActivate: () => navigate("/kb"),
    });
    register({
      id: "nav:calendar",
      group: "navigate",
      title: t("nav.calendar"),
      icon: <CalendarClock size={16} aria-hidden="true" />,
      onActivate: () => navigate("/changes/calendar"),
    });
    register({
      id: "act:theme",
      group: "actions",
      title: t("cmdk.actions.toggleTheme"),
      icon: <SunMoon size={16} aria-hidden="true" />,
      onActivate: () => setChoice(nextThemeChoice(choice)),
    });
    register({
      id: "act:signout",
      group: "actions",
      title: t("cmdk.actions.signOut"),
      icon: <LogOut size={16} aria-hidden="true" />,
      onActivate: () => void logout(),
    });

    return () => {
      for (const id of ids) registry.unregister(id);
    };
  }, [registry, status, t, navigate, choice, setChoice, logout]);

  // ── Lazy ticket group ──────────────────────────────────────────────────
  const ticketsQuery = useQuery({
    queryKey: ["cmdk", "workspace", "tickets", session?.tenantId ?? "__pending__"] as const,
    queryFn: fetchOpenIncidents,
    enabled: open && status === "ready",
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!ticketsQuery.data) {
      registry.replaceGroup("ticket:", []);
      return;
    }
    const batch: CommandPaletteAction[] = ticketsQuery.data.map((ticket) => ({
      id: `ticket:${ticket.id}`,
      group: "tickets",
      title: `${ticket.ref ?? ticket.id} — ${ticket.summary || "(no summary)"}`,
      icon: <Ticket size={16} aria-hidden="true" />,
      subtitle: statusCodeOf(ticket.status),
      onActivate: () => navigate(`/tickets/${ticket.id}`),
    }));
    registry.replaceGroup("ticket:", batch);
  }, [registry, ticketsQuery.data, navigate]);

  // ── Lazy KB group ──────────────────────────────────────────────────────
  const kbQuery = useQuery({
    queryKey: ["cmdk", "workspace", "kb", searchTerm] as const,
    queryFn: () => fetchKbHits(searchTerm),
    enabled: open && status === "ready" && searchTerm.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!kbQuery.data) {
      registry.replaceGroup("kb:", []);
      return;
    }
    const batch: CommandPaletteAction[] = kbQuery.data.map((hit) => ({
      id: `kb:${hit.id}`,
      group: "kb",
      title: hit.title || "(untitled)",
      icon: <BookOpen size={16} aria-hidden="true" />,
      ...(hit.summary ? { subtitle: hit.summary } : {}),
      onActivate: () => navigate(`/kb/article/${hit.id}`),
    }));
    registry.replaceGroup("kb:", batch);
  }, [registry, kbQuery.data, navigate]);

  // ── Lazy CMDB group (only when query > 2 chars) ────────────────────────
  const cmdbQuery = useQuery({
    queryKey: ["cmdk", "workspace", "cmdb", searchTerm] as const,
    queryFn: () => fetchCmdbHits(searchTerm),
    enabled: open && status === "ready" && searchTerm.length > 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!cmdbQuery.data) {
      registry.replaceGroup("ci:", []);
      return;
    }
    const batch: CommandPaletteAction[] = cmdbQuery.data.map((ci) => ({
      id: `ci:${ci.id}`,
      group: "users",
      title: ci.name || ci.id,
      icon: <Cpu size={16} aria-hidden="true" />,
      ...(ci.class ? { subtitle: ci.class } : {}),
      onActivate: () => navigate(`/cmdb/ci/${ci.id}`),
    }));
    registry.replaceGroup("ci:", batch);
  }, [registry, cmdbQuery.data, navigate]);

  useEffect(() => {
    if (!open) {
      registry.replaceGroup("ticket:", []);
      registry.replaceGroup("kb:", []);
      registry.replaceGroup("ci:", []);
      setSearchTerm("");
    }
  }, [open, registry]);

  const handleQueryChange = useCallback((q: string) => {
    const trimmed = q.replace(/^[>#?]/, "").trim();
    setSearchTerm(trimmed);
  }, []);

  if (status !== "ready") return null;

  return (
    <CommandPalette
      open={open}
      onClose={closePalette}
      actions={actions}
      onQueryChange={handleQueryChange}
      placeholder={t("cmdk.placeholder")}
      emptyMessage={t("cmdk.empty")}
    />
  );
}
