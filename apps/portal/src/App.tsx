import { useEffect, useState } from "react";

interface TenantSummary {
  id: string;
  name: string;
  code: string | null;
  isDefault: boolean;
}

interface TenantsResponse {
  tenants: TenantSummary[];
}

export default function App() {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mocksEnabled = import.meta.env.VITE_USE_MOCKS === "true";

  useEffect(() => {
    let cancelled = false;
    fetch("/me/tenants")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<TenantsResponse>)
          : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data) => {
        if (!cancelled) setTenants(data.tenants);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>SDM Portal</h1>
      <p>Self-service portal stub — chunk E.1 (MSW mock backend wired).</p>
      <p data-testid="mocks-flag">
        Mocks: <strong>{mocksEnabled ? "on" : "off"}</strong>
      </p>
      {error && <p data-testid="tenants-error">Error loading tenants: {error}</p>}
      {tenants && (
        <ul data-testid="tenants-list">
          {tenants.map((t) => (
            <li key={t.id}>
              {t.name} ({t.code}) {t.isDefault ? "★" : ""}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
