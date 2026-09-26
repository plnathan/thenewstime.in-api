import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./payment.repository.js";

import type {
  AdvertisementPayment,
  AdvertisementPaymentFilters,
  AdvertisementPaymentListResponse,
  AdvertisementPaymentRefund,
  AdvertisementPaymentSummary,
  CreateAdvertisementPaymentInput,
  CreateAdvertisementPaymentRefundInput,
  UpdateAdvertisementPaymentInput
} from "./payment.types.js";

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getPaymentById(
  id: number
): Promise<AdvertisementPayment> {
  const payment = await repository.findById(id);

  if (payment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  return payment;
}

export async function createPayment(
  data: CreateAdvertisementPaymentInput,
  recordedBy: number
): Promise<AdvertisementPayment> {
  const advertisementExists = await repository.advertisementExists(
    data.advertisementId
  );

  if (!advertisementExists) {
    throw new ApiError(404, "Advertisement not found.");
  }

  const transactionReference = data.transactionReference?.trim() || undefined;

  if (transactionReference !== undefined) {
    const duplicateReference =
      await repository.hasTransactionReference(transactionReference);

    if (duplicateReference) {
      throw new ApiError(409, "Transaction reference already exists.");
    }
  }

  const notes = data.notes?.trim() || undefined;

  const createData: CreateAdvertisementPaymentInput = {
    advertisementId: data.advertisementId,
    amount: data.amount,
    paymentType: data.paymentType
  };

  if (data.paymentDate !== undefined) {
    createData.paymentDate = data.paymentDate;
  }

  if (data.paymentMethod !== undefined) {
    createData.paymentMethod = data.paymentMethod;
  }

  if (transactionReference !== undefined) {
    createData.transactionReference = transactionReference;
  }

  if (notes !== undefined) {
    createData.notes = notes;
  }

  return repository.create(createData, recordedBy);
}

export async function updatePayment(
  id: number,
  data: UpdateAdvertisementPaymentInput
): Promise<AdvertisementPayment> {
  const existingPayment = await repository.findById(id);

  if (existingPayment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  if (existingPayment.paymentStatus !== "PENDING") {
    throw new ApiError(
      400,
      "Only pending advertisement payments can be edited."
    );
  }

  const transactionReference =
    data.transactionReference === undefined
      ? undefined
      : data.transactionReference.trim();

  if (transactionReference !== undefined && transactionReference.length > 0) {
    const duplicateReference = await repository.hasTransactionReference(
      transactionReference,
      id
    );

    if (duplicateReference) {
      throw new ApiError(409, "Transaction reference already exists.");
    }
  }

  const updateData: UpdateAdvertisementPaymentInput = {};

  if (data.amount !== undefined) {
    updateData.amount = data.amount;
  }

  if (data.paymentType !== undefined) {
    updateData.paymentType = data.paymentType;
  }

  if (data.paymentDate !== undefined) {
    updateData.paymentDate = data.paymentDate;
  }

  if (data.paymentMethod !== undefined) {
    updateData.paymentMethod = data.paymentMethod;
  }

  if (transactionReference !== undefined) {
    updateData.transactionReference = transactionReference;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes.trim();
  }

  const updatedPayment = await repository.update(id, updateData);

  if (updatedPayment === null) {
    throw new ApiError(404, "Advertisement payment could not be updated.");
  }

  return updatedPayment;
}

export async function listPayments(
  filters: AdvertisementPaymentFilters,
  page: number,
  pageSize: number
): Promise<AdvertisementPaymentListResponse> {
  const result = await repository.getList(filters, page, pageSize);

  return {
    items: result.items,

    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / pageSize)
    }
  };
}

