/**
 * Domain model — UI doména pre SDM-Rewrite.
 *
 * Round 1 fresh — schémy z `01-api-analyst/schemas/*.ts` ešte neexistujú
 * (paralelný broadcast). Tento súbor preto definuje typy **inline ako
 * canonical**. V round-2 sa časti označené `// SOURCE: api-analyst` prepnú
 * na `import type { ... } from "@sdm/api-types"` a zostanú len UI-only typy.
 *
 * Compile pravidlá:
 *  - `npx tsc --noEmit --strict` musí prejsť bez chýb.
 *  - žiadne runtime hodnoty (export const), len typy a (branded) ID aliasy.
 *  - žiadne `any`, žiadne `// @ts-ignore`.
 *
 * Cross-references:
 *  - entities.md       — atribútové tabuľky a invarianty.
 *  - relationships.md  — vzťahy medzi agregátmi.
 *  - lifecycles/*.md   — state machines.
 *  - ui-views.md       — UI-only computed views.
 *  - glossary.md       — CA SDM ↔ UI doména mapping.
 */

// =============================================================================
// Branded ID typy — jednoduchá nominal typing emulácia
// =============================================================================

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type UserId = Brand<string, "UserId">;
export type RoleId = Brand<string, "RoleId">;
export type ContactId = Brand<string, "ContactId">;
export type GroupId = Brand<string, "GroupId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type LocationId = Brand<string, "LocationId">;
export type IncidentId = Brand<string, "IncidentId">;
export type RequestId = Brand<string, "RequestId">;
export type ProblemId = Brand<string, "ProblemId">;
export type ChangeId = Brand<string, "ChangeId">;
export type ChangeSpecId = Brand<string, "ChangeSpecId">;
export type CabApprovalId = Brand<string, "CabApprovalId">;
export type CiId = Brand<string, "CiId">;
export type RelationshipId = Brand<string, "RelationshipId">;
export type KbArticleId = Brand<string, "KbArticleId">;
export type KbCategoryId = Brand<string, "KbCategoryId">;
export type AttachmentId = Brand<string, "AttachmentId">;
export type ActivityLogId = Brand<string, "ActivityLogId">;
export type CatalogItemId = Brand<string, "CatalogItemId">;

// =============================================================================
// Spoločné enumy a hodnotové typy
// =============================================================================

export type IsoTimestamp = string; // ISO-8601, e.g. "2026-05-08T19:24:38Z"

export type Priority = 1 | 2 | 3 | 4 | 5;
export type Urgency = 1 | 2 | 3 | 4 | 5;
export type Impact = 1 | 2 | 3 | 4 | 5;
export type Severity = 1 | 2 | 3 | 4 | 5;

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

// =============================================================================
// Tenancy & identita
// =============================================================================

export interface Tenant {
  id: TenantId;
  name: string;
  code: string | null;
  superTenantId: TenantId | null;
  isActive: boolean;
}

export type RoleCode =
  | "ADMINISTRATOR"
  | "CONFIG_ADMINISTRATOR"
  | "CONFIG_ANALYST"
  | "CONFIG_VIEWER"
  | "CHANGE_MANAGER"
  | "SERVICE_DESK_ADMINISTRATOR"
  | "SERVICE_DESK_MANAGER"
  | "SYSTEM_ADMINISTRATOR"
  | "LEVEL_1_ANALYST"
  | "LEVEL_2_ANALYST"
  | "INCIDENT_MANAGER"
  | "PROBLEM_MANAGER";

/**
 * Permission enum — odvodený z CACF Functional Access matrix (PDF s. 2520).
 * Granularita: <modul>_<accessLevel>. UI ho používa pre conditional rendering.
 */
export type Permission =
  | "ADMINISTRATION_VIEW"
  | "ADMINISTRATION_MODIFY"
  | "CI_VIEW"
  | "CI_MODIFY"
  | "INCIDENT_VIEW"
  | "INCIDENT_MODIFY"
  | "PROBLEM_VIEW"
  | "PROBLEM_MODIFY"
  | "REQUEST_VIEW"
  | "REQUEST_MODIFY"
  | "CHANGE_VIEW"
  | "CHANGE_MODIFY"
  | "CHANGE_APPROVE"
  | "KB_VIEW"
  | "KB_MODIFY"
  | "KB_PUBLISH";

