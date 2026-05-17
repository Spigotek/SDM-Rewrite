import { useEffect, useState } from "react";

interface IncidentSummary {
  id: string;
  ref: string;
  summary: string;
  status: string;
  priority: number;
}

interface IncidentsPage {
  results: IncidentSummary[];
  totalCount: number;
}

export default function App() {
  const [page, setPage] = useState<IncidentsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mocksEnabled = import.meta.env.VITE_USE_MOCKS === "true";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/incidents?size=10", { headers: { "X-CA-SDM-Tenant": "acme-corp" } })
      .then((r) =>
        r.ok ? (r.json() as Promise<IncidentsPage>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data) => {
        if (!cancelled) setPage(data);
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
      <h1>SDM Workspace</h1>
      <p>Agent workspace stub — chunk E.1 (MSW mock backend wired).</p>
      <p data-testid="mocks-flag">
        Mocks: <strong>{mocksEnabled ? "on" : "off"}</strong>
      </p>
      {error && <p data-testid="incidents-error">Error loading incidents: {error}</p>}
      {page && (
        <>
          <p data-testid="incidents-summary">
            Showing {page.results.length} of {page.totalCount} incidents (tenant: acme-corp)
          </p>
          <ul data-testid="incidents-list">
            {page.results.map((i) => (
              <li key={i.id}>
                <strong>{i.ref}</strong> — {i.summary}{" "}
                <em>
                  [{i.status}, P{i.priority}]
                </em>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
