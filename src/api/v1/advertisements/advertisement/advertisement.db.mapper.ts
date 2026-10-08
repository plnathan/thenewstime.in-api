import type {
  Advertisement,
  AdvertisementBusinessType,
  AdvertisementClient,
  AdvertisementListItem
} from "./advertisement.types.js";

interface AdvertisementBusinessTypeRow {
  id: number | string;
  code: string;
  display_name: string;
  description: string | null;
  display_order: number;
  status: "ACTIVE" | "INACTIVE";
}

interface AdvertisementClientRow {
  id: number | string;
  client_code: string;
  name: string;
  display_name: string | null;
  business_name: string | null;
  business_type_id: number | string | null;

  business_type_code: string | null;
  business_type_display_name: string | null;
  business_type_description: string | null;
  business_type_display_order: number | null;
  business_type_status: "ACTIVE" | "INACTIVE" | null;

  website: string | null;
  primary_address: string | null;
  communication_address: string | null;
  contact_person: string | null;
  contact_no: string | null;
  alternate_mobile: string | null;
  email: string | null;
  alternate_email: string | null;
  website_url: string | null;

  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  notes: string | null;

  ad_creation_hold: boolean;
  ad_creation_hold_type: "AUTOMATIC" | "MANUAL" | null;

  ad_creation_hold_reason: string | null;
  ad_creation_hold_remarks: string | null;
  ad_creation_hold_at: Date | null;
  ad_creation_hold_by: number | string | null;

  ad_creation_unhold_at: Date | null;
  ad_creation_unhold_by: number | string | null;
  ad_creation_unhold_reason: string | null;

  payment_attention_required: boolean;

  created_by: number | string | null;
  updated_by: number | string | null;

  created_at: Date;
  updated_at: Date;
}

interface AdvertisementRow {
  id: number | string;

  client_id: number | string | null;
  campaign_id: number | string | null;

  name: string;
  internal_name: string | null;

  advertisement_type:
    "DISPLAY" | "BANNER" | "VIDEO" | "NATIVE" | "POPUP" | "OVERLAY";

  destination_url: string | null;

  priority: number;

  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";

  start_at: Date | null;
  end_at: Date | null;

  is_clickable: boolean;
  open_in_new_tab: boolean;

  notes: string | null;

  workflow_status:
    "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ON_HOLD" | "ARCHIVED";

  submitted_at: Date | null;
  submitted_by: number | string | null;

  approved_at: Date | null;
  approved_by: number | string | null;

  rejected_at: Date | null;
  rejected_by: number | string | null;

  rejection_reason: string | null;

  on_hold_at: Date | null;
  on_hold_by: number | string | null;

  on_hold_reason: string | null;

  advertisement_amount: string | number | null;

  standard_amount: string | number | null;

  pricing_placement_id: number | string | null;

  pricing_unit:
    "DAY" | "WEEK" | "MONTH" | "IMPRESSION" | "CAMPAIGN" | "FIXED" | null;

  pricing_quantity: string | number | null;

  discount_percentage: string | number | null;
  discount_amount: string | number | null;

  advance_percentage: string | number | null;
  advance_amount: string | number | null;

  adjustment_amount: string | number | null;
  adjustment_reason: string | null;
  adjustment_by: number | string | null;
  adjustment_at: Date | null;

  currency_code: string;

  created_by: number | string | null;
  updated_by: number | string | null;

  created_at: Date;
  updated_at: Date;

  client_id_join: number | string | null;

  client_code: string | null;
  client_name: string | null;

  is_house_ad: boolean;
}

export const mapBusinessTypeRow = (
  row: AdvertisementBusinessTypeRow
): AdvertisementBusinessType => ({
  id: Number(row.id),

  code: row.code,

  displayName: row.display_name,

  description: row.description,

  displayOrder: row.display_order,

  status: row.status
});

export const mapClientRow = (
  row: AdvertisementClientRow
): AdvertisementClient => ({
  id: Number(row.id),

  clientCode: row.client_code,

  name: row.name,

  displayName: row.display_name,

  businessName: row.business_name,

  businessTypeId:
    row.business_type_id === null ? null : Number(row.business_type_id),

  businessType:
    row.business_type_id === null
      ? null
      : {
          id: Number(row.business_type_id),
          code: row.business_type_code ?? "",
          displayName: row.business_type_display_name ?? "",
          description: row.business_type_description,
          displayOrder: row.business_type_display_order ?? 0,
          status: row.business_type_status ?? "ACTIVE"
        },

  website: row.website,

  primaryAddress: row.primary_address,

  communicationAddress: row.communication_address,

  contactPerson: row.contact_person,

  contactNo: row.contact_no,

  alternateMobile: row.alternate_mobile,

  email: row.email,

  alternateEmail: row.alternate_email,

  websiteUrl: row.website_url,

  status: row.status,

  notes: row.notes,

  adCreationHold: row.ad_creation_hold,

  adCreationHoldType: row.ad_creation_hold_type,

  adCreationHoldReason: row.ad_creation_hold_reason,

  adCreationHoldRemarks: row.ad_creation_hold_remarks,

  adCreationHoldAt: row.ad_creation_hold_at,

  adCreationHoldBy:
    row.ad_creation_hold_by === null ? null : Number(row.ad_creation_hold_by),

  adCreationUnholdAt: row.ad_creation_unhold_at,

  adCreationUnholdBy:
    row.ad_creation_unhold_by === null
      ? null
      : Number(row.ad_creation_unhold_by),

  adCreationUnholdReason: row.ad_creation_unhold_reason,

  paymentAttentionRequired: row.payment_attention_required,

  createdBy: row.created_by === null ? null : Number(row.created_by),

  updatedBy: row.updated_by === null ? null : Number(row.updated_by),

  createdAt: row.created_at,

  updatedAt: row.updated_at
});