export interface Role {
  id: RoleId;
  code: RoleCode;
  displayName: string;
  permissions: readonly Permission[];
}

export interface RoleAssignment {
  userId: UserId;
  roleId: RoleId;
  tenantId: TenantId;
  assignedAt: IsoTimestamp | null;
}

export interface User {
  id: UserId;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  isActive: boolean;
  defaultTenantId: TenantId;
  roleAssignments: readonly RoleAssignment[];
}

export interface Contact {
  id: ContactId;
  username: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  contactType: "EMPLOYEE" | "CUSTOMER" | "VENDOR" | "GROUP";
  organizationId: OrganizationId | null;
  locationId: LocationId | null;
  isActive: boolean;
  tenantId: TenantId;
}

export interface Group {
  id: GroupId;
  name: string;
  managerId: UserId | null;
  memberIds: readonly UserId[];
  tenantId: TenantId;
}

export interface Organization {
  id: OrganizationId;
  name: string;
  phone: string | null;
  email: string | null;
  parentId: OrganizationId | null;
  tenantId: TenantId;
}

export interface Location {
  id: LocationId;
  name: string;
  country: string | null;
  state: string | null;
  city: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  floor: string | null;
  room: string | null;
  description: string;
  tenantId: TenantId;
}

// =============================================================================
// TicketBase — spoločná base pre Incident, Request, Problem
// =============================================================================

interface TicketBase {
  ref: string;
  summary: string;
  description: string | null;
  priority: Priority;
  urgency: Urgency;
  assigneeId: UserId | null;
  assignedGroupId: GroupId | null;
  openedAt: IsoTimestamp;
  targetStartAt: IsoTimestamp | null;
  resolvedAt: IsoTimestamp | null;
  closedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  lastModifiedAt: IsoTimestamp;
  tenantId: TenantId;
}

// =============================================================================
// Incident
// =============================================================================

export type IncidentStatus =
  | "OP" // Open
  | "WIP" // Work In Progress
  | "HLD" // Hold
  | "AWU" // Awaiting User
  | "AWV" // Awaiting Vendor
  | "ESC" // Escalated
  | "RES" // Resolved
  | "CL" // Closed
  | "CD"; // Cancelled

export type IncidentCategory = string; // pcat lookup, tenant-customizable

export interface Incident extends TicketBase {
  id: IncidentId;
  status: IncidentStatus;
  impact: Impact;
  category: IncidentCategory | null;
  isMajor: boolean;
  affectedEndUserId: ContactId;
  requesterId: UserId | null;
  affectedCiId: CiId | null;
  callBackAt: IsoTimestamp | null;
  outageStartAt: IsoTimestamp | null;
  outageEndAt: IsoTimestamp | null;
  outageType: string | null;
  isReturnedToService: boolean;
  symptomCode: string | null;
  rootCause: string | null;
  solutionUrls: readonly string[];
  linkedProblemIds: readonly ProblemId[];
  linkedChangeIds: readonly ChangeId[];
}

// =============================================================================
// Request (Service Request)
// =============================================================================

export type RequestStatus =
  | "SUBMITTED"
  | "APPR_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "AWU"
  | "DELIVERED"
  | "CL"
  | "CD";

export type RequestCategory = string; // pcat lookup

/**
 * Catalog-item-specific form payload. Schéma je dynamická per katalógovú
 * položku — UI ju vykresľuje cez JSON Schema renderer.
 * Konkrétny shape potvrdí 01-api-analyst (Service Catalog endpoint).
 */
export type RequestFormData = Record<string, unknown>;

export interface Request extends TicketBase {
  id: RequestId;
  status: RequestStatus;
  severity: Severity | null;
  category: RequestCategory;
  requesterId: UserId;
  serviceCatalogItemId: CatalogItemId | null;
  formData: RequestFormData;
  isReturnedToService: boolean;
  linkedChangeIds: readonly ChangeId[];
}

// =============================================================================
// Problem
// =============================================================================

export type ProblemStatus =
  | "IDENTIFIED"
  | "INVESTIGATION"
  | "ROOT_CAUSE_KNOWN"
  | "KNOWN_ERROR"
  | "RESOLVED"
  | "CL"
  | "CD";

export type ProblemCategory = string;

