import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./placement.repository.js";

import type {
  AdvertisementPlacement,
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "./placement.types.js";

const validateCreateConfiguration = (
  input: CreateAdvertisementPlacementInput
): void => {
  if (
    input.displayFrequency === "ONCE_PER_PERIOD" &&
    input.frequencyValue === undefined
  ) {
    throw new ApiError(400, "frequencyValue is required for ONCE_PER_PERIOD.");
  }

  if (input.autoCloseEnabled === true && input.autoCloseSeconds === undefined) {
    throw new ApiError(
      400,
      "autoCloseSeconds is required when autoCloseEnabled is true."
    );
  }

  if (
    input.autoCloseEnabled === false &&
    input.autoCloseSeconds !== undefined &&
    input.autoCloseSeconds !== null
  ) {
    throw new ApiError(
      400,
      "autoCloseSeconds must be null or omitted when autoCloseEnabled is false."
    );
  }
};

const validateUpdateConfiguration = (
  existing: AdvertisementPlacement,
  input: UpdateAdvertisementPlacementInput
): void => {
  if (
    input.displayFrequency === "ONCE_PER_PERIOD" &&
    input.frequencyValue === undefined &&
    existing.displayFrequency !== "ONCE_PER_PERIOD"
  ) {
    throw new ApiError(
      400,
      "frequencyValue is required when changing displayFrequency to ONCE_PER_PERIOD."
    );
  }

  if (
    input.autoCloseEnabled === true &&
    input.autoCloseSeconds === undefined &&
    existing.autoCloseSeconds === null
  ) {
    throw new ApiError(
      400,
      "autoCloseSeconds is required when enabling auto-close."
    );
  }

  if (
    input.autoCloseEnabled === false &&
    input.autoCloseSeconds !== undefined &&
    input.autoCloseSeconds !== null
  ) {
    throw new ApiError(
      400,
      "autoCloseSeconds must be null or omitted when autoCloseEnabled is false."
    );
  }
};

const validateFormat = async (
  formatId: number | null | undefined
): Promise<void> => {
  if (formatId === undefined || formatId === null) {
    return;
  }

  const format = await repository.findActiveFormatById(formatId);

  if (!format) {
    throw new ApiError(400, "Advertisement format not found or is inactive.");
  }
};

export const getAll = async (): Promise<AdvertisementPlacement[]> => {
  return repository.findAll();
};

export const getById = async (id: number): Promise<AdvertisementPlacement> => {
  const placement = await repository.findById(id);

  if (!placement) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return placement;
};

export const create = async (
  input: CreateAdvertisementPlacementInput,
  userId: number
): Promise<AdvertisementPlacement> => {
  validateCreateConfiguration(input);

  await validateFormat(input.formatId);

  const existing = await repository.findByCode(input.code.trim());

  if (existing) {
    throw new ApiError(409, "Advertisement placement code already exists.");
  }

  return repository.create(input, userId);
};

export const update = async (
  id: number,
  input: UpdateAdvertisementPlacementInput,
  userId: number
): Promise<AdvertisementPlacement> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  validateUpdateConfiguration(existing, input);

  await validateFormat(input.formatId);

  const updated = await repository.update(id, input, userId);

  if (!updated) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return updated;
};

export const deactivate = async (
  id: number,
  userId: number
): Promise<AdvertisementPlacement> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  if (existing.status === "INACTIVE") {
    throw new ApiError(400, "Advertisement placement is already inactive.");
  }

  const updated = await repository.update(
    id,
    {
      status: "INACTIVE",
      isEnabled: false
    },
    userId
  );

  if (!updated) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return updated;
};

export const enable = async (
  id: number,
  userId: number
): Promise<AdvertisementPlacement> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  if (existing.status === "ACTIVE" && existing.isEnabled) {
    throw new ApiError(400, "Advertisement placement is already enabled.");
  }

  const updated = await repository.update(
    id,
    {
      status: "ACTIVE",
      isEnabled: true
    },
    userId
  );

  if (!updated) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return updated;
};

export const disable = async (
  id: number,
  userId: number
): Promise<AdvertisementPlacement> => {
  const existing = await repository.findById(id);

  if (!existing) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  if (existing.status === "INACTIVE" && !existing.isEnabled) {
    throw new ApiError(400, "Advertisement placement is already disabled.");
  }

  const updated = await repository.update(
    id,
    {
      status: "INACTIVE",
      isEnabled: false
    },
    userId
  );

  if (!updated) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return updated;
};
