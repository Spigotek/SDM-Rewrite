import type { Change } from "@sdm/domain";

/**
 * UI-side projection of the BFF/MSW `Change` payload. The workspace consumes
 * `/api/changes` (list) and `/api/changes/:id` (detail) directly — both return
 * the domain `Change` shape (MSW) or the F.2 `ChangeRowFe` (BFF, fields are a
 * superset of what the FE needs). We type FE state against `Change` so the
 * MSW fixture, the BFF endpoint, and the FE all share one vocabulary.
 *
 * The 4 detail tabs ↔ fields mapping:
 *  - DetailTab    → `category`, `risk`, `requesterId`, `assigneeId`,
 *                   `scheduledStartAt`/`Eend`, `actualStartAt`/`End`, `description`.
 *  - ImpactTab    → `affectedCiIds`.
 *  - RollbackTab  → `rollbackPlan` (markdown).
 *  - ApprovalsTab → `cabApprovers` (read-only — H.11 ships actions).
 */
export type ChangeRow = Change;

export type ChangeDetail = Change;

export type ChangeTabKey = "detail" | "impact" | "rollback" | "approvals";

export const CHANGE_TABS: ReadonlyArray<ChangeTabKey> = [
  "detail",
  "impact",
  "rollback",
  "approvals",
];
