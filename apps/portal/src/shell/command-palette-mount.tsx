/**
 * K.3.C portal mount for the DS `CommandPalette` primitive.
 *
 * Responsibilities the DS primitive does NOT own:
 *
 *   - opens/close state + the `Cmd+K` / `Ctrl+K` / `/` global hotkey
 *   - contributes the static "Navigate" + "Actions" groups (portal scope)
 *   - lazy-loads "Tickets" (user's recent) + "KB" hits when the palette opens
 *   - wires React Router `useNavigate()` into each row's `onActivate` callback
 *
 * The component is mounted once from `app-shell.tsx` once the session is ready.
 * Other shell affordances (top-bar Cmd+K chip, mobile drawer) open the palette
 * via the module-level `openPortalCommandPalette()` helper so they don't need
 * to share a React context just for one boolean.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import { useTranslation } from "@sdm/i18n";
import { useNavigate } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { useQuery } from "@tanstack/react-query";
import { tenantId as toTenantId } from "@sdm/domain";
import {
  CommandPalette,
  useCommandPaletteRegistry,
  useTheme,
  type CommandPaletteAction,
  type ThemeChoice,
} from "@sdm/design-system";
import { kbAutocompleteQuery, myAllTicketsQuery } from "../features/home/api";
import { useSession } from "./session-context";

/**
 * Inline lucide-style icons. `lucide-react` is a `@sdm/design-system` dep but
 * not a direct portal dep — see `top-bar.tsx` for the same pattern. Each icon
 * is a 16-px stroke-only path that matches the DS visual style of the rest of
 * the shell.
 */
function Glyph({ children }: { children: ReactNode }): ReactNode {
  const props: SVGProps<SVGSVGElement> = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false,
  };
  return <svg {...props}>{children}</svg>;
}

const HomeIcon = (
  <Glyph>
    <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
  </Glyph>
);
const InboxIcon = (
  <Glyph>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11" />
  </Glyph>
);
const LayoutGridIcon = (
  <Glyph>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </Glyph>
);
const BookOpenIcon = (
  <Glyph>
    <path d="M12 7v14" />
    <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
  </Glyph>
);
const PlusCircleIcon = (
  <Glyph>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v8" />
    <path d="M8 12h8" />
  </Glyph>
);
const SunMoonIcon = (
  <Glyph>
    <path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4Z" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
  </Glyph>
);
const LogOutIcon = (
  <Glyph>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </Glyph>
);
const TicketIcon = (
  <Glyph>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </Glyph>
);

const BODY_OPEN_ATTR = "data-portal-cmdk-open";

/** Module-level toggle so sibling shell elements can open the palette without a context. */
export function openPortalCommandPalette(): void {
  if (typeof document === "undefined") return;
  document.body.setAttribute(BODY_OPEN_ATTR, "true");
  // The `MutationObserver` inside <CommandPaletteMount/> picks the flip up.
}

export function closePortalCommandPalette(): void {
  if (typeof document === "undefined") return;
  document.body.removeAttribute(BODY_OPEN_ATTR);
}

function isPortalCommandPaletteOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.hasAttribute(BODY_OPEN_ATTR);
}

const TENANT_PLACEHOLDER = toTenantId("__pending__");

function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  if (current === "system") return "light";
  if (current === "light") return "dark";
  return "system";
}

