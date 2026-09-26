export type AdvertisementClientStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type AdvertisementBusinessTypeStatus = "ACTIVE" | "INACTIVE";

export type AdvertisementHoldType = "AUTOMATIC" | "MANUAL";

export type AdvertisementType =
  "DISPLAY" | "BANNER" | "VIDEO" | "NATIVE" | "POPUP" | "OVERLAY";

export type AdvertisementStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type AdvertisementWorkflowStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ON_HOLD" | "ARCHIVED";

export type AdvertisementPricingUnit =
  "DAY" | "WEEK" | "MONTH" | "IMPRESSION" | "CAMPAIGN" | "FIXED";

export interface AdvertisementPricingInput {
  placementId: number;
  pricingUnit: AdvertisementPricingUnit;
  quantity: number;
}

export interface AdvertisementPricingFields {
  pricingPlacementId: number | null;
  pricingUnit: AdvertisementPricingUnit | null;
  pricingQuantity: number | null;
  standardAmount: number | null;
}

/**
 * System-calculated pricing fields.
 *
 * These values are never supplied directly by the API caller.
 * They are derived from the effective rate card and explicit
 * pricing quantity during advertisement creation.
 *
 * They remain optional because existing repository/service tests
 * create advertisements without system pricing.
 */
export interface AdvertisementCalculatedPricingFields {
  standardAmount?: number | null;
  pricingPlacementId?: number | null;
  pricingUnit?: AdvertisementPricingUnit | null;
  pricingQuantity?: number | null;
}

export interface AdvertisementBusinessType {
  id: number;
  code: string;
  displayName: string;
  description: string | null;
  displayOrder: number;
  status: AdvertisementBusinessTypeStatus;
}

export interface AdvertisementClient {
  id: number;
  clientCode: string;
  name: string;
  displayName: string | null;
  businessName: string | null;
  businessTypeId: number | null;
  businessType: AdvertisementBusinessType | null;
  website: string | null;
  primaryAddress: string | null;
  communicationAddress: string | null;
  contactPerson: string | null;
  contactNo: string | null;
  alternateMobile: string | null;
  email: string | null;
  alternateEmail: string | null;
  websiteUrl: string | null;
  status: AdvertisementClientStatus;
  notes: string | null;

  adCreationHold: boolean;
  adCreationHoldType: AdvertisementHoldType | null;
  adCreationHoldReason: string | null;
  adCreationHoldRemarks: string | null;
  adCreationHoldAt: Date | null;
  adCreationHoldBy: number | null;
  adCreationUnholdAt: Date | null;
  adCreationUnholdBy: number | null;
  adCreationUnholdReason: string | null;

  paymentAttentionRequired: boolean;

  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Advertisement extends AdvertisementPricingFields {
  id: number;

  /*
   * advertiserId is retained as a compatibility field for the
   * existing API/domain model.
   *
   * The database relationship is represented by client_id.
   * Repository mappers derive advertiserId from clientId.
   */
  advertiserId: number;

  clientId: number | null;
  campaignId: number | null;

  name: string;
  internalName: string | null;

  advertisementType: AdvertisementType;
  destinationUrl: string | null;

  priority: number;

  status: AdvertisementStatus;

  startAt: Date | null;
  endAt: Date | null;

  isClickable: boolean;
  openInNewTab: boolean;

  notes: string | null;

  workflowStatus: AdvertisementWorkflowStatus;

  submittedAt: Date | null;
  submittedBy: number | null;

  approvedAt: Date | null;
  approvedBy: number | null;

  rejectedAt: Date | null;
  rejectedBy: number | null;
  rejectionReason: string | null;

  onHoldAt: Date | null;
  onHoldBy: number | null;
  onHoldReason: string | null;

  /*
   * Negotiated / agreed commercial amount.
   *
   * This is the persisted/source-of-truth financial amount.
   */
  advertisementAmount: number | null;

  /*
   * API/domain compatibility alias for advertisementAmount.
   *
   * This is intentionally optional so existing domain/test fixtures
   * that only provide advertisementAmount remain type-compatible.
   *
   * When returned by the mapper, it should contain the same value
   * as advertisementAmount.
   */
  agreedAmount?: number | null;

  discountPercentage: number;
  discountAmount: number;

  advancePercentage: number;
  advanceAmount: number;

  adjustmentAmount: number;
  adjustmentReason: string | null;
  adjustmentBy: number | null;
  adjustmentAt: Date | null;

  currencyCode: string;

  isHouseAd: boolean;

  createdBy: number | null;
  updatedBy: number | null;

  createdAt: Date;
  updatedAt: Date;

  client: AdvertisementClient | null;
}

export interface AdvertisementListItem extends AdvertisementPricingFields {
  id: number;