export const mapAdvertisementRow = (row: AdvertisementRow): Advertisement => {
  const clientId = row.client_id === null ? null : Number(row.client_id);

  const advertisementAmount =
    row.advertisement_amount === null ? null : Number(row.advertisement_amount);

  return {
    id: Number(row.id),

    advertiserId: clientId ?? 0,

    clientId,

    campaignId: row.campaign_id === null ? null : Number(row.campaign_id),

    name: row.name,

    internalName: row.internal_name,

    advertisementType: row.advertisement_type,

    destinationUrl: row.destination_url,

    priority: row.priority,

    status: row.status,

    startAt: row.start_at,

    endAt: row.end_at,

    isClickable: row.is_clickable,

    openInNewTab: row.open_in_new_tab,

    notes: row.notes,

    workflowStatus: row.workflow_status,

    submittedAt: row.submitted_at,

    submittedBy: row.submitted_by === null ? null : Number(row.submitted_by),

    approvedAt: row.approved_at,

    approvedBy: row.approved_by === null ? null : Number(row.approved_by),

    rejectedAt: row.rejected_at,

    rejectedBy: row.rejected_by === null ? null : Number(row.rejected_by),

    rejectionReason: row.rejection_reason,

    onHoldAt: row.on_hold_at,

    onHoldBy: row.on_hold_by === null ? null : Number(row.on_hold_by),

    onHoldReason: row.on_hold_reason,

    /*
     * Commercial amount.
     *
     * Database source:
     *
     *   advertisements.advertisement_amount
     *
     * API/domain representation:
     *
     *   advertisementAmount
     *
     * standardAmount remains completely separate and represents
     * the system-calculated pricing amount.
     */
    advertisementAmount,

    /*
     * System-calculated standard pricing amount.
     *
     * This is independent from the commercial advertisement amount.
     */
    standardAmount:
      row.standard_amount === null ? null : Number(row.standard_amount),

    pricingPlacementId:
      row.pricing_placement_id === null
        ? null
        : Number(row.pricing_placement_id),

    pricingUnit: row.pricing_unit,

    pricingQuantity:
      row.pricing_quantity === null ? null : Number(row.pricing_quantity),

    discountPercentage:
      row.discount_percentage === null ? 0 : Number(row.discount_percentage),

    discountAmount:
      row.discount_amount === null ? 0 : Number(row.discount_amount),

    advancePercentage:
      row.advance_percentage === null ? 0 : Number(row.advance_percentage),

    advanceAmount: row.advance_amount === null ? 0 : Number(row.advance_amount),

    adjustmentAmount:
      row.adjustment_amount === null ? 0 : Number(row.adjustment_amount),

    adjustmentReason: row.adjustment_reason,

    adjustmentBy: row.adjustment_by === null ? null : Number(row.adjustment_by),

    adjustmentAt: row.adjustment_at,

    currencyCode: row.currency_code,

    isHouseAd: row.is_house_ad,

    createdBy: row.created_by === null ? null : Number(row.created_by),

    updatedBy: row.updated_by === null ? null : Number(row.updated_by),

    createdAt: row.created_at,

    updatedAt: row.updated_at,

    client: null
  };
};

export const mapAdvertisementListRow = (
  row: AdvertisementRow
): AdvertisementListItem => {
  const clientId = row.client_id === null ? null : Number(row.client_id);

  const advertisementAmount =
    row.advertisement_amount === null ? null : Number(row.advertisement_amount);

  return {
    id: Number(row.id),

    advertiserId: clientId ?? 0,

    clientId,

    clientName: row.client_name,

    clientCode: row.client_code,

    name: row.name,

    advertisementType: row.advertisement_type,

    priority: row.priority,

    status: row.status,

    workflowStatus: row.workflow_status,

    startAt: row.start_at,

    endAt: row.end_at,

    advertisementAmount,

    /*
     * System-calculated standard pricing amount.
     */
    standardAmount:
      row.standard_amount === null ? null : Number(row.standard_amount),

    pricingPlacementId:
      row.pricing_placement_id === null
        ? null
        : Number(row.pricing_placement_id),

    pricingUnit: row.pricing_unit,

    pricingQuantity:
      row.pricing_quantity === null ? null : Number(row.pricing_quantity),

    discountPercentage:
      row.discount_percentage === null ? 0 : Number(row.discount_percentage),

    discountAmount:
      row.discount_amount === null ? 0 : Number(row.discount_amount),

    advancePercentage:
      row.advance_percentage === null ? 0 : Number(row.advance_percentage),

    advanceAmount: row.advance_amount === null ? 0 : Number(row.advance_amount),

    adjustmentAmount:
      row.adjustment_amount === null ? 0 : Number(row.adjustment_amount),

    currencyCode: row.currency_code,

    createdAt: row.created_at,

    updatedAt: row.updated_at
  };
};
