import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "@sdm/i18n";
import type { Incident } from "@sdm/domain";
import { NewIncidentForm } from "./components/NewIncidentForm";
import { SuccessScreen } from "./components/SuccessScreen";
import "./new-incident.css";

/**
 * Orchestrator for the `/new-incident` route — toggles between the form
 * (`NewIncidentForm`) and the success view (`SuccessScreen`).
 *
 * Why a single component instead of a child route (`/new-incident/success`)?
 *   - The success state only exists if the form was submitted in this tab.
 *     Refreshing the URL or sharing it should land on the empty form, not
 *     a state-orphaned "thanks" page.
 *   - Keeping the toggle local avoids router-side state management for a
 *     transient view that lives ≤ a few seconds before Lucia clicks a CTA.
 *
 * "Report another" clears the local incident state, which remounts the form
 * via the `key` change — RHF resets to default values and the dirty marker
 * unregisters cleanly.
 */
export function NewIncidentRoute() {
  const { t } = useTranslation("portal");
  const navigate = useNavigate();
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

  if (created) {
    return <SuccessScreen incident={created} onReportAnother={onReportAnother} />;
  }

  return (
    <section className="sdm-portal-new-incident" data-testid="portal-new-incident">
      <Link to="/" className="sdm-portal-new-incident-back" data-testid="portal-new-incident-back">
        {t("newIncident.back")}
      </Link>
      <header className="sdm-portal-new-incident-heading">
        <h1>{t("newIncident.title")}</h1>
        <p className="sdm-portal-new-incident-heading-sub">{t("newIncident.subtitle")}</p>
      </header>
      <NewIncidentForm key={formKey} onSuccess={onSuccess} onCancel={onCancel} />
    </section>
  );
}

export default NewIncidentRoute;