export interface Problem extends TicketBase {
  id: ProblemId;
  status: ProblemStatus;
  impact: Impact;
  category: ProblemCategory | null;
  rootCause: string | null;
  isMajor: boolean;
  linkedIncidentIds: readonly IncidentId[];
  linkedChangeIds: readonly ChangeId[];
  linkedKbArticleIds: readonly KbArticleId[];
}

// =============================================================================
// Change
// =============================================================================

export type ChangeStatus =
  | "RFC"
  | "APPR_PENDING"
  | "APPROVED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "VERIFICATION_IN_PROGRESS"
  | "VERIFIED"
  | "REJECTED"
  | "CL"
  | "CD"
  // Emergency overlay states
  | "EMG_RFC"
  | "EMG_IN_PROGRESS"
  | "EMG_RETROSPECTIVE";

export type ChangeCategory = "STANDARD" | "NORMAL" | "EMERGENCY";

export type ApprovalDecision = "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED";

export interface CabApproval {
  id: CabApprovalId;
  approverId: UserId;
  decision: ApprovalDecision;
  decidedAt: IsoTimestamp | null;
  comment: string | null;
}

/**
 * VerifyStatus — 15 stavov dokumentovaných v PDF s. 2507–2508.
 * Post-MVP read-only.
 */
export type VerifyStatus =
  // Initial statuses
  | "VERIFICATION_PENDING"
  | "MANUAL_VERIFICATION_WILL_BE_REQUIRED"
  | "USE_DISCOVERED_VALUE"
  | "SET_AFTER_CHANGE_EXECUTED"
  // Final statuses
  | "VERIFIED"
  | "WAS_MANUALLY_VERIFIED"
  | "USED_DISCOVERED_VALUE"
  | "WAS_SET_TO_PLANNED_VALUE"
  | "ACCEPTED_PLANNED_VALUE"
  | "ACCEPTED_DISCOVERED_VALUE"
  | "NO_CHANGE"
  | "CANCEL"
  // Intervention statuses
  | "FAILED_VERIFICATION"
  | "MANUAL_VERIFICATION_ACTIVE"
  // Action override statuses
  | "ACCEPT_PLANNED_VALUE"
  | "ACCEPT_DISCOVERED_VALUE";

export interface ChangeSpecification {
  id: ChangeSpecId;
  changeId: ChangeId;
  ciId: CiId | null;
  attributeName: string;
  plannedValue: string;
  verifyStatus: VerifyStatus;
  originalValue: string | null;
  lastDiscoveredValue: string | null;
}

export interface Change {
  id: ChangeId;
  ref: string;
  summary: string;
  description: string | null;
  status: ChangeStatus;
  category: ChangeCategory;
  risk: RiskLevel;
  requesterId: UserId;
  assigneeId: UserId | null;
  assignedGroupId: GroupId | null;
  affectedCiIds: readonly CiId[];
  linkedProblemIds: readonly ProblemId[];
  linkedIncidentIds: readonly IncidentId[];
  scheduledStartAt: IsoTimestamp | null;
  scheduledEndAt: IsoTimestamp | null;
  actualStartAt: IsoTimestamp | null;
  actualEndAt: IsoTimestamp | null;
  approvalState: ApprovalState;
  cabApprovers: readonly CabApproval[];
  changeSpecifications: readonly ChangeSpecification[];
  openedAt: IsoTimestamp;
  closedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  lastModifiedAt: IsoTimestamp;
  tenantId: TenantId;
}

// =============================================================================
// Knowledge Base
// =============================================================================

export type KbDocType = "FAQ" | "HOW_TO" | "KNOWN_ERROR" | "WORKAROUND" | "REFERENCE";

export type KbStatus =
  | "DRAFT"
  | "REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "EXPIRED"
  | "RETIRED"
  | "REJECTED";

export type KbPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Štruktúrované telo KB článku. Jednotlivé bloky sa renderujú
 * UI komponentami; konkrétny markup framework potvrdí 06-tech-stack-selector.
 */
export interface KbArticleBody {
  blocks: readonly KbContentBlock[];
}

export type KbContentBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; language: string; code: string }
  | { kind: "list"; ordered: boolean; items: readonly string[] }
  | { kind: "image"; attachmentId: AttachmentId; alt: string }
  | { kind: "callout"; severity: "info" | "warning" | "critical"; text: string };