export async function verifyPayment(
  id: number,
  verifiedBy: number
): Promise<AdvertisementPayment> {
  const existingPayment = await repository.findById(id);

  if (existingPayment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  if (existingPayment.paymentStatus === "VERIFIED") {
    throw new ApiError(400, "Advertisement payment is already verified.");
  }

  if (
    existingPayment.paymentStatus === "CANCELLED" ||
    existingPayment.paymentStatus === "REFUNDED"
  ) {
    throw new ApiError(
      400,
      "Cancelled or refunded payments cannot be verified."
    );
  }

  const verifiedPayment = await repository.verify(id, verifiedBy);

  if (verifiedPayment === null) {
    throw new ApiError(
      400,
      "Advertisement payment cannot be verified in its current status."
    );
  }

  return verifiedPayment;
}

export async function cancelPayment(
  id: number,
  cancelledBy: number,
  cancellationReason: string
): Promise<AdvertisementPayment> {
  const existingPayment = await repository.findById(id);

  if (existingPayment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  if (existingPayment.paymentStatus === "CANCELLED") {
    throw new ApiError(400, "Advertisement payment is already cancelled.");
  }

  if (existingPayment.paymentStatus === "VERIFIED") {
    throw new ApiError(
      400,
      "A verified payment cannot be cancelled. Use the refund workflow instead."
    );
  }

  if (existingPayment.paymentStatus === "REFUNDED") {
    throw new ApiError(400, "A refunded payment cannot be cancelled.");
  }

  const reason = cancellationReason.trim();

  if (reason.length === 0) {
    throw new ApiError(400, "Cancellation reason is required.");
  }

  const cancelledPayment = await repository.cancel(id, cancelledBy, reason);

  if (cancelledPayment === null) {
    throw new ApiError(
      400,
      "Advertisement payment cannot be cancelled in its current status."
    );
  }

  return cancelledPayment;
}

export async function getPaymentRefunds(
  paymentId: number
): Promise<AdvertisementPaymentRefund[]> {
  const payment = await repository.findById(paymentId);

  if (payment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  return repository.findRefundsByPaymentId(paymentId);
}

export async function createPaymentRefund(
  data: CreateAdvertisementPaymentRefundInput,
  refundedBy: number
): Promise<AdvertisementPaymentRefund> {
  const payment = await repository.findById(data.paymentId);

  if (payment === null) {
    throw new ApiError(404, "Advertisement payment not found.");
  }

  if (payment.paymentStatus !== "VERIFIED") {
    throw new ApiError(400, "Only verified payments can be refunded.");
  }

  /*
   * Calculate the remaining refundable amount from the
   * original payment amount and all existing refund entries.
   *
   * IMPORTANT:
   * Use getTotalRefundedAmount() because this is the
   * repository method responsible for summing the refund
   * ledger for a payment.
   */
  const alreadyRefunded = await repository.getTotalRefundedAmount(
    data.paymentId
  );

  const refundableAmount = roundCurrency(payment.amount - alreadyRefunded);

  if (refundableAmount <= 0) {
    throw new ApiError(400, "This payment has no remaining refundable amount.");
  }

  if (data.amount <= 0) {
    throw new ApiError(400, "Refund amount must be greater than zero.");
  }

  if (data.amount > refundableAmount) {
    throw new ApiError(
      400,
      `Refund amount cannot exceed the remaining refundable amount of ${refundableAmount.toFixed(
        2
      )}.`
    );
  }

  const refundData: CreateAdvertisementPaymentRefundInput = {
    paymentId: data.paymentId,
    amount: data.amount
  };

  if (data.refundDate !== undefined) {
    refundData.refundDate = data.refundDate;
  }

  const refundReference = data.refundReference?.trim() || undefined;

  if (refundReference !== undefined) {
    refundData.refundReference = refundReference;
  }

  const refundReason = data.refundReason?.trim() || undefined;

  if (refundReason !== undefined) {
    refundData.refundReason = refundReason;
  }

  const refund = await repository.createRefund(refundData, refundedBy);

  /*
   * A full refund changes the payment ledger status
   * to REFUNDED.
   *
   * A partial refund deliberately leaves the original
   * payment as VERIFIED because a refundable balance
   * remains.
   */
  const remainingAmount = roundCurrency(refundableAmount - data.amount);

  if (remainingAmount === 0) {
    await repository.markRefunded(
      data.paymentId,
      refundedBy,
      refundReference ?? null,
      refundReason ?? null
    );
  }

  return refund;
}

export async function getPaymentSummary(
  advertisementId: number
): Promise<AdvertisementPaymentSummary> {
  const advertisementExists =
    await repository.advertisementExists(advertisementId);

  if (!advertisementExists) {
    throw new ApiError(404, "Advertisement not found.");
  }

  const summary = await repository.getSummary(advertisementId);

  if (summary === null) {
    throw new ApiError(404, "Advertisement payment summary not found.");
  }

  return {
    ...summary,

    advertisementAmount:
      summary.advertisementAmount === null
        ? null
        : roundCurrency(summary.advertisementAmount),

    discountAmount: roundCurrency(summary.discountAmount),

    adjustmentAmount: roundCurrency(summary.adjustmentAmount),

    verifiedPaymentAmount: roundCurrency(summary.verifiedPaymentAmount),

    refundedAmount: roundCurrency(summary.refundedAmount),

    netPaidAmount: roundCurrency(summary.netPaidAmount),

    outstandingAmount:
      summary.outstandingAmount === null
        ? null
        : roundCurrency(summary.outstandingAmount)
  };
}