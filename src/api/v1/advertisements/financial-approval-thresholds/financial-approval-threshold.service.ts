import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./financial-approval-threshold.repository.js";

import type {
  CreateFinancialApprovalThresholdInput,
  FinancialApprovalThreshold,
  FinancialApprovalThresholdApprovalType,
  FinancialApprovalThresholdListFilters,
  FinancialApprovalThresholdStatus,
  UpdateFinancialApprovalThresholdInput
} from "./financial-approval-threshold.types.js";

const VALID_APPROVAL_TYPES: readonly FinancialApprovalThresholdApprovalType[] =
  ["DISCOUNT", "REFUND", "PARTIAL_REFUND", "ADJUSTMENT", "CREDIT_EXCEPTION"];

const VALID_STATUSES: readonly FinancialApprovalThresholdStatus[] = [
  "ACTIVE",
  "INACTIVE"
];

const assertValidApprovalType: (
  approvalType: string
) => asserts approvalType is FinancialApprovalThresholdApprovalType = (
  approvalType
) => {
  if (
    !VALID_APPROVAL_TYPES.includes(
      approvalType as FinancialApprovalThresholdApprovalType
    )
  ) {
    throw new ApiError(
      400,
      "Invalid financial approval threshold approval type."
    );
  }
};

const assertValidStatus: (
  status: string
) => asserts status is FinancialApprovalThresholdStatus = (status) => {
  if (!VALID_STATUSES.includes(status as FinancialApprovalThresholdStatus)) {
    throw new ApiError(400, "Invalid financial approval threshold status.");
  }
};

const validateThresholdValues = (
  approvalType: FinancialApprovalThresholdApprovalType,
  amountThreshold: number | null | undefined,
  percentageThreshold: number | null | undefined
): void => {
  const hasAmount = amountThreshold !== null && amountThreshold !== undefined;

  const hasPercentage =
    percentageThreshold !== null && percentageThreshold !== undefined;

  if (approvalType === "CREDIT_EXCEPTION") {
    if (!hasAmount) {
      throw new ApiError(
        400,
        "A Credit Exception threshold must have an amount threshold."
      );
    }

    if (hasPercentage) {
      throw new ApiError(
        400,
        "Credit Exception thresholds must use an amount, not a percentage."
      );
    }
  }

  if (!hasAmount && !hasPercentage) {
    throw new ApiError(400, "At least one threshold value is required.");
  }

  if (hasAmount) {
    if (
      typeof amountThreshold !== "number" ||
      !Number.isFinite(amountThreshold) ||
      amountThreshold <= 0
    ) {
      throw new ApiError(400, "Amount threshold must be greater than zero.");
    }

    if (
      Math.abs(amountThreshold * 100 - Math.round(amountThreshold * 100)) >=
      1e-9
    ) {
      throw new ApiError(
        400,
        "Amount threshold cannot have more than 2 decimal places."
      );
    }
  }

  if (hasPercentage) {
    if (
      typeof percentageThreshold !== "number" ||
      !Number.isFinite(percentageThreshold) ||
      percentageThreshold < 0 ||
      percentageThreshold > 100
    ) {
      throw new ApiError(
        400,
        "Percentage threshold must be between 0 and 100."
      );
    }

    if (
      Math.abs(
        percentageThreshold * 100 - Math.round(percentageThreshold * 100)
      ) >= 1e-9
    ) {
      throw new ApiError(
        400,
        "Percentage threshold cannot have more than 2 decimal places."
      );
    }
  }

  if (hasAmount && hasPercentage) {
    throw new ApiError(
      400,
      "Configure either amount threshold or percentage threshold, not both."
    );
  }
};

export const list = async (
  filters: FinancialApprovalThresholdListFilters = {}
): Promise<FinancialApprovalThreshold[]> => {
  if (filters.approvalType !== undefined) {
    assertValidApprovalType(filters.approvalType);
  }

  if (filters.status !== undefined) {
    assertValidStatus(filters.status);
  }

  return repository.findAll(filters);
};

export const getById = async (
  id: number
): Promise<FinancialApprovalThreshold> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer.");
  }

  const threshold = await repository.findById(id);

  if (!threshold) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  return threshold;
};