export interface KbArticle {
  id: KbArticleId;
  docTypeId: KbDocType;
  title: string;
  summary: string | null;
  body: KbArticleBody;
  status: KbStatus;
  priority: KbPriority | null;
  authorId: UserId;
  ownerId: UserId;
  assigneeId: UserId | null;
  subjectExpertId: UserId | null;
  productId: string | null;
  relevance: number | null; // 0..100
  hits: number;
  acceptedHits: number;
  buResult: number | null; // 0..1 FAQ rating
  categoryId: KbCategoryId;
  attachmentIds: readonly AttachmentId[];
  previousVersionId: KbArticleId | null;
  effectiveFrom: IsoTimestamp | null;
  expiresAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  lastModifiedAt: IsoTimestamp;
  tenantId: TenantId;
}

export interface KbCategory {
  id: KbCategoryId;
  name: string;
  parentId: KbCategoryId | null;
  description: string | null;
  tenantId: TenantId;
}

// =============================================================================
// CMDB — Configuration Item (variant typed)
// =============================================================================

export type CiClass =
  | "DatabaseInstance"
  | "DiskPartition"
  | "EnvironmentalSensor"
  | "ESXHypervisor"
  | "File"
  | "GenericIPDevice"
  | "HyperVHypervisorManager"
  | "InterfaceCard"
  | "Location"
  | "MediaDrive"
  | "Memory"
  | "NetworkServer"
  | "OperatingSystem"
  | "Port"
  | "PortfolioApplication"
  | "Printer"
  | "Processor"
  | "ProvisionedSoftware"
  | "ResourceServer"
  | "Router"
  | "RunningHardware"
  | "Service"
  | "StoragePool"
  | "StorageVolume";

export type CiStatus = "ACTIVE" | "INACTIVE" | "RETIRED" | "INVENTORY";

export type RelationshipType =
  | "DEPENDS_ON"
  | "SUPPORTS"
  | "RUNS_ON"
  | "INSTALLED_ON"
  | "CONNECTED_TO"
  | "PARENT_OF"
  | "USES_SERVICE"
  | "PROVIDES_SERVICE";

export interface CIRelationship {
  id: RelationshipId;
  sourceCiId: CiId;
  targetCiId: CiId;
  type: RelationshipType;
}

interface CiBase {
  id: CiId;
  name: string;
  family: string | null;
  systemName: string | null;
  assetNumber: string | null;
  serialNumber: string | null;
  status: CiStatus;
  vendor: string | null;
  model: string | null;
  dnsName: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  locationId: LocationId | null;
  organizationId: OrganizationId | null;
  primaryContactId: UserId | null;
  description: string;
  createdAt: IsoTimestamp;
  lastModifiedAt: IsoTimestamp;
  tenantId: TenantId;
}

// Class-specific props — diskriminované varianty.
// Atribúty per class odvodené z PDF s. 4013–4030 (DatabaseInstance reference).
// Iba atribúty navyše oproti CiBase; common fields ako name/vendor/model dedíme.

export interface CiPropsDatabaseInstance {
  dbInstanceName: string | null;
  productName: string | null;
  dbServerType: string | null;
  processDistinguishingId: string | null;
}

export interface CiPropsMemory {
  sizeInMB: number | null;
  memoryType: string | null;
  isPhysical: boolean;
}

export interface CiPropsProcessor {
  speedInGHz: number | null;
  processorType: string | null;
  osNumeric: string | null;
}

export interface CiPropsOperatingSystem {
  version: string | null;
  majorVersion: string | null;
  minorVersion: string | null;
  buildNumber: string | null;
  osType: string | null;
}

export interface CiPropsService {
  serviceVersion: string | null;
  businessRisk: string | null;
  businessImpact: string | null;
  impactDescription: string | null;
  availabilityStart: IsoTimestamp | null;
  availabilityEnd: IsoTimestamp | null;
  serviceManager: string | null;
  serviceLifecycleState: string | null;
  serviceCapabilities: string | null;
}

export interface CiPropsNetworkServer {
  productName: string | null;
  protocol: string | null;
  processId: string | null;
  accessedViaTcpPort: string | null;
}

export interface CiPropsPortfolioApplication {
  isActive: boolean;
  availabilityStart: IsoTimestamp | null;
  availabilityEnd: IsoTimestamp | null;
  manager: string | null;
  openForTimeEntry: boolean;
  stage: string | null;
}

