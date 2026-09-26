export type AdvertisementFinancialApprovalType =
  "DISCOUNT" | "ADJUSTMENT" | "REFUND" | "PARTIAL_REFUND";

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

  status: AdvertisementFinancialApprovalStatus;

  requestedBy: number;
  requestedAt: Date;

  reviewedBy: number | null;
  reviewedAt: Date | null;

  holdReason: string | null;
  rejectionReason: string | null;
  approvalRemarks: string | null;

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
}

export interface CreateAdvertisementFinancialApprovalInput {
  advertisementId: number;
  clientId: number;

  paymentId?: number | null;

  approvalType: AdvertisementFinancialApprovalType;

  requestedAmount?: number | null;
  requestedPercentage?: number | null;

  approvalRemarks?: string | null;
}

export interface HoldAdvertisementFinancialApprovalInput {
  holdReason: string;
}

export interface RejectAdvertisementFinancialApprovalInput {
  rejectionReason: string;
}

export interface ApproveAdvertisementFinancialApprovalInput {
  approvalRemarks?: string | null;
}

export interface ResubmitAdvertisementFinancialApprovalInput {
  approvalRemarks?: string | null;
}

export interface AdvertisementFinancialApprovalListFilter {
  advertisementId?: number;
  clientId?: number;
  paymentId?: number;

  approvalType?: AdvertisementFinancialApprovalType;

  status?: AdvertisementFinancialApprovalStatus;

  requestedBy?: number;
  reviewedBy?: number;

  page: number;
  pageSize: number;
}

export interface AdvertisementFinancialApprovalListResult {
  items: AdvertisementFinancialApproval[];
  total: number;
}