export const getActiveThreshold = async (
  approvalType: FinancialApprovalThresholdApprovalType
): Promise<FinancialApprovalThreshold | null> => {
  assertValidApprovalType(approvalType);

  return repository.findActiveByApprovalType(approvalType);
};

export const create = async (
  input: CreateFinancialApprovalThresholdInput,
  createdBy: number
): Promise<FinancialApprovalThreshold> => {
  if (!Number.isInteger(createdBy) || createdBy <= 0) {
    throw new ApiError(400, "createdBy must be a positive integer.");
  }

  assertValidApprovalType(input.approvalType);

  validateThresholdValues(
    input.approvalType,
    input.amountThreshold,
    input.percentageThreshold
  );

  const existingActiveCount = await repository.countActiveByApprovalType(
    input.approvalType
  );

  if (existingActiveCount > 0) {
    throw new ApiError(
      409,
      `An active threshold already exists for ${input.approvalType}. Deactivate the existing threshold before creating a new active configuration.`
    );
  }

  return repository.create(input, createdBy);
};

export const update = async (
  id: number,
  input: UpdateFinancialApprovalThresholdInput,
  updatedBy: number
): Promise<FinancialApprovalThreshold> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer.");
  }

  if (!Number.isInteger(updatedBy) || updatedBy <= 0) {
    throw new ApiError(400, "updatedBy must be a positive integer.");
  }

  const current = await repository.findById(id);

  if (!current) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  const approvalType = input.approvalType ?? current.approvalType;

  const amountThreshold =
    input.amountThreshold !== undefined
      ? input.amountThreshold
      : current.amountThreshold;

  const percentageThreshold =
    input.percentageThreshold !== undefined
      ? input.percentageThreshold
      : current.percentageThreshold;

  assertValidApprovalType(approvalType);

  validateThresholdValues(approvalType, amountThreshold, percentageThreshold);

  /*
   * An active threshold cannot be changed to an approval type
   * that already has another active configuration.
   */
  if (current.status === "ACTIVE") {
    const activeCount = await repository.countActiveByApprovalType(
      approvalType,
      id
    );

    if (activeCount > 0) {
      throw new ApiError(
        409,
        `Another active threshold already exists for ${approvalType}.`
      );
    }
  }

  const updated = await repository.update(
    id,
    {
      ...input,
      approvalType,
      amountThreshold,
      percentageThreshold
    },
    updatedBy
  );

  if (!updated) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  return updated;
};

export const activate = async (
  id: number,
  updatedBy: number
): Promise<FinancialApprovalThreshold> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer.");
  }

  if (!Number.isInteger(updatedBy) || updatedBy <= 0) {
    throw new ApiError(400, "updatedBy must be a positive integer.");
  }

  const current = await repository.findById(id);

  if (!current) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  if (current.status === "ACTIVE") {
    throw new ApiError(409, "Financial approval threshold is already active.");
  }

  /*
   * Validate persisted values before activation as a defensive check.
   * This also protects against legacy or manually inserted records.
   */
  validateThresholdValues(
    current.approvalType,
    current.amountThreshold,
    current.percentageThreshold
  );

  const existingActive = await repository.findActiveByApprovalType(
    current.approvalType
  );

  if (existingActive && existingActive.id !== id) {
    throw new ApiError(
      409,
      `An active threshold already exists for ${current.approvalType}. Deactivate it before activating this configuration.`
    );
  }

  const activated = await repository.activate(id, updatedBy);

  if (!activated) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  return activated;
};

export const deactivate = async (
  id: number,
  updatedBy: number
): Promise<FinancialApprovalThreshold> => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "id must be a positive integer.");
  }

  if (!Number.isInteger(updatedBy) || updatedBy <= 0) {
    throw new ApiError(400, "updatedBy must be a positive integer.");
  }

  const current = await repository.findById(id);

  if (!current) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  if (current.status === "INACTIVE") {
    throw new ApiError(
      409,
      "Financial approval threshold is already inactive."
    );
  }

  const deactivated = await repository.deactivate(id, updatedBy);

  if (!deactivated) {
    throw new ApiError(404, "Financial approval threshold not found.");
  }

  return deactivated;
};
