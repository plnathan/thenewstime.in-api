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
   * Compatibility field retained for the existing API/domain model.
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
   * Final commercial advertisement amount.
   *
   * This is the persisted/source-of-truth commercial amount.
   *
   * It is intentionally separate from standardAmount.
   */
  advertisementAmount: number | null;

  /*
   * Financial values persisted on advertisements.
   */
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
   * Compatibility field.
   * Derived from clientId by the mapper.
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
   * Final commercial advertisement amount.
   */
  advertisementAmount: number | null;

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
   * Final commercial advertisement amount.
   *
   * This is separate from system-calculated standardAmount.
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
   * The caller supplies only the placement, pricing unit,
   * and quantity.
   *
   * Rate amount and standard amount are resolved by the
   * advertisement service from the effective rate card.
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
   * Final commercial advertisement amount.
   *
   * This maps directly to advertisements.advertisement_amount.
   */
  advertisementAmount?: number;

  /*
   * Discount and advance values are editable financial fields.
   *
   * Their calculated monetary values are generated by the
   * advertisement service and persisted by the repository.
   */
  discountPercentage?: number;
  advancePercentage?: number;

  currencyCode?: string;

  campaignId?: number;

  isHouseAd?: boolean;

  /*
   * Pricing fields are deliberately not exposed here.
   *
   * standardAmount,
   * pricingPlacementId,
   * pricingUnit,
   * pricingQuantity
   *
   * remain immutable after pricing has been created/snapshotted.
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
