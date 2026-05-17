import type {
  AttachmentId,
  CabApprovalId,
  CatalogItemId,
  ChangeId,
  ChangeSpecId,
  CiId,
  ContactId,
  GroupId,
  IncidentId,
  KbArticleId,
  KbCategoryId,
  LocationId,
  OrganizationId,
  ProblemId,
  RelationshipId,
  RequestId,
  RoleId,
  TenantId,
  UserId,
} from "./model";

// Branded ID factories — runtime no-ops, compile-time nominal typing.
// Use at module boundaries (API responses, route params) to assert source.
export const tenantId = (s: string): TenantId => s as TenantId;
export const userId = (s: string): UserId => s as UserId;
export const roleId = (s: string): RoleId => s as RoleId;
export const contactId = (s: string): ContactId => s as ContactId;
export const groupId = (s: string): GroupId => s as GroupId;
export const organizationId = (s: string): OrganizationId => s as OrganizationId;
export const locationId = (s: string): LocationId => s as LocationId;
export const incidentId = (s: string): IncidentId => s as IncidentId;
export const requestId = (s: string): RequestId => s as RequestId;
export const problemId = (s: string): ProblemId => s as ProblemId;
export const changeId = (s: string): ChangeId => s as ChangeId;
export const changeSpecId = (s: string): ChangeSpecId => s as ChangeSpecId;
export const cabApprovalId = (s: string): CabApprovalId => s as CabApprovalId;
export const ciId = (s: string): CiId => s as CiId;
export const relationshipId = (s: string): RelationshipId => s as RelationshipId;
export const kbArticleId = (s: string): KbArticleId => s as KbArticleId;
export const kbCategoryId = (s: string): KbCategoryId => s as KbCategoryId;
export const attachmentId = (s: string): AttachmentId => s as AttachmentId;
export const catalogItemId = (s: string): CatalogItemId => s as CatalogItemId;
