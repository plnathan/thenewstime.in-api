import type {
  AdvertisementPaymentMethod,
  AdvertisementPaymentStatus,
  AdvertisementPaymentType
} from "./payment.types.js";

export interface AdvertisementPaymentRow {
  id: number;

  advertisement_id: number;

  amount: string;

  payment_type: AdvertisementPaymentType;

  payment_date: Date;

  payment_method: AdvertisementPaymentMethod | null;

  payment_status: AdvertisementPaymentStatus;

  transaction_reference: string | null;

  notes: string | null;

  recorded_by: number | null;

  recorded_at: Date;

  verified_by: number | null;

  verified_at: Date | null;

  cancelled_by: number | null;

  cancelled_at: Date | null;

  cancellation_reason: string | null;

  refunded_by: number | null;

  refunded_at: Date | null;

  refund_reference: string | null;

  refund_reason: string | null;

  created_at: Date;

  updated_at: Date;
}

export interface AdvertisementPaymentListRow extends AdvertisementPaymentRow {
  advertisement_name: string;

  client_id: number | null;

  client_name: string | null;

  client_code: string | null;

  total_refunded_amount: string;

  net_paid_amount: string;
}

export interface AdvertisementPaymentRefundRow {
  id: number;

  payment_id: number;

  amount: string;

  refund_date: Date;

  refund_reference: string | null;

  refund_reason: string | null;

  refunded_by: number | null;

  created_at: Date;

  updated_at: Date;
}

export interface AdvertisementPaymentSummaryRow {
  advertisement_id: number;

  advertisement_amount: string | null;

  discount_amount: string;

  adjustment_amount: string;

  verified_payment_amount: string;

  refunded_amount: string;

  net_paid_amount: string;

  advance_required_amount: string;

  advance_received_amount: string;

  advance_pending_amount: string;
}