  /*
   * Compatibility field. Derived from clientId by the mapper.
   */
  advertiserId: number;

  clientId: number | null;
  clientName: string | null;
  clientCode: string | null;

  name: string;
  advertisementType: AdvertisementType;

  priority: number;

  status: AdvertisementStatus;
  workflowStatus: AdvertisementWorkflowStatus;

  startAt: Date | null;
  endAt: Date | null;

  /*
   * Persisted/source-of-truth negotiated/agreed amount.
   */
  advertisementAmount: number | null;

  /*
   * API/domain compatibility alias for advertisementAmount.
   *
   * Optional to preserve compatibility with existing list-item
   * repository/service test fixtures.
   */
  agreedAmount?: number | null;

  discountPercentage: number;
  discountAmount: number;

  advancePercentage: number;
  advanceAmount: number;

  adjustmentAmount: number;

  currencyCode: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdvertisementInput {
  clientId?: number | null;
  name: string;

  internalName?: string;
  advertisementType?: AdvertisementType;
  destinationUrl?: string;

  priority?: number;

  startAt?: string | Date;
  endAt?: string | Date;

  isClickable?: boolean;
  openInNewTab?: boolean;

  notes?: string;

  /*
   * advertisementAmount is the negotiated/agreed amount.
   *
   * It must not be replaced by standardAmount.
   */
  advertisementAmount?: number;

  discountPercentage?: number;
  advancePercentage?: number;

  currencyCode?: string;

  campaignId?: number;

  isHouseAd?: boolean;

  /*
   * System pricing input.
   *
   * placementId identifies the placement whose rate card is used.
   * pricingUnit identifies the applicable system-defined rate-card unit.
   * quantity is the explicit billable quantity.
   *
   * Rate amount and standard amount are intentionally not accepted
   * from the API caller.
   */
  pricing?: AdvertisementPricingInput;
}

export interface UpdateAdvertisementInput {
  name?: string;

  internalName?: string;
  advertisementType?: AdvertisementType;
  destinationUrl?: string;

  priority?: number;

  startAt?: string | Date;
  endAt?: string | Date;

  isClickable?: boolean;
  openInNewTab?: boolean;

  notes?: string;

  /*
   * API/domain name for the negotiated/agreed commercial amount.
   *
   * The repository persists this into advertisement_amount.
   */
  agreedAmount?: number;

  /*
   * Compatibility field for existing direct repository callers.
   *
   * When both agreedAmount and advertisementAmount are supplied,
   * agreedAmount is authoritative.
   */
  advertisementAmount?: number;

  discountPercentage?: number;
  advancePercentage?: number;

  currencyCode?: string;

  campaignId?: number;

  isHouseAd?: boolean;

  /*
   * Pricing is deliberately not exposed here.
   *
   * Once an advertisement has been priced/snapshotted, its pricing
   * history must remain immutable. A future pricing change should
   * create a new pricing snapshot through a dedicated pricing flow.
   */
}

export interface AdvertisementCalculatedFinancialFields {
  discountAmount?: number;
  advanceAmount?: number;
}

export interface AdvertisementSearchFilters {
  page: number;
  pageSize: number;

  search?: string;
  clientId?: number;

  workflowStatus?: AdvertisementWorkflowStatus;
  status?: AdvertisementStatus;
}

export interface PaginatedAdvertisements {
  items: AdvertisementListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdvertisementWorkflowHistory {
  id: number;
  advertisementId: number;
  fromStatus: AdvertisementWorkflowStatus | null;
  toStatus: AdvertisementWorkflowStatus;
  remarks: string | null;
  performedBy: number | null;
  performedAt: Date;
}

export interface AdvertisementWorkflowInput {
  remarks?: string;
}

export interface AdvertisementRejectInput {
  reason: string;
  remarks?: string;
}

export interface AdvertisementHoldInput {
  reason: string;
  remarks?: string;
}

export interface AdvertisementWorkflowResult {
  advertisement: Advertisement;
  history: AdvertisementWorkflowHistory;
}