export function CommandPaletteMount(): ReactNode {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();
  const { session, status, logout } = useSession();
  const { choice, setChoice } = useTheme();
  const { registry, actions } = useCommandPaletteRegistry();

  const [open, setOpen] = useState<boolean>(() => isPortalCommandPaletteOpen());
  const [kbQuery, setKbQuery] = useState<string>("");

  // Mirror the body-attribute flip into local state so the modal opens when
  // the top-bar chip / mobile drawer / hotkey toggles it.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const observer = new MutationObserver(() => setOpen(isPortalCommandPaletteOpen()));
    observer.observe(document.body, { attributes: true, attributeFilter: [BODY_OPEN_ATTR] });
    return () => observer.disconnect();
  }, []);

  const openPalette = useCallback(() => {
    openPortalCommandPalette();
  }, []);

  const closePalette = useCallback(() => {
    closePortalCommandPalette();
  }, []);

  // Global hotkeys — reserve `cmd+k`, `ctrl+k` and `/` for the palette.
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
      // Skip the shortcut when the user is already typing into a text input —
      // `/` is a common character in passwords and search fields.
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
      id: "nav:home",
      group: "navigate",
      title: t("nav.home"),
      icon: HomeIcon,
      shortcut: "G H",
      onActivate: () => navigate("/"),
    });
    register({
      id: "nav:tickets",
      group: "navigate",
      title: t("nav.myTickets"),
      icon: InboxIcon,
      shortcut: "G T",
      onActivate: () => navigate("/tickets"),
    });
    register({
      id: "nav:catalog",
      group: "navigate",
      title: t("nav.catalog"),
      icon: LayoutGridIcon,
      shortcut: "G C",
      onActivate: () => navigate("/catalog"),
    });
    register({
      id: "nav:kb",
      group: "navigate",
      title: t("nav.knowledge"),
      icon: BookOpenIcon,
      shortcut: "G K",
      onActivate: () => navigate("/kb"),
    });
    register({
      id: "nav:new-incident",
      group: "navigate",
      title: t("nav.newIncident"),
      icon: PlusCircleIcon,
      shortcut: "⌘ N",
      onActivate: () => navigate("/new-incident"),
    });
    register({
      id: "act:theme",
      group: "actions",
      title: t("cmdk.actions.toggleTheme"),
      icon: SunMoonIcon,
      onActivate: () => setChoice(nextThemeChoice(choice)),
    });
    register({
      id: "act:signout",
      group: "actions",
      title: t("cmdk.actions.signOut"),
      icon: LogOutIcon,
      onActivate: () => void logout(),
    });

    return () => {
      for (const id of ids) registry.unregister(id);
    };
  }, [registry, status, t, navigate, choice, setChoice, logout]);

  // ── Lazy ticket group (top 10 of the user's open tickets) ──────────────
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const ticketsQuery = useQuery({
    ...myAllTicketsQuery(tenantId),
    enabled: open && status === "ready",
  });

  useEffect(() => {
    if (!ticketsQuery.data) {
      registry.replaceGroup("ticket:", []);
      return;
    }
    const batch: CommandPaletteAction[] = ticketsQuery.data.slice(0, 10).map((ticket) => ({
      id: `ticket:${ticket.id}`,
      group: "tickets",
      title: `${ticket.ref} — ${ticket.summary || "(no summary)"}`,
      icon: TicketIcon,
      subtitle: ticket.status,
      onActivate: () => navigate(`/tickets/${ticket.id}`),
    }));
    registry.replaceGroup("ticket:", batch);
  }, [registry, ticketsQuery.data, navigate]);

  // ── Lazy KB group ──────────────────────────────────────────────────────
  const kbHitsQuery = useQuery({
    ...kbAutocompleteQuery(tenantId, kbQuery),
    enabled: open && status === "ready" && kbQuery.trim().length > 0,
  });

  useEffect(() => {
    if (!kbHitsQuery.data) {
      registry.replaceGroup("kb:", []);
      return;
    }
    const batch: CommandPaletteAction[] = kbHitsQuery.data.slice(0, 6).map((hit) => ({
      id: `kb:${hit.id}`,
      group: "kb",
      title: hit.title || "(untitled article)",
      icon: BookOpenIcon,
      subtitle: hit.snippet,
      onActivate: () => navigate(`/kb/article/${hit.id}`),
    }));
    registry.replaceGroup("kb:", batch);
  }, [registry, kbHitsQuery.data, navigate]);

  // Clear the lazy groups when the palette closes so they don't pollute the
  // next open with stale tenant data.
  useEffect(() => {
    if (!open) {
      registry.replaceGroup("ticket:", []);
      registry.replaceGroup("kb:", []);
      setKbQuery("");
    }
  }, [open, registry]);

  const handleQueryChange = useCallback((q: string) => {
    // Strip mode prefixes before forwarding to the KB query.
    const trimmed = q.replace(/^[>#?]/, "").trim();
    setKbQuery(trimmed);
  }, []);

  const visibleActions = useMemo(() => actions, [actions]);

  if (status !== "ready") return null;

  return (
    <CommandPalette
      open={open}
      onClose={closePalette}
      actions={visibleActions}
      onQueryChange={handleQueryChange}
      placeholder={t("cmdk.placeholder")}
      emptyMessage={t("cmdk.empty")}
    />
  );
}
