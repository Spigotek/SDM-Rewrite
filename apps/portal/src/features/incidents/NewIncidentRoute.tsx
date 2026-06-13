import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, usePageTransition } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import type { Incident } from "@sdm/domain";
import { NewIncidentForm } from "./components/NewIncidentForm";
import { SuccessScreen } from "./components/SuccessScreen";
import "./new-incident.css";

/**
 * Orchestrator for the `/new-incident` route — toggles between the form
 * (`NewIncidentForm`) and the success view (`SuccessScreen`).
 *
 * v1.2 redesign (K.3.E): the form lives inside a DS `Card` with a 2-column
 * grid on lg+. `usePageTransition` runs a crossfade on route mount, and the
 * SuccessScreen flips to a hero `EmptyState` celebrating the submission.
 *
 * Why a single component instead of a child route (`/new-incident/success`)?
 * Refreshing the URL or sharing it should land on the empty form, not a
 * state-orphaned "thanks" page — so the success view is local state.
 *
 * "Report another" clears the local incident state, which remounts the form
 * via the `key` change — RHF resets to default values and the dirty marker
 * unregisters cleanly.
 */
export function NewIncidentRoute() {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();
  const location = useLocation();
  const { ref } = usePageTransition(location.pathname);

  const [created, setCreated] = useState<Incident | null>(null);
  const [formKey, setFormKey] = useState(0);

  const onSuccess = useCallback((incident: Incident) => {
    setCreated(incident);
  }, []);

  const onCancel = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const onReportAnother = useCallback(() => {
    setCreated(null);
    setFormKey((n) => n + 1);
  }, []);

  return (
    <div ref={ref} className="sdm-portal-new-incident" data-testid="portal-new-incident">
      {created ? (
        <SuccessScreen incident={created} onReportAnother={onReportAnother} />
      ) : (
        <>
          <header className="sdm-portal-new-incident-heading">
            <h1>{t("newIncident.title")}</h1>
            <p className="sdm-portal-new-incident-heading-sub">{t("newIncident.subtitle")}</p>
          </header>
          <Card variant="surface" className="sdm-portal-new-incident-card">
            <NewIncidentForm key={formKey} onSuccess={onSuccess} onCancel={onCancel} />
          </Card>
        </>
      )}
    </div>
  );
}

export default NewIncidentRoute;
