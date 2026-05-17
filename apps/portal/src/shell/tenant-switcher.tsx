import { useCallback, useEffect, useRef, useState } from "react";
import type { TenantId } from "@sdm/domain";
import { useSession } from "./session-context";

export function TenantSwitcher() {
  const { session, tenants, switchTenant } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const handleSelect = useCallback(
    async (id: TenantId) => {
      if (!session || id === session.tenantId) {
        setOpen(false);
        return;
      }
      setBusy(true);
      try {
        await switchTenant(id);
      } finally {
        setBusy(false);
        setOpen(false);
      }
    },
    [session, switchTenant],
  );

  if (!session) return null;
  const single = tenants.length <= 1;
  const active = tenants.find((t) => t.id === session.tenantId);

  return (
    <div className="sdm-tenant-switcher" ref={rootRef} data-testid="tenant-switcher">
      <button
        type="button"
        className="sdm-tenant-display"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={single || busy}
        onClick={() => setOpen((v) => !v)}
        data-testid="tenant-display"
      >
        <span>{active?.name ?? session.tenantId}</span>
        {!single && <span aria-hidden="true"> ▾</span>}
      </button>
      {open && !single && (
        <ul
          className="sdm-tenant-dropdown"
          role="listbox"
          aria-label="Vyber tenant"
          data-testid="tenant-list"
        >
          {tenants.map((t) => {
            const isActive = t.id === session.tenantId;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`sdm-tenant-row${isActive ? " is-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => handleSelect(t.id)}
                  data-testid={`tenant-row-${t.id}`}
                  disabled={busy}
                >
                  <span className="sdm-tenant-dot" aria-hidden="true">
                    {isActive ? "●" : "○"}
                  </span>
                  <span className="sdm-tenant-name">{t.name}</span>
                  {t.code && <span className="sdm-tenant-code">{t.code}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
