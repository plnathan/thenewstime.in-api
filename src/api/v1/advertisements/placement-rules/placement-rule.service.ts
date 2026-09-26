import type {
  AdvertisementPlacementRule,
  CreatePlacementRuleInput,
  PlacementRuleQuery,
  UpdatePlacementRuleInput
} from "./placement-rule.types.js";

import * as repository from "./placement-rule.repository.js";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

const validateInsertionConfiguration = (
  insertionType:
    | CreatePlacementRuleInput["insertionType"]
    | UpdatePlacementRuleInput["insertionType"]
    | null
    | undefined,
  insertionPosition: number | null | undefined
): void => {
  const resolvedInsertionType = insertionType ?? "FIXED";

  if (
    resolvedInsertionType === "FIXED" &&
    insertionPosition !== null &&
    insertionPosition !== undefined
  ) {
    throw new ApiError(
      400,
      "insertionPosition must be null when insertionType is FIXED"
    );
  }

  if (
    (resolvedInsertionType === "AFTER_N_ITEMS" ||
      resolvedInsertionType === "BETWEEN_SECTIONS") &&
    (insertionPosition === null ||
      insertionPosition === undefined ||
      insertionPosition <= 0)
  ) {
    throw new ApiError(
      400,
      `insertionPosition is required and must be positive when insertionType is ${resolvedInsertionType}`
    );
  }
};

export const getAll = async (
  query: PlacementRuleQuery = {}
): Promise<AdvertisementPlacementRule[]> => {
  return repository.findAll(query);
};

export const getById = async (
  id: number
): Promise<AdvertisementPlacementRule> => {
  const rule = await repository.findById(id);

  if (!rule) {
    throw new ApiError(404, "Advertisement placement rule not found");
  }

  return rule;
};

export const create = async (
  input: CreatePlacementRuleInput,
  userId: number
): Promise<AdvertisementPlacementRule> => {
  const existing = await repository.findByAdvertisementAndPlacement(
    input.advertisementId,
    input.placementId
  );

  if (existing) {
    throw new ApiError(
      409,
      "An advertisement placement rule already exists for this advertisement and placement"
    );
  }

  validateInsertionConfiguration(input.insertionType, input.insertionPosition);

  try {
    const created = await repository.create(input, userId);

    return created;
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
): Promise<AdvertisementPlacementRule> => {
  const existing = await getById(id);

  const insertionType =
    input.insertionType !== undefined
      ? input.insertionType
      : existing.insertionType;

  const insertionPosition =
    input.insertionPosition !== undefined
      ? input.insertionPosition
      : existing.insertionPosition;

  validateInsertionConfiguration(insertionType, insertionPosition);

  const updated = await repository.update(id, input, userId);

  if (!updated) {
    throw new ApiError(404, "Advertisement placement rule not found");
  }

  return updated;
};

export const deactivate = async (
  id: number,
  userId: number
): Promise<AdvertisementPlacementRule> => {
  const existing = await getById(id);

  if (existing.status === "INACTIVE") {
    throw new ApiError(409, "Advertisement placement rule is already inactive");
  }

  const updated = await repository.deactivate(id, userId);

  if (!updated) {
    throw new ApiError(404, "Advertisement placement rule not found");
  }

  return updated;
};
