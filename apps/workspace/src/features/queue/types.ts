import type { UiQueueItem, UiTicketType } from "@sdm/api-types";

/**
 * Active filter shape mirrored into the URL query (`?status=OP,WIP&priority=1`)
 * and persisted via saved views. All fields are arrays of CA SDM codes
 * (`status.code`, `priority.code`, `assignee.id`) — empty array = no filter on
 * that axis. Friendly chip labels are computed at render time from the
 * available rows so we don't need to ship a static enum.
 */
export interface QueueFilters {
  readonly status: ReadonlyArray<string>;
  readonly priority: ReadonlyArray<string>;
  readonly assignee: ReadonlyArray<string>;
  readonly ticketType: ReadonlyArray<UiTicketType>;
  readonly customer: ReadonlyArray<string>;
  readonly search: string;
}

export const EMPTY_FILTERS: QueueFilters = {
  status: [],
  priority: [],
  assignee: [],
  ticketType: [],
  customer: [],
  search: "",
};

export type QueueColumnKey =
  | "ref"
  | "ticketType"
  | "status"
  | "priority"
  | "summary"
  | "customer"
  | "assignee"
  | "age";

export interface QueueColumnConfig {
  readonly visible: ReadonlyArray<QueueColumnKey>;
}

export const DEFAULT_COLUMN_CONFIG: QueueColumnConfig = {
  visible: ["ref", "ticketType", "status", "priority", "summary", "customer", "assignee", "age"],
};

/**
 * Saved view = named snapshot of filters + (future) column config + sort. v0
 * stores filters only — column config persists separately so a "saved view"
 * doesn't override the user's preferred column visibility.
 */
export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly filters: QueueFilters;
}

export type { UiQueueItem };
