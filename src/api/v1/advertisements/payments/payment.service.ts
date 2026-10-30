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
  if (
    !Number.isSafeInteger(data.financialApprovalId) ||
    data.financialApprovalId <= 0
  ) {
    throw new ApiError(400, "An approved financialApprovalId is required.");
  }
  const payment = await repository.findById(data.paymentId);
  if (!payment) throw new ApiError(404, "Advertisement payment not found.");

  return repository.withAdvertisementLock(
    payment.advertisementId,
    async (client) => {
      const currentPayment = await repository.findById(data.paymentId, client);
      if (!currentPayment || currentPayment.paymentStatus !== "VERIFIED") {
        throw new ApiError(400, "Only verified payments can be refunded.");
      }
      const approval = await repository.getRefundApprovalForExecution(
        data.financialApprovalId,
        client
      );
      if (
        !approval ||
        approval.paymentId !== data.paymentId ||
        approval.advertisementId !== currentPayment.advertisementId ||
        !["REFUND", "PARTIAL_REFUND"].includes(approval.approvalType)
      ) {
        throw new ApiError(
          400,
          "Refund approval is not linked to this payment."
        );
      }
      if (approval.status !== "APPROVED" || approval.alreadyExecuted) {
        throw new ApiError(
          409,
          "Refund approval is not approved or has already been executed."
        );
      }
      const amount = roundCurrency(
        approval.approvedAmount ?? approval.requestedAmount
      );
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        (data.amount !== undefined &&
          (!Number.isFinite(data.amount) ||
            roundCurrency(data.amount) !== amount))
      ) {
        throw new ApiError(
          400,
          "Refund amount must match the approved amount."
        );
      }
      const refunded = await repository.getTotalRefundedAmount(
        data.paymentId,
        client
      );
      const available = roundCurrency(currentPayment.amount - refunded);
      if (amount > available) {
        throw new ApiError(
          409,
          "Approved refund exceeds the remaining refundable balance."
        );
      }
      const refundReference = normalizeOptionalText(data.refundReference);
      const refundReason = normalizeOptionalText(data.refundReason);
      const refund = await repository.createRefund(
        {
          paymentId: data.paymentId,
          financialApprovalId: approval.id,
          amount,
          ...(data.refundDate !== undefined
            ? { refundDate: data.refundDate }
            : {}),
          ...(refundReference !== undefined ? { refundReference } : {}),
          ...(refundReason !== undefined ? { refundReason } : {})
        },
        refundedBy,
        client
      );
      if (roundCurrency(available - amount) === 0) {
        await repository.markRefunded(
          data.paymentId,
          refundedBy,
          refundReference ?? null,
          refundReason ?? null,
          client
        );
      }
      return refund;
    }
  );
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

/** Matches an existing executed refund to an already-applied, approved discount.
 * Matching is accounting metadata: it NEVER deducts the discount or refund twice.
 */
export async function matchRefundToDiscount(
  refundId: number,
  discountApprovalId: number,
  matchedBy: number
): Promise<{
  id: number;
  advertisementId: number;
  refundId: number;
  discountApprovalId: number;
  matchedAmount: number;
}> {
  if (
    ![refundId, discountApprovalId, matchedBy].every(
      (id) => Number.isSafeInteger(id) && id > 0
    )
  ) {
    throw new ApiError(
      400,
      "Valid refund, discount approval and user IDs are required."
    );
  }
  const lookup = await repository.findRefundAdvertisementId(refundId);
  if (lookup === null) throw new ApiError(404, "Executed refund not found.");
  return repository.withAdvertisementLock(lookup, async (client) => {
    const record = await repository.findRefundMatchingCandidate(
      refundId,
      discountApprovalId,
      client
    );
    if (!record)
      throw new ApiError(404, "Refund or discount approval not found.");
    if (
      record.refundAdvertisementId !== record.approvalAdvertisementId ||
      record.refundAdvertisementId !== lookup
    ) {
      throw new ApiError(
        400,
        "Refund and discount approval must belong to the same advertisement."
      );
    }
    if (
      record.approvalType !== "DISCOUNT" ||
      record.approvalStatus !== "APPROVED" ||
      record.revokedAt !== null
    ) {
      throw new ApiError(
        409,
        "A current, approved DISCOUNT financial approval is required."
      );
    }
    const amount = roundCurrency(record.refundAmount);
    const approved =
      record.approvedAmount === null
        ? null
        : roundCurrency(record.approvedAmount);
    if (approved === null || approved + 0.009 < amount) {
      throw new ApiError(
        409,
        "The approved discount amount must cover the refund."
      );
    }
    if (record.persistedDiscountAmount + 0.009 < amount) {
      throw new ApiError(
        409,
        "Apply the approved commercial discount before matching the refund."
      );
    }
    if (record.alreadyMatchedRefund || record.alreadyMatchedApproval) {
      throw new ApiError(
        409,
        "This refund or discount approval has already been matched."
      );
    }
    return repository.insertRefundCommercialMatch(
      lookup,
      refundId,
      discountApprovalId,
      amount,
      matchedBy,
      client
    );
  });
}

export async function listRefundCommercialMatches(advertisementId: number) {
  if (!Number.isSafeInteger(advertisementId) || advertisementId <= 0) {
    throw new ApiError(400, "A valid advertisement ID is required.");
  }
  return repository.listRefundCommercialMatches(advertisementId);
}
