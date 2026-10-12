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

function normalizeOptionalText(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
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
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than zero.");
  }

  const amount = roundCurrency(data.amount);

  if (amount <= 0) {
    throw new ApiError(400, "Payment amount must be greater than zero.");
  }

  const advertisementExists = await repository.advertisementExists(
    data.advertisementId
  );

  if (!advertisementExists) {
    throw new ApiError(404, "Advertisement not found.");
  }

  const transactionReference = normalizeOptionalText(data.transactionReference);

  const notes = normalizeOptionalText(data.notes);

  const createData: CreateAdvertisementPaymentInput = {
    advertisementId: data.advertisementId,
    amount,
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

  /*
   * Serialize payment creation for the same advertisement.
   *
   * The advertisement row lock prevents concurrent requests from
   * independently consuming the same outstanding or advance balance.
   */
  return repository.withAdvertisementLock(
    data.advertisementId,
    async (executor) => {
      const summary = await repository.getSummary(
        data.advertisementId,
        executor
      );

      if (summary === null) {
        throw new ApiError(404, "Advertisement payment summary not found.");
      }

      const outstanding = summary.outstandingAmount;

      if (outstanding === null || outstanding <= 0) {
        throw new ApiError(
          400,
          "No outstanding balance remains for this advertisement."
        );
      }

      const reservations = await repository.getUnsettledPaymentAmounts(
        data.advertisementId,
        executor
      );

      const availableBalance = roundCurrency(
        Math.max(0, outstanding - reservations.total)
      );

      if (availableBalance <= 0) {
        throw new ApiError(
          400,
          "The remaining balance is already covered by payments awaiting verification."
        );
      }

      if (amount > availableBalance) {
        throw new ApiError(
          400,
          `Payment amount cannot exceed the available outstanding balance of ${availableBalance.toFixed(2)}.`
        );
      }

      const advancePending = roundCurrency(summary.advancePendingAmount);
      const unsettledAdvance = roundCurrency(reservations.advance);

      const availableAdvance = roundCurrency(
        Math.max(0, advancePending - unsettledAdvance)
      );

      /*
       * The required advance must be settled before a regular or
       * installment payment can be recorded.
       */
      if (advancePending > 0 && data.paymentType !== "ADVANCE") {
        throw new ApiError(
          400,
          `The required advance must be recorded and verified before a ${data.paymentType.toLowerCase()} payment can be recorded. Advance pending: ${advancePending.toFixed(2)}.`
        );
      }

      if (data.paymentType === "ADVANCE") {
        if (advancePending <= 0) {
          throw new ApiError(400, "No advance payment is currently required.");
        }

        if (availableAdvance <= 0) {
          throw new ApiError(
            400,
            "An advance payment is already awaiting verification. Verify or cancel it before recording another advance."
          );
        }

        if (amount > availableAdvance) {
          throw new ApiError(
            400,
            `Advance payment cannot exceed the remaining advance required of ${availableAdvance.toFixed(2)}.`
          );
        }
      }

      /*
       * Check transaction references inside the transaction and while
       * holding the advertisement lock. This avoids duplicate references
       * for concurrent payment requests on the same advertisement.
       */
      if (transactionReference !== undefined) {
        const duplicateReference = await repository.hasTransactionReference(
          transactionReference,
          undefined,
          executor
        );

        if (duplicateReference) {
          throw new ApiError(409, "Transaction reference already exists.");
        }
      }

      return repository.create(createData, recordedBy, executor);
    }
  );
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

  const updateData: UpdateAdvertisementPaymentInput = {};

  if (data.amount !== undefined) {
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new ApiError(400, "Payment amount must be greater than zero.");
    }

    const amount = roundCurrency(data.amount);

    if (amount <= 0) {
      throw new ApiError(400, "Payment amount must be greater than zero.");
    }

    updateData.amount = amount;
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

  if (data.transactionReference !== undefined) {
    const transactionReference = normalizeOptionalText(
      data.transactionReference
    );

    if (transactionReference !== undefined) {
      const duplicateReference = await repository.hasTransactionReference(
        transactionReference,
        id
      );

      if (duplicateReference) {
        throw new ApiError(
          409,
          "This transaction reference is already recorded. Check Payment History and enter the correct unique transaction reference. For cash payments without a transaction reference, leave this field blank."
        );
      }

      updateData.transactionReference = transactionReference;
    } else {
      updateData.transactionReference = "";
    }
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

  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new ApiError(400, "Refund amount must be greater than zero.");
  }

  const amount = roundCurrency(data.amount);

  if (amount <= 0) {
    throw new ApiError(400, "Refund amount must be greater than zero.");
  }

  /*
   * Calculate the refundable balance from the original payment and
   * the complete refund ledger for that payment.
   */
  const alreadyRefunded = await repository.getTotalRefundedAmount(
    data.paymentId
  );

  const refundableAmount = roundCurrency(payment.amount - alreadyRefunded);

  if (refundableAmount <= 0) {
    throw new ApiError(400, "This payment has no remaining refundable amount.");
  }

  if (amount > refundableAmount) {
    throw new ApiError(
      400,
      `Refund amount cannot exceed the remaining refundable amount of ${refundableAmount.toFixed(2)}.`
    );
  }

  const refundData: CreateAdvertisementPaymentRefundInput = {
    paymentId: data.paymentId,
    amount
  };

  if (data.refundDate !== undefined) {
    refundData.refundDate = data.refundDate;
  }

  const refundReference = normalizeOptionalText(data.refundReference);

  if (refundReference !== undefined) {
    refundData.refundReference = refundReference;
  }

  const refundReason = normalizeOptionalText(data.refundReason);

  if (refundReason !== undefined) {
    refundData.refundReason = refundReason;
  }

  const refund = await repository.createRefund(refundData, refundedBy);

  /*
   * A full refund changes the original payment status to REFUNDED.
   * Partial refunds leave the original payment VERIFIED.
   *
   * Gross payment history includes VERIFIED and REFUNDED payments.
   * Refund ledger entries are subtracted when calculating net collections.
   */
  const remainingAmount = roundCurrency(refundableAmount - amount);

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

    advanceRequiredAmount: roundCurrency(summary.advanceRequiredAmount),

    advanceReceivedAmount: roundCurrency(summary.advanceReceivedAmount),

    advancePendingAmount: roundCurrency(summary.advancePendingAmount),

    outstandingAmount:
      summary.outstandingAmount === null
        ? null
        : roundCurrency(summary.outstandingAmount)
  };
}
