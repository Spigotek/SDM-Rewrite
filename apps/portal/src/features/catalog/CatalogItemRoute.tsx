import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@sdm/design-system";
import { useTranslation } from "@sdm/i18n";
import { tenantId as toTenantId } from "@sdm/domain";
import { useSession } from "../../shell/session-context";
import {
  catalogItemQuery,
  postCatalogRequest,
  type CatalogRequestFieldValue,
  type CatalogRequestResponse,
} from "./api";
import { DynamicForm } from "./components/DynamicForm";
import "./catalog.css";

/**
 * `/catalog/:itemId` — Service Catalog item detail + DynamicForm.
 *
 * Three phases:
 *   1. Loading detail (`isLoading`)               → spinner placeholder
 *   2. Loaded                                     → header + DynamicForm
 *   3. Submitted (mutation success)               → SuccessScreen with new ref
 *
 * The success state is local (not a child route) for the same reason H.3
 * keeps it local — refreshing or sharing the URL should land on the form,
 * not a state-orphaned "thanks" view.
 */

const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function CatalogItemRoute() {
  const { t } = useTranslation("portal");
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const tenantId = session?.tenantId ?? TENANT_PLACEHOLDER;
  const qc = useQueryClient();

  const query = useQuery({
    ...catalogItemQuery(tenantId, itemId ?? ""),
    enabled: session !== null && Boolean(itemId),
  });

  const mutation = useMutation<
    CatalogRequestResponse,
    Error & { status?: number },
    Readonly<Record<string, CatalogRequestFieldValue>>
  >({
    mutationFn: (fields) =>
      postCatalogRequest({
        catalogItemId: itemId ?? "",
        summary: query.data?.item.name ?? itemId ?? "",
        fields,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
  });

  const [created, setCreated] = useState<CatalogRequestResponse | null>(null);

  const onSubmit = useCallback(
    async (values: Readonly<Record<string, unknown>>) => {
      const fields = values as Readonly<Record<string, CatalogRequestFieldValue>>;
      const result = await mutation.mutateAsync(fields);
      setCreated(result);
    },
    [mutation],
  );

  const onCancel = useCallback(() => {
    navigate("/catalog");
  }, [navigate]);

  if (!itemId) {
    return (
      <section className="sdm-catalog-item" data-testid="portal-catalog-item">
        <p role="alert">{t("catalogBrowse.detail.notFound")}</p>
      </section>
    );
  }

  if (created) {
    return (
      <section
        className="sdm-catalog-item-success"
        data-testid="catalog-item-success"
        data-ticket-id={created.id}
        data-ticket-ref={created.ref}
        aria-live="polite"
      >
        <h1>{t("catalogBrowse.success.title", { ref: created.ref })}</h1>
        <p>{t("catalogBrowse.success.body")}</p>
        <div className="sdm-catalog-item-success-ctas">
          <Link
            to={`/tickets/${created.id}`}
            className="sdm-home-action-link"
            data-testid="catalog-item-success-view"
          >
            <Button variant="primary" type="button">
              {t("catalogBrowse.success.viewTicket")}
            </Button>
          </Link>
          <Link
            to="/catalog"
            className="sdm-home-action-link"
            data-testid="catalog-item-success-back"
          >
            <Button variant="secondary" type="button">
              {t("catalogBrowse.success.backToCatalog")}
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="sdm-catalog-item" data-testid="portal-catalog-item">
      <Link to="/catalog" className="sdm-catalog-back" data-testid="catalog-item-back">
        {t("catalogBrowse.detail.back")}
      </Link>
      {query.isLoading ? (
        <p className="sdm-catalog-loading" data-testid="catalog-item-loading">
          {t("catalogBrowse.detail.loading")}
        </p>
      ) : query.isError || !query.data ? (
        <p role="alert" className="sdm-catalog-error" data-testid="catalog-item-error">
          {t("catalogBrowse.detail.error")}
        </p>
      ) : (
        <>
          <header className="sdm-catalog-item-heading">
            <h1>{query.data.item.name}</h1>
            <p className="sdm-catalog-item-description">{query.data.item.description}</p>
            {query.data.item.sla ? (
              <p className="sdm-catalog-item-sla">{query.data.item.sla}</p>
            ) : null}
          </header>
          <DynamicForm
            item={query.data.item}
            fields={query.data.fields}
            onSubmit={onSubmit}
            onCancel={onCancel}
            submitting={mutation.isPending}
            serverError={mutation.isError ? t("catalogBrowse.form.submitFailed") : null}
          />
        </>
      )}
    </section>
  );
}

export default CatalogItemRoute;
