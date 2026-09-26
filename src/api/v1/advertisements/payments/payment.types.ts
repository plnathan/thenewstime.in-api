export type AdvertisementPaymentType =
  "ADVANCE" | "REGULAR" | "FINAL" | "INSTALLMENT";

export type AdvertisementPaymentStatus =
  "PENDING" | "RECEIVED" | "VERIFIED" | "CANCELLED" | "REFUNDED";

export type AdvertisementPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "UPI"
  | "CARD"
  | "CHEQUE"
  | "DEMAND_DRAFT"
  | "OTHER";

export interface AdvertisementPayment {
  id: number;

  advertisementId: number;

  amount: number;

  paymentType: AdvertisementPaymentType;

  paymentDate: Date;

  paymentMethod: AdvertisementPaymentMethod | null;

  paymentStatus: AdvertisementPaymentStatus;

  transactionReference: string | null;

  notes: string | null;

  recordedBy: number | null;

  recordedAt: Date;

  verifiedBy: number | null;

  verifiedAt: Date | null;

  cancelledBy: number | null;

  cancelledAt: Date | null;

  cancellationReason: string | null;

  refundedBy: number | null;

  refundedAt: Date | null;

  refundReference: string | null;

  refundReason: string | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface AdvertisementPaymentRefund {
  id: number;

  paymentId: number;

  amount: number;

  refundDate: Date;

  refundReference: string | null;

  refundReason: string | null;

  refundedBy: number | null;

  createdAt: Date;

  updatedAt: Date;
}

export interface CreateAdvertisementPaymentInput {
  advertisementId: number;

  amount: number;

  paymentType: AdvertisementPaymentType;

  paymentDate?: Date | undefined;

  paymentMethod?: AdvertisementPaymentMethod | undefined;

  transactionReference?: string | undefined;

  notes?: string | undefined;
}

export interface UpdateAdvertisementPaymentInput {
  amount?: number | undefined;

  paymentType?: AdvertisementPaymentType | undefined;

  paymentDate?: Date | undefined;

  paymentMethod?: AdvertisementPaymentMethod | undefined;

  transactionReference?: string | undefined;

  notes?: string | undefined;
}

export interface CreateAdvertisementPaymentRefundInput {
  paymentId: number;

  amount: number;

  refundDate?: Date | undefined;

  refundReference?: string | undefined;

  refundReason?: string | undefined;
}

export interface AdvertisementPaymentFilters {
  advertisementId?: number | undefined;

  paymentType?: AdvertisementPaymentType | undefined;

  paymentStatus?: AdvertisementPaymentStatus | undefined;

  paymentMethod?: AdvertisementPaymentMethod | undefined;

  fromDate?: Date | undefined;

  toDate?: Date | undefined;

  search?: string | undefined;
}

export interface AdvertisementPaymentListItem extends AdvertisementPayment {
  advertisementName: string;

  clientId: number | null;

  clientName: string | null;

  clientCode: string | null;

  totalRefundedAmount: number;

  netPaidAmount: number;
}

export interface AdvertisementPaymentSummary {
  advertisementId: number;

  advertisementAmount: number | null;

  discountAmount: number;

  adjustmentAmount: number;

  verifiedPaymentAmount: number;

  refundedAmount: number;

  netPaidAmount: number;

  outstandingAmount: number | null;
}

export interface AdvertisementPaymentPagination {
  page: number;

  pageSize: number;

  total: number;

  totalPages: number;
}

export interface AdvertisementPaymentListResponse {
  items: AdvertisementPaymentListItem[];

  pagination: AdvertisementPaymentPagination;
}