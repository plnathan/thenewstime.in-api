export type AdvertisementFinancialApprovalType =
  "DISCOUNT" | "ADJUSTMENT" | "REFUND" | "PARTIAL_REFUND" | "CREDIT_EXCEPTION";

export type AdvertisementFinancialApprovalStatus =
  "SUBMITTED" | "HOLD" | "APPROVED" | "REJECTED";

export interface AdvertisementFinancialApproval {
  id: number;
  advertisementId: number;
  clientId: number;
  paymentId: number | null;

  approvalType: AdvertisementFinancialApprovalType;

  requestedAmount: number | null;
  requestedPercentage: number | null;

  approvedAmount: number | null;
  approvedPercentage: number | null;

  status: AdvertisementFinancialApprovalStatus;

  requestedBy: number;
  requestedAt: Date;

  reviewedBy: number | null;
  reviewedAt: Date | null;

  holdReason: string | null;
  rejectionReason: string | null;
  approvalRemarks: string | null;

  /*
   * Credit Exception fields.
   *
   * Optional at the TypeScript boundary so existing repository mappings
   * remain compatible while the Credit Exception repository operations
   * are implemented in the following steps.
   */
  creditExceptionReason?: string | null;
  expectedPaymentDueDate?: string | Date | null;
  overdueAt?: Date | null;

  revokedBy?: number | null;
  revokedAt?: Date | null;
  revocationReason?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface AdvertisementFinancialApprovalHistory {
  id: number;
  approvalId: number;

  fromStatus: AdvertisementFinancialApprovalStatus | null;
  toStatus: AdvertisementFinancialApprovalStatus;

  actionBy: number;
  actionAt: Date;

  remarks: string | null;
  holdReason: string | null;
  rejectionReason: string | null;

  /*
   * Credit Exception history snapshots.
   */
  creditExceptionReason?: string | null;
  expectedPaymentDueDate?: string | Date | null;
  approvedAmount?: number | null;
  overdueAt?: Date | null;

  revokedBy?: number | null;
  revokedAt?: Date | null;
  revocationReason?: string | null;
}

export interface CreateAdvertisementFinancialApprovalInput {
  advertisementId: number;
  clientId: number;

  paymentId?: number | null;

  approvalType: AdvertisementFinancialApprovalType;

  requestedAmount?: number | null;
  requestedPercentage?: number | null;

  approvalRemarks?: string | null;

  /*
   * Required by validation when approvalType is CREDIT_EXCEPTION.
   * These remain optional here because the existing approval types
   * do not require them.
   */
  creditExceptionReason?: string | null;
  expectedPaymentDueDate?: string | null;
}

export interface UpdateAdvertisementFinancialApprovalRemarksInput {
  approvalRemarks?: string | null;
  remarks?: string | null;
}

export interface HoldAdvertisementFinancialApprovalInput {
  holdReason: string;
  remarks?: string | null;
}

export interface RejectAdvertisementFinancialApprovalInput {
  rejectionReason: string;
  remarks?: string | null;
}

export interface ApproveAdvertisementFinancialApprovalInput {
  approvedAmount?: number | null;
  approvedPercentage?: number | null;
  approvalRemarks?: string | null;
}

/**
 * Credit Exception-specific approval input.
 *
 * The approved amount is the maximum outstanding balance that may remain
 * unpaid under this exception. It is not a payment or a discount.
 */
export interface ApproveAdvertisementCreditExceptionInput {
  approvedAmount: number;
  approvalRemarks?: string | null;
}

export interface ResubmitAdvertisementFinancialApprovalInput {
  approvalRemarks?: string | null;
}

export interface AdvertisementFinancialApprovalListFilters {
  advertisementId?: number;
  clientId?: number;
  paymentId?: number;

  approvalType?: AdvertisementFinancialApprovalType;
  status?: AdvertisementFinancialApprovalStatus;

  requestedBy?: number;
  reviewedBy?: number;

  page?: number;
  pageSize?: number;
}

export interface AdvertisementFinancialApprovalListResult {
  items: AdvertisementFinancialApproval[];
  total: number;
}

/**
 * Summary of an advertisement's outstanding balance and its approved
 * Credit Exception coverage.
 *
 * The outstanding balance is sourced from the payment summary.
 * Credit Exception coverage must never be counted as money received.
 */
export interface AdvertisementCreditExceptionSummary {
  advertisementId: number;
  outstandingAmount: number;
  approvedExceptionAmount: number;
  uncoveredOutstandingAmount: number;
  hasApprovedCreditException: boolean;
  isOverdue: boolean;
  expectedPaymentDueDate: string | null;
}

/**
 * Result of checking whether the outstanding balance is fully covered
 * by approved Credit Exceptions.
 */
export interface AdvertisementCreditExceptionCoverage {
  advertisementId: number;
  outstandingAmount: number;
  coveredAmount: number;
  uncoveredAmount: number;
  isFullyCovered: boolean;
}
