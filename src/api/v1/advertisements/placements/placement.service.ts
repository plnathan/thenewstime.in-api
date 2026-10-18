import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./placement.repository.js";

import type {
  AdvertisementPlacement,
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "./placement.types.js";

const placementTypesByPage = {
  HOME: ["HOME_BANNER", "HOME_TOP", "HOME_BETWEEN_SECTIONS", "HOME_SIDEBAR"],
  NEWS_LIST: [
    "NEWS_LIST_TOP",
    "NEWS_LIST_BETWEEN",
    "NEWS_LIST_BOTTOM",
    "NEWS_LIST_SIDEBAR",
    "NEWS_LIST_MODAL"
  ],
  NEWS_DETAIL: [
    "NEWS_DETAIL_TOP",
    "NEWS_DETAIL_BETWEEN",
    "NEWS_DETAIL_SIDEBAR",
    "NEWS_DETAIL_BOTTOM",
    "NEWS_DETAIL_MODAL"
  ]
} as const;

const validatePagePlacementPair = (
  pageType: AdvertisementPlacement["pageType"],
  placementType: AdvertisementPlacement["placementType"]
): void => {
  if (
    !(placementTypesByPage[pageType] as readonly string[]).includes(
      placementType
    )
  ) {
    throw new ApiError(
      400,
      `Placement type ${placementType} is not valid for page type ${pageType}.`
    );
  }
};

const validateConfiguration = (
  displayFrequency: AdvertisementPlacement["displayFrequency"],
  frequencyValue: number | null | undefined,
  autoCloseEnabled: boolean,
  autoCloseSeconds: number | null | undefined
): void => {
  if (
    displayFrequency === "ONCE_PER_PERIOD" &&
    (!Number.isInteger(frequencyValue) ||
      frequencyValue === null ||
      frequencyValue === undefined ||
      frequencyValue <= 0)
  ) {
    throw new ApiError(
      400,
      "frequencyValue must be a positive integer for ONCE_PER_PERIOD."
    );
  }

  if (
    autoCloseEnabled &&
    (!Number.isInteger(autoCloseSeconds) ||
      autoCloseSeconds === null ||
      autoCloseSeconds === undefined ||
      autoCloseSeconds <= 0)
  ) {
    throw new ApiError(
      400,
      "autoCloseSeconds must be a positive integer when auto-close is enabled."
    );
  }

  if (
    !autoCloseEnabled &&
    autoCloseSeconds !== null &&
    autoCloseSeconds !== undefined
  ) {
    throw new ApiError(
      400,
      "autoCloseSeconds must be null or omitted when autoCloseEnabled is false."
    );
  }
};

const validateCreateConfiguration = (
  input: CreateAdvertisementPlacementInput
): void => {
  validateConfiguration(
    input.displayFrequency ?? null,
    input.frequencyValue,
    input.autoCloseEnabled ?? false,
    input.autoCloseSeconds
  );
  validatePagePlacementPair(input.pageType, input.placementType);
};

const validateUpdateConfiguration = (
  existing: AdvertisementPlacement,
  input: UpdateAdvertisementPlacementInput
): void => {
  const displayFrequency =
    input.displayFrequency !== undefined
      ? input.displayFrequency
      : existing.displayFrequency;
  const frequencyValue =
    input.frequencyValue !== undefined
      ? input.frequencyValue
      : existing.frequencyValue;
  const autoCloseEnabled = input.autoCloseEnabled ?? existing.autoCloseEnabled;
  const autoCloseSeconds =
    input.autoCloseEnabled === false && input.autoCloseSeconds === undefined
      ? null
      : input.autoCloseSeconds !== undefined
        ? input.autoCloseSeconds
        : existing.autoCloseSeconds;

  validateConfiguration(
    displayFrequency,
    frequencyValue,
    autoCloseEnabled,
    autoCloseSeconds
  );
  validatePagePlacementPair(
    input.pageType ?? existing.pageType,
    input.placementType ?? existing.placementType
  );
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

  return repository.create({ ...input, code: input.code.trim() }, userId);
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

  const normalizedInput =
    input.autoCloseEnabled === false && input.autoCloseSeconds === undefined
      ? { ...input, autoCloseSeconds: null }
      : input;
  const updated = await repository.update(id, normalizedInput, userId);

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
