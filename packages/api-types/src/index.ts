export { PACKAGE_NAME as DOMAIN_NAME } from "@sdm/domain";
export const PACKAGE_NAME = "@sdm/api-types";

/**
 * BFF aggregator UI contracts (F.3).
 *
 * `Ui*` types are the wire shape returned by aggregator endpoints — uniform
 * across CA SDM factories so the FE renders one queue list regardless of
 * whether a row comes from `in`, `cr`, or `pr`. Per-entity FE shapes (defined
 * in `apps/bff/src/api/endpoints/*.ts`) remain the contract for direct
 * `/api/incidents`, `/api/requests`, ... reads — those preserve per-factory
 * fields (`type` on requests, `impact`/`urgency` on incidents/problems).
 */

export interface FkRef {
  readonly id: string;
  readonly code: string;
  readonly label: string;
}

export type UiTicketType = "incident" | "request" | "problem" | "change";

export interface UiQueueItem {
  readonly ticketType: UiTicketType;
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly status: FkRef | null;
  readonly priority: FkRef | null;
  readonly customer: FkRef | null;
  readonly assignee: FkRef | null;
  /**
   * ISO-8601. Sort key for queue ordering (desc).
   * MVP uses `open_date` as a proxy because CA SDM `last_mod_dt` is not in the
   * default `X-Obj-Attrs` projection — switching to true last-activity will
   * happen once F.3 ticket-detail surfaces the activity log.
   */
  readonly lastActivityAt: string | null;
  readonly openedAt: string | null;
}

export interface UiQueuePage {
  readonly data: ReadonlyArray<UiQueueItem>;
  readonly page: {
    readonly total: number;
    readonly start: number;
    readonly size: number;
  };
  /**
   * True when at least one underlying factory hit its per-call page cap and
   * may contain more rows beyond the fan-out buffer. MVP fan-out pulls a
   * fixed buffer per factory; cross-factory deep pagination is post-MVP.
   */
  readonly hasMore: boolean;
}

export interface UiTicketDetail {
  readonly ticketType: UiTicketType;
  readonly id: string;
  readonly ref: string;
  readonly summary: string;
  readonly description: string;
  readonly status: FkRef | null;
  readonly priority: FkRef | null;
  readonly customer: FkRef | null;
  readonly assignee: FkRef | null;
  readonly openedAt: string | null;
  readonly closedAt: string | null;
  readonly linked: UiTicketDetailLinked;
  readonly attachments: UiTicketDetailAttachments;
  readonly activity: UiTicketDetailActivity;
}

/**
 * `_unsupported` markers communicate to the FE that the underlying CA SDM
 * factory (lrel_*, attmnt, act_log) is not yet wired in F.3. The FE shows
 * an empty-state placeholder; switching `_unsupported: false` (post-discovery
 * chunk) is a non-breaking change.
 */
export interface UiTicketDetailLinked {
  readonly _unsupported: boolean;
  readonly problems: ReadonlyArray<FkRef>;
  readonly changes: ReadonlyArray<FkRef>;
  readonly incidents: ReadonlyArray<FkRef>;
}

export interface UiTicketDetailAttachments {
  readonly _unsupported: boolean;
  readonly items: ReadonlyArray<UiAttachmentMeta>;
}

export interface UiAttachmentMeta {
  readonly id: string;
  readonly name: string;
  readonly mime: string | null;
  readonly sizeBytes: number | null;
  readonly uploadedAt: string | null;
}

export interface UiTicketDetailActivity {
  readonly _unsupported: boolean;
  readonly items: ReadonlyArray<UiActivityEntry>;
  readonly hasMore: boolean;
}

export interface UiActivityEntry {
  readonly id: string;
  readonly kind: "public" | "internal" | "system";
  readonly author: FkRef | null;
  readonly text: string;
  readonly createdAt: string | null;
}

export interface MyTenant {
  readonly id: string;
  readonly name: string;
  readonly isServiceProvider: boolean;
  readonly roles: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly uiRole: string;
  }>;
}

export interface MyTenantsResponse {
  readonly tenants: ReadonlyArray<MyTenant>;
  readonly defaultTenantId: string;
  readonly activeTenantId: string;
}
