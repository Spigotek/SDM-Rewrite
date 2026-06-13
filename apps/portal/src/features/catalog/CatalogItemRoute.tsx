import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  EmptyState,
  IllustrationNoOpenTickets,
  Skeleton,
  usePageTransition,
} from "@sdm/design-system";
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
 * Phases:
 *   1. Loading detail (`isLoading`)               → Card with Skeleton bars
 *   2. Loaded                                     → Card → header + DynamicForm
 *   3. Submitted (mutation success)               → hero EmptyState w/ ref
 *
 * v1.2 redesign (K.3.E):
 *   - Header + form share a single DS `Card` (variant `surface`).
 *   - Loading state renders Skeleton text/block bars rather than a "Loading…"
 *     string so the layout reserves vertical space (CLS friendly).
 *   - Success state mirrors the new-incident screen: hero `EmptyState` with
 *     the friendly inbox glyph, a large tabular-nums ref, and CTAs back to
 *     the catalog / detail / home.
 *   - `usePageTransition` crossfades route mounts; `prefers-reduced-motion`
 *     respected upstream.
 */

const TENANT_PLACEHOLDER = toTenantId("__pending__");

export function CatalogItemRoute() {
  const { t } = useTranslation("portal");
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { ref: pageRef } = usePageTransition(location.pathname);

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
      <div ref={pageRef} className="sdm-catalog-item" data-testid="portal-catalog-item">
        <p role="alert" className="sdm-catalog-error">
          {t("catalogBrowse.detail.notFound")}
        </p>
      </div>
    );
  }

  if (created) {
    return (
      <div
        ref={pageRef}
        className="sdm-catalog-item-success"
        data-testid="catalog-item-success"
        data-ticket-id={created.id}
        data-ticket-ref={created.ref}
        aria-live="polite"
      >
        <EmptyState
          variant="hero"
          illustration={<IllustrationNoOpenTickets />}
          title={t("catalogBrowse.success.title")}
          description={t("catalogBrowse.success.body")}
        />
        <p
          className="sdm-catalog-item-success-ref"
          data-testid="catalog-item-success-ref"
          aria-label={`${t("catalogBrowse.success.refLabel")}: ${created.ref}`}
        >
          <span aria-hidden="true">#</span>
          <span aria-hidden="true">{created.ref}</span>
        </p>
        <div className="sdm-catalog-item-success-ctas">
          <Link
            to={`/tickets/${created.id}`}
            className="sdm-home-action-link"
            data-testid="catalog-item-success-view"
          >
            <Button variant="primary" type="button" fullWidth>
              {t("catalogBrowse.success.viewTicket")}
            </Button>
          </Link>
          <Link
            to="/catalog"
            className="sdm-home-action-link"
            data-testid="catalog-item-success-back"
          >
            <Button variant="secondary" type="button" fullWidth>
              {t("catalogBrowse.success.backToCatalog")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="sdm-catalog-item" data-testid="portal-catalog-item">
      {query.isLoading ? (
        <Card variant="surface" className="sdm-catalog-item-card" aria-busy="true">
          <div className="sdm-catalog-item-loading" data-testid="catalog-item-loading">
            <Skeleton variant="text" width="40%" height={28} />
            <Skeleton variant="text" width="80%" height={16} />
            <Skeleton variant="block" height={200} />
          </div>
        </Card>
      ) : query.isError || !query.data ? (
        <p role="alert" className="sdm-catalog-error" data-testid="catalog-item-error">
          {t("catalogBrowse.detail.error")}
        </p>
      ) : (
        <Card variant="surface" className="sdm-catalog-item-card">
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
        </Card>
      )}
    </div>
  );
}

export default CatalogItemRoute;
