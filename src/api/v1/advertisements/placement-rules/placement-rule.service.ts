import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import * as repository from "./placement-rule.repository.js";
import type {
  AdvertisementPlacementRule,
  CreatePlacementRuleInput,
  PlacementRuleInsertionType,
  PlacementRuleQuery,
  UpdatePlacementRuleInput
} from "./placement-rule.types.js";

const validateInsertionConfiguration = (
  insertionType: PlacementRuleInsertionType | null | undefined,
  insertionPosition: number | null | undefined
): void => {
  const resolvedInsertionType = insertionType ?? "FIXED";

  if (resolvedInsertionType === "FIXED") {
    if (
      insertionPosition !== null &&
      insertionPosition !== undefined
    ) {
      throw new ApiError(
        400,
        "insertionPosition must be null when insertionType is FIXED"
      );
    }

    return;
  }

  if (
    resolvedInsertionType === "AFTER_N_ITEMS" ||
    resolvedInsertionType === "BETWEEN_SECTIONS"
  ) {
    if (
      insertionPosition === null ||
      insertionPosition === undefined ||
      insertionPosition <= 0
    ) {
      throw new ApiError(
        400,
        `insertionPosition is required and must be positive when insertionType is ${resolvedInsertionType}`
      );
    }
  }
};

const normalizeCreateInput = (
  input: CreatePlacementRuleInput
): CreatePlacementRuleInput => {
  if (input.insertionType === undefined || input.insertionType === null) {
    return {
      ...input,
      insertionType: "FIXED"
    };
  }

  return input;
};

export const getAll = async (
  query: PlacementRuleQuery = {}
) => repository.findAll(query);

export const getById = async (id: number) => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(
      400,
      "Invalid advertisement placement rule id"
    );
  }

  const rule = await repository.findById(id);

  if (!rule) {
    throw new ApiError(
      404,
      "Advertisement placement rule not found"
    );
  }

  return rule;
};

export const create = async (
  input: CreatePlacementRuleInput,
  userId: number
) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(
      401,
      "Authenticated user is required"
    );
  }

  /*
   * Validate the caller's actual input before applying defaults.
   *
   * This is important because:
   *
   *   { insertionType: "FIXED", insertionPosition: 2 }
   *
   * must be rejected rather than silently converting insertionPosition
   * to null before validation.
   */
  validateInsertionConfiguration(
    input.insertionType,
    input.insertionPosition
  );

  const normalizedInput = normalizeCreateInput(input);

  const existing =
    await repository.findByAdvertisementAndPlacement(
      normalizedInput.advertisementId,
      normalizedInput.placementId
    );

  if (existing) {
    throw new ApiError(
      409,
      "An advertisement placement rule already exists for this advertisement and placement"
    );
  }

  try {
    return await repository.create(
      normalizedInput,
      userId
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ApiError(
        409,
        "An advertisement placement rule already exists for this advertisement and placement"
      );
    }

    throw error;
  }
};

export const update = async (
  id: number,
  input: UpdatePlacementRuleInput,
  userId: number
) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(
      401,
      "Authenticated user is required"
    );
  }

  const existing = await getById(id);

  /*
   * Resolve values only for validation.
   *
   * We deliberately do NOT write these resolved values back into
   * the repository input. PATCH semantics require that fields not
   * supplied by the caller remain untouched.
   */
  const resolvedInsertionType =
    input.insertionType !== undefined
      ? input.insertionType ?? "FIXED"
      : existing.insertionType ?? "FIXED";

  const resolvedInsertionPosition =
    input.insertionPosition !== undefined
      ? input.insertionPosition
      : existing.insertionPosition;

  /*
   * Validate the effective configuration before repository update.
   *
   * This catches:
   *
   *   { insertionType: "FIXED", insertionPosition: 2 }
   *
   * while still allowing:
   *
   *   { displayOrder: 5 }
   *
   * to remain exactly { displayOrder: 5 }.
   */
  validateInsertionConfiguration(
    resolvedInsertionType,
    resolvedInsertionPosition
  );

  /*
   * Preserve the caller's partial update exactly.
   *
   * Do not add insertionType/insertionPosition merely because
   * they were needed for validation.
   */
  const updated = await repository.update(
    id,
    input,
    userId
  );

  if (!updated) {
    throw new ApiError(
      404,
      "Advertisement placement rule not found"
    );
  }

  return updated;
};

export const deactivate = async (
  id: number,
  userId: number
) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new ApiError(
      401,
      "Authenticated user is required"
    );
  }

  const existing = await getById(id);

  if (existing.status === "INACTIVE") {
    throw new ApiError(
      409,
      "Advertisement placement rule is already inactive"
    );
  }

  const updated = await repository.deactivate(
    id,
    userId
  );

  if (!updated) {
    throw new ApiError(
      404,
      "Advertisement placement rule not found"
    );
  }

  return updated;
};