export interface CiPropsRouter {
  firmwareVersion: string | null;
  routingProtocolTypes: string | null;
  routingRedundancyType: string | null;
}

export interface CiPropsStorageVolume {
  capacityInMB: number | null;
  logicalUnitNumber: string | null;
  portId: string | null;
  portWWName: string | null;
}

export interface CiPropsStoragePool {
  capacityInGB: number | null;
  raidLevel: string | null;
  isHaEnabled: boolean;
  groupType: string | null;
}

/**
 * Generický fallback pre CI classes bez plne modelovaného props typu.
 * Hodnoty sú zachované ako string-keyed dictionary; UI ich zobrazí v
 * "Attributes" tabe bez špeciálneho renderingu.
 */
export type CiPropsGeneric = Readonly<Record<string, string | number | boolean | null>>;

// Diskriminovaný union — výber podľa class.
export type Ci =
  | (CiBase & { class: "DatabaseInstance"; props: CiPropsDatabaseInstance })
  | (CiBase & { class: "Memory"; props: CiPropsMemory })
  | (CiBase & { class: "Processor"; props: CiPropsProcessor })
  | (CiBase & { class: "OperatingSystem"; props: CiPropsOperatingSystem })
  | (CiBase & { class: "Service"; props: CiPropsService })
  | (CiBase & { class: "NetworkServer"; props: CiPropsNetworkServer })
  | (CiBase & { class: "PortfolioApplication"; props: CiPropsPortfolioApplication })
  | (CiBase & { class: "Router"; props: CiPropsRouter })
  | (CiBase & { class: "StorageVolume"; props: CiPropsStorageVolume })
  | (CiBase & { class: "StoragePool"; props: CiPropsStoragePool })
  | (CiBase & {
      class: Exclude<
        CiClass,
        | "DatabaseInstance"
        | "Memory"
        | "Processor"
        | "OperatingSystem"
        | "Service"
        | "NetworkServer"
        | "PortfolioApplication"
        | "Router"
        | "StorageVolume"
        | "StoragePool"
      >;
      props: CiPropsGeneric;
    });

// =============================================================================
// Attachment & ActivityLog
// =============================================================================

export type AttachmentLinkTarget =
  | { kind: "incident"; id: IncidentId }
  | { kind: "request"; id: RequestId }
  | { kind: "problem"; id: ProblemId }
  | { kind: "change"; id: ChangeId }
  | { kind: "kb"; id: KbArticleId };

export interface Attachment {
  id: AttachmentId;
  name: string;
  fileName: string | null;
  description: string;
  folderId: string;
  repositoryId: string;
  linkedTo: AttachmentLinkTarget;
  kind: "FILE" | "URL";
  url: string | null;
  uploadedById: UserId;
  uploadedAt: IsoTimestamp;
}

export type ActivityType =
  | "STATUS_CHANGE"
  | "COMMENT"
  | "ASSIGNMENT"
  | "ESCALATION"
  | "ATTACHMENT_ADDED"
  | "LINK_ADDED"
  | "LINK_REMOVED"
  | "PRIORITY_CHANGED"
  | "MERGE"
  | "REOPEN"
  | "OTHER";

export interface ActivityLog {
  id: ActivityLogId;
  parentRef: string;
  analystId: UserId;
  type: ActivityType;
  description: string;
  timestamp: IsoTimestamp;
  internalOnly: boolean;
  tenantId: TenantId;
}

// =============================================================================
// SLA snapshot
// =============================================================================

export type SlaState = "OK" | "AT_RISK" | "BREACHED" | "PAUSED" | "STOPPED";

export interface SlaSnapshot {
  state: SlaState;
  remainingMs: number | null;
  threshold: { atRiskMs: number };
  pausedReasons: readonly string[];
}

// =============================================================================
// UI-only computed views — viď ui-views.md
// =============================================================================

export type TicketKind = "incident" | "request" | "problem";

export interface UiQueueItem {
  ticketType: TicketKind;
  id: IncidentId | RequestId | ProblemId;
  ref: string;
  summary: string;
  status: string;
  priority: Priority;
  category: string | null;
  assigneeFullName: string | null;
  assignedGroupName: string | null;
  slaState: "ok" | "at-risk" | "breached" | "paused";
  slaRemainingMs: number | null;
  lastActivityAt: IsoTimestamp;
  lastActivityType: ActivityType;
  tenantId: TenantId;
}

