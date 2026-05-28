/**
 * H.1 TenantSwitcher — three variants per wireframe
 * `docs/agents/ux-persona-analyst/wireframes/shared/tenant-switcher.md`:
 *
 *  - `single`   — user has exactly 1 tenant. Read-only label, no dropdown.
 *  - `compact`  — collapsed top-bar trigger (button + current tenant + caret).
 *  - `expanded` — open dropdown with search input + tenant list + env badges.
 *
 * Implementation notes:
 *  - Tenant switch flow goes through `useActiveTenant()` (TanStack Query
 *    mutation) so the broad-nuke cache invalidation lands at exactly the same
 *    moment as the session-context update.
 *  - The pending-changes guard wraps the actual mutation call; if any form is
 *    dirty, an in-component `<ConfirmDialog>` blocks the switch until the user
 *    decides. The dialog is intentionally plain JSX with native focus
 *    behaviour — no extra design-system primitive ships with H.1.
 *  - Keyboard shortcut `T` (when no input/textarea is focused) opens the
 *    dropdown via `react-hotkeys-hook`. Per the wireframe, search auto-focuses.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { TenantId } from "@sdm/domain";
import { useTranslation } from "@sdm/i18n";
import { useActiveTenant } from "../features/tenants/hooks";
import type { TenantEnvironment } from "../bootstrap/session";
import { usePendingChanges } from "./pending-changes";
import { useSession } from "./session-context";

interface TenantRow {
  readonly id: TenantId;
  readonly name: string;
  readonly environment?: TenantEnvironment;
}

const ENV_TOKEN: Record<TenantEnvironment, string> = {
  production: "var(--color-env-production)",
  staging: "var(--color-env-staging)",
  development: "var(--color-env-development)",
  sandbox: "var(--color-env-sandbox)",
};

function TenantEnvBadge({ env }: { env: TenantEnvironment }) {
  const { t } = useTranslation();
  return (
    <span
      className="sdm-tenant-env-badge"
      data-component="tenant-env-badge"
      data-env={env}
      style={{ backgroundColor: ENV_TOKEN[env] }}
      title={t(`tenantSwitcher.env.${env}` as const)}
    >
      {t(`tenantSwitcher.env.${env}` as const)}
    </span>
  );
}

interface ConfirmDialogProps {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmDialog(props: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="sdm-modal-overlay" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tenant-switch-confirm-title"
        className="sdm-modal-dialog"
        data-testid="tenant-switch-confirm"
      >
        <h2 id="tenant-switch-confirm-title" className="sdm-modal-title">
          {props.title}
        </h2>
        <p className="sdm-modal-body">{props.body}</p>
        <div className="sdm-modal-actions">
          <button
            type="button"
            className="sdm-modal-button"
            onClick={props.onCancel}
            data-testid="tenant-switch-confirm-cancel"
          >
            {props.cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="sdm-modal-button sdm-modal-button-primary"
            onClick={props.onConfirm}
            data-testid="tenant-switch-confirm-accept"
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TenantSwitcher() {
  const { t } = useTranslation();
  const { session, tenants } = useSession();
  const { switchTenant, isPending } = useActiveTenant();
  const { hasDirtyForms } = usePendingChanges();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingTargetId, setPendingTargetId] = useState<TenantId | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const tenantList = useMemo<readonly TenantRow[]>(
    () =>
      tenants.map((tenant) => {
        const row: TenantRow = { id: tenant.id, name: tenant.name };
        if (tenant.environment)
          (row as { environment?: TenantEnvironment }).environment = tenant.environment;
        return row;
      }),
    [tenants],
  );

  const variant: "single" | "compact" | "expanded" = useMemo(() => {
    if (tenantList.length <= 1) return "single";
    return open ? "expanded" : "compact";
  }, [tenantList.length, open]);

  const active = tenantList.find((row) => row.id === session?.tenantId);

  const performSwitch = useCallback(
    (target: TenantId) => {
      setOpen(false);
      setPendingTargetId(null);
      setSearch("");
      switchTenant(target);
    },
    [switchTenant],
  );

  const onSelect = useCallback(
    (target: TenantId) => {
      if (!session || target === session.tenantId) {
        setOpen(false);
        return;
      }
      if (hasDirtyForms) {
        setPendingTargetId(target);
        return;
      }
      performSwitch(target);
    },
    [session, hasDirtyForms, performSwitch],
  );

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Auto-focus search when the dropdown opens.
  useEffect(() => {
    if (open) {
      // Defer to next tick so the input is mounted.
      queueMicrotask(() => searchRef.current?.focus());
    } else {
      setSearch("");
    }
  }, [open]);

  // Keyboard shortcut `T` — opens the dropdown when no input is focused.
  useHotkeys(
    "t",
    (e) => {
      if (variant === "single") return;
      e.preventDefault();
      setOpen(true);
    },
    {
      enabled: variant !== "single" && !pendingTargetId,
      preventDefault: true,
      enableOnFormTags: false,
    },
  );

  const filteredList = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tenantList;
    return tenantList.filter(
      (row) => row.name.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle),
    );
  }, [tenantList, search]);

  if (!session) return null;

  // ── single variant ─────────────────────────────────────────────
  if (variant === "single") {
    return (
      <div
        className="sdm-tenant-switcher sdm-tenant-switcher--single"
        data-testid="tenant-switcher"
        data-variant="single"
      >
        <span
          className="sdm-tenant-display sdm-tenant-display--single"
          aria-label={t("tenantSwitcher.current")}
          data-testid="tenant-display"
          title={t("tenantSwitcher.singleTenantHint")}
        >
          {active?.name ?? session.tenantId}
          {active?.environment && <TenantEnvBadge env={active.environment} />}
        </span>
      </div>
    );
  }

  // ── compact / expanded ─────────────────────────────────────────
  return (
    <>
      <div
        className="sdm-tenant-switcher"
        ref={rootRef}
        data-testid="tenant-switcher"
        data-variant={variant}
      >
        <button
          type="button"
          className="sdm-tenant-display"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={t("tenantSwitcher.open")}
          disabled={isPending}
          onClick={() => setOpen((v) => !v)}
          data-testid="tenant-display"
        >
          <span>{active?.name ?? session.tenantId}</span>
          {active?.environment && <TenantEnvBadge env={active.environment} />}
          <span aria-hidden="true" className="sdm-tenant-caret">
            ▾
          </span>
        </button>
        {open && (
          <div
            className="sdm-tenant-dropdown"
            data-testid="tenant-list"
            id={listboxId}
            role="listbox"
            aria-label={t("tenantSwitcher.label")}
          >
            <div className="sdm-tenant-dropdown-search">
              <input
                ref={searchRef}
                type="search"
                className="sdm-tenant-dropdown-search-input"
                placeholder={t("tenantSwitcher.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="tenant-search"
                aria-label={t("tenantSwitcher.search")}
              />
            </div>
            <ul className="sdm-tenant-dropdown-list">
              {filteredList.length === 0 && (
                <li className="sdm-tenant-empty" data-testid="tenant-list-empty">
                  {t("tenantSwitcher.noResults")}
                </li>
              )}
              {filteredList.map((row) => {
                const isActive = row.id === session.tenantId;
                return (
                  <li key={row.id} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      className={`sdm-tenant-row${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={t("tenantSwitcher.switchTo", { name: row.name })}
                      onClick={() => onSelect(row.id)}
                      disabled={isPending}
                      data-testid={`tenant-row-${row.id}`}
                    >
                      <span className="sdm-tenant-dot" aria-hidden="true">
                        {isActive ? "●" : "○"}
                      </span>
                      <span className="sdm-tenant-name">{row.name}</span>
                      {row.environment && <TenantEnvBadge env={row.environment} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {pendingTargetId && (
        <ConfirmDialog
          title={t("tenantSwitcher.pendingChangesTitle")}
          body={t("tenantSwitcher.pendingChangesBody")}
          confirmLabel={t("tenantSwitcher.pendingChangesConfirm")}
          cancelLabel={t("tenantSwitcher.pendingChangesCancel")}
          onConfirm={() => performSwitch(pendingTargetId)}
          onCancel={() => setPendingTargetId(null)}
        />
      )}
    </>
  );
}