export interface IncidentSummary {
  id: IncidentId;
  ref: string;
  summary: string;
  status: IncidentStatus;
  priority: Priority;
  isMajor: boolean;
}

export interface RequestSummary {
  id: RequestId;
  ref: string;
  summary: string;
  status: RequestStatus;
  priority: Priority;
}

export interface ProblemSummary {
  id: ProblemId;
  ref: string;
  summary: string;
  status: ProblemStatus;
  priority: Priority;
}

export interface ChangeSummary {
  id: ChangeId;
  ref: string;
  summary: string;
  status: ChangeStatus;
  category: ChangeCategory;
  risk: RiskLevel;
  scheduledStartAt: IsoTimestamp | null;
  scheduledEndAt: IsoTimestamp | null;
}

export interface KbArticleSummary {
  id: KbArticleId;
  title: string;
  docTypeId: KbDocType;
  status: KbStatus;
  hits: number;
  buResult: number | null;
}

export interface TicketPermissions {
  canEdit: boolean;
  canAssign: boolean;
  canChangeStatus: boolean;
  canEscalate: boolean;
  canCancel: boolean;
  canResolve: boolean;
  canClose: boolean;
  canReopen: boolean;
  canLinkProblem: boolean;
  canLinkChange: boolean;
  canLinkKb: boolean;
  allowedNextStatuses: readonly string[];
}

export interface UiTicketDetail<T extends Incident | Request | Problem> {
  ticket: T;
  affectedEndUser: Contact | null;
  requester: Contact | null;
  assignee: Contact | null;
  assignedGroup: Group | null;
  affectedCi: Ci | null;
  linkedProblems: readonly ProblemSummary[];
  linkedChanges: readonly ChangeSummary[];
  linkedKbArticles: readonly KbArticleSummary[];
  attachments: readonly Attachment[];
  activityLog: readonly ActivityLog[];
  permissions: TicketPermissions;
  sla: SlaSnapshot;
}

export interface CiNode {
  id: CiId;
  name: string;
  class: CiClass;
  status: CiStatus;
  distanceFromRoot: number;
}

export interface CiEdge {
  sourceId: CiId;
  targetId: CiId;
  type: RelationshipType;
}

export interface UiCiNeighborhood {
  rootCi: Ci;
  nodes: readonly CiNode[];
  edges: readonly CiEdge[];
  depth: number;
  totalNodes: number;
  truncated: boolean;
}

export interface UiKbSearchHit {
  article: KbArticleSummary;
  relevanceScore: number;
  snippet: string;
  matchedFields: readonly ("title" | "summary" | "body" | "category")[];
  isStale: boolean;
}

export interface KbSearchFilters {
  docTypes: readonly KbDocType[];
  categoryIds: readonly KbCategoryId[];
  productIds: readonly string[];
  includeExpired: boolean;
}

export interface UiKbSearchResponse {
  hits: readonly UiKbSearchHit[];
  totalCount: number;
  facets: {
    docType: Readonly<Record<KbDocType, number>>;
    category: Readonly<Record<string, number>>;
  };
  query: {
    q: string;
    filters: KbSearchFilters;
  };
  tookMs: number;
}

export interface UiTenantSwitcherEntry {
  tenant: Tenant;
  roleCount: number;
  primaryRole: RoleCode;
  isDefault: boolean;
  isActive: boolean;
  lastVisitedAt: IsoTimestamp | null;
}

export interface UiQueueFilter {
  ticketTypes: readonly TicketKind[];
  statuses: readonly string[];
  priorities: readonly Priority[];
  assigneeIds: readonly UserId[] | "me" | "any";
  groupIds: readonly GroupId[] | "myGroups";
  slaStates: readonly ("ok" | "at-risk" | "breached")[];
  searchQuery: string | null;
  sortBy: "priority" | "openedAt" | "lastActivity" | "slaRemaining";
  sortDir: "asc" | "desc";
}

export interface UiUserPreferences {
  locale: "sk" | "en";
  theme: "light" | "dark" | "system";
  queueDefaultFilter: UiQueueFilter;
}

export interface UiUserProfile {
  user: User;
  primaryContact: Contact;
  tenants: readonly UiTenantSwitcherEntry[];
  activeTenantId: TenantId;
  preferences: UiUserPreferences;
}
