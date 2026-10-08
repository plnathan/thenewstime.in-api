import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./creative.repository.js";

import type {
  AdvertisementCreative,
  AdvertisementCreativePreview,
  AdvertisementCreativePreviewResponse,
  CreateAdvertisementCreativeInput,
  UpdateAdvertisementCreativeInput
} from "./creative.types.js";

const DIMENSION_SLIGHT_TOLERANCE_PERCENT = 10;
const ASPECT_RATIO_SLIGHT_TOLERANCE_PERCENT = 5;

const validateId = (value: number, fieldName: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer.`);
  }
};

const normalizeNullableText = (
  value: string | null | undefined
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

const validateAdvertisementEditable = (workflowStatus: string): void => {
  if (workflowStatus !== "DRAFT" && workflowStatus !== "REJECTED") {
    throw new ApiError(
      409,
      `Advertisement creatives cannot be modified while advertisement workflow status is '${workflowStatus}'.`
    );
  }
};

const validateCreativeInput = (
  input: CreateAdvertisementCreativeInput
): void => {
  if (
    input.widthPx !== undefined &&
    input.widthPx !== null &&
    (!Number.isInteger(input.widthPx) || input.widthPx <= 0)
  ) {
    throw new ApiError(400, "widthPx must be a positive integer.");
  }

  if (
    input.heightPx !== undefined &&
    input.heightPx !== null &&
    (!Number.isInteger(input.heightPx) || input.heightPx <= 0)
  ) {
    throw new ApiError(400, "heightPx must be a positive integer.");
  }

  if (input.creativeType === "HTML" && input.mediaUrl.trim().length === 0) {
    throw new ApiError(400, "HTML creative content cannot be empty.");
  }

  if (input.creativeType === "TEXT" && input.mediaUrl.trim().length === 0) {
    throw new ApiError(400, "TEXT creative content cannot be empty.");
  }
};

const validateUpdateInput = (input: UpdateAdvertisementCreativeInput): void => {
  if (
    input.widthPx !== undefined &&
    input.widthPx !== null &&
    (!Number.isInteger(input.widthPx) || input.widthPx <= 0)
  ) {
    throw new ApiError(400, "widthPx must be a positive integer.");
  }

  if (
    input.heightPx !== undefined &&
    input.heightPx !== null &&
    (!Number.isInteger(input.heightPx) || input.heightPx <= 0)
  ) {
    throw new ApiError(400, "heightPx must be a positive integer.");
  }
};

const validateFormat = async (
  formatId: number | null | undefined
): Promise<void> => {
  if (formatId === undefined || formatId === null) {
    return;
  }

  validateId(formatId, "formatId");

  const format = await repository.findFormat(formatId);

  if (!format) {
    throw new ApiError(404, "Advertisement format not found.");
  }

  if (format.status !== "ACTIVE") {
    throw new ApiError(409, "Advertisement format is inactive.");
  }
};

const calculateAspectRatio = (
  widthPx: number | null,
  heightPx: number | null
): number | null => {
  if (widthPx === null || heightPx === null || widthPx <= 0 || heightPx <= 0) {
    return null;
  }

  return Number((widthPx / heightPx).toFixed(6));
};

const percentageDifference = (actual: number, expected: number): number => {
  if (expected === 0) {
    return 100;
  }

  return (Math.abs(actual - expected) / expected) * 100;
};

const createPreview = (
  creative: AdvertisementCreative,
  expectedWidthPx: number | null,
  expectedHeightPx: number | null,
  usesDesktopFallback = false
): AdvertisementCreativePreview => {
  const actualWidthPx = creative.widthPx;
  const actualHeightPx = creative.heightPx;

  const expectedAspectRatio = calculateAspectRatio(
    expectedWidthPx,
    expectedHeightPx
  );

  const actualAspectRatio = calculateAspectRatio(actualWidthPx, actualHeightPx);

  let status: AdvertisementCreativePreview["status"];
  let statusMessage: string;

  if (expectedWidthPx === null || expectedHeightPx === null) {
    status = "NO_EXPECTED_DIMENSIONS";
    statusMessage = "This format does not define fixed expected dimensions.";
  } else if (actualWidthPx === null || actualHeightPx === null) {
    status = "DIMENSIONS_NOT_AVAILABLE";
    statusMessage = "Actual creative dimensions are not available.";
  } else if (
    actualWidthPx === expectedWidthPx &&
    actualHeightPx === expectedHeightPx
  ) {
    status = "EXACT_MATCH";
    statusMessage =
      "Creative dimensions exactly match the expected format dimensions.";
  } else if (expectedAspectRatio !== null && actualAspectRatio !== null) {
    const widthDifference = percentageDifference(
      actualWidthPx,
      expectedWidthPx
    );

    const heightDifference = percentageDifference(
      actualHeightPx,
      expectedHeightPx
    );

    const aspectDifference = percentageDifference(
      actualAspectRatio,
      expectedAspectRatio
    );

    if (
      widthDifference <= DIMENSION_SLIGHT_TOLERANCE_PERCENT &&
      heightDifference <= DIMENSION_SLIGHT_TOLERANCE_PERCENT &&
      aspectDifference <= ASPECT_RATIO_SLIGHT_TOLERANCE_PERCENT
    ) {
      status = "SLIGHTLY_DIFFERENT";
      statusMessage =
        "Creative dimensions are slightly different but the aspect ratio remains close to the expected format.";
    } else if (aspectDifference > ASPECT_RATIO_SLIGHT_TOLERANCE_PERCENT) {
      status = "ASPECT_RATIO_MISMATCH";
      statusMessage = "Creative aspect ratio differs from the expected format.";
    } else {
      status = "DIMENSION_MISMATCH";
      statusMessage = "Creative dimensions differ from the expected format.";
    }
  } else {
    status = "DIMENSION_MISMATCH";
    statusMessage = "Creative dimensions differ from the expected format.";
  }

  if (usesDesktopFallback) {
    statusMessage = `${statusMessage} Mobile preview is using the desktop creative because a mobile creative is not configured.`;
  }

  return {
    creativeId: creative.id,
    advertisementId: creative.advertisementId,
    formatId: creative.formatId,
    creativeType: creative.creativeType,
    variant: creative.variant,
    previewUrl: creative.mediaUrl,
    thumbnailUrl: creative.thumbnailUrl,
    expected: {
      widthPx: expectedWidthPx,
      heightPx: expectedHeightPx,
      aspectRatio: expectedAspectRatio
    },
    actual: {
      widthPx: actualWidthPx,
      heightPx: actualHeightPx,
      aspectRatio: actualAspectRatio
    },
    status,
    statusMessage,
    renderMode: usesDesktopFallback
      ? "FALLBACK_DESKTOP"
      : creative.creativeType === "IMAGE" || creative.creativeType === "VIDEO"
        ? "CONTAIN"
        : "NATIVE",
    usesDesktopFallback
  };
};

export const getById = async (
  advertisementId: number,
  creativeId: number
): Promise<AdvertisementCreative> => {
  validateId(advertisementId, "advertisementId");
  validateId(creativeId, "creativeId");

  const creative = await repository.findById(creativeId);

  if (!creative || creative.advertisementId !== advertisementId) {
    throw new ApiError(404, "Advertisement creative not found.");
  }

  return creative;
};

export const getAll = async (
  advertisementId: number
): Promise<AdvertisementCreative[]> => {
  validateId(advertisementId, "advertisementId");

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return repository.findByAdvertisementId(advertisementId);
};

export const getActive = async (
  advertisementId: number
): Promise<AdvertisementCreative[]> => {
  validateId(advertisementId, "advertisementId");

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return repository.findActiveByAdvertisementId(advertisementId);
};

export const create = async (
  advertisementId: number,
  input: CreateAdvertisementCreativeInput,
  userId: number
): Promise<AdvertisementCreative> => {
  validateId(advertisementId, "advertisementId");
  validateId(userId, "userId");

  validateCreativeInput(input);

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  validateAdvertisementEditable(advertisement.workflowStatus);

  await validateFormat(input.formatId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (input.isPrimary === true) {
      await repository.clearPrimaryForVariant(
        advertisementId,
        input.variant ?? "DESKTOP",
        undefined,
        client
      );
    }

    const creative = await repository.create(
      advertisementId,
      {
        ...input,
        title: normalizeNullableText(input.title),
        altText: normalizeNullableText(input.altText),
        mediaUrl: input.mediaUrl.trim(),
        thumbnailUrl: normalizeNullableText(input.thumbnailUrl)
      },
      userId,
      client
    );

    await client.query("COMMIT");

    return creative;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const update = async (
  advertisementId: number,
  creativeId: number,
  input: UpdateAdvertisementCreativeInput,
  userId: number
): Promise<AdvertisementCreative> => {
  validateId(advertisementId, "advertisementId");
  validateId(creativeId, "creativeId");
  validateId(userId, "userId");

  validateUpdateInput(input);

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  validateAdvertisementEditable(advertisement.workflowStatus);

  const existing = await repository.findById(creativeId);

  if (!existing || existing.advertisementId !== advertisementId) {
    throw new ApiError(404, "Advertisement creative not found.");
  }

  if (input.formatId !== undefined) {
    await validateFormat(input.formatId);
  }

  const nextVariant = input.variant ?? existing.variant;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (
      input.isPrimary === true ||
      (existing.isPrimary && input.variant !== undefined)
    ) {
      await repository.clearPrimaryForVariant(
        advertisementId,
        nextVariant,
        creativeId,
        client
      );
    }

    const creative = await repository.update(
      creativeId,
      {
        ...input,
        title:
          input.title !== undefined
            ? normalizeNullableText(input.title)
            : undefined,
        altText:
          input.altText !== undefined
            ? normalizeNullableText(input.altText)
            : undefined,
        mediaUrl:
          input.mediaUrl !== undefined ? input.mediaUrl.trim() : undefined,
        thumbnailUrl:
          input.thumbnailUrl !== undefined
            ? normalizeNullableText(input.thumbnailUrl)
            : undefined
      },
      userId,
      client
    );

    if (!creative) {
      throw new ApiError(404, "Advertisement creative not found.");
    }

    await client.query("COMMIT");

    return creative;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const remove = async (
  advertisementId: number,
  creativeId: number,
  userId: number
): Promise<AdvertisementCreative> => {
  validateId(advertisementId, "advertisementId");
  validateId(creativeId, "creativeId");
  validateId(userId, "userId");

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  validateAdvertisementEditable(advertisement.workflowStatus);

  const existing = await repository.findById(creativeId);

  if (!existing || existing.advertisementId !== advertisementId) {
    throw new ApiError(404, "Advertisement creative not found.");
  }

  const creative = await repository.remove(creativeId, userId);

  if (!creative) {
    throw new ApiError(404, "Advertisement creative not found.");
  }

  return creative;
};

export const getPreview = async (
  advertisementId: number,
  creativeId: number
): Promise<AdvertisementCreativePreview> => {
  const creative = await getById(advertisementId, creativeId);

  let expectedWidthPx: number | null = null;
  let expectedHeightPx: number | null = null;

  if (creative.formatId !== null) {
    const format = await repository.findFormat(creative.formatId);

    if (format) {
      if (creative.variant === "MOBILE") {
        expectedWidthPx = format.mobileWidthPx;
        expectedHeightPx = format.mobileHeightPx;
      } else {
        expectedWidthPx = format.widthPx;
        expectedHeightPx = format.heightPx;
      }
    }
  }

  return createPreview(creative, expectedWidthPx, expectedHeightPx);
};

export const getAdvertisementPreview = async (
  advertisementId: number
): Promise<AdvertisementCreativePreviewResponse> => {
  validateId(advertisementId, "advertisementId");

  const advertisement = await repository.findAdvertisement(advertisementId);

  if (!advertisement) {
    throw new ApiError(404, "Advertisement not found.");
  }

  const creatives =
    await repository.findActiveByAdvertisementId(advertisementId);

  const desktop =
    creatives.find(
      (creative) => creative.variant === "DESKTOP" && creative.isPrimary
    ) ??
    creatives.find((creative) => creative.variant === "DESKTOP") ??
    null;

  const mobile =
    creatives.find(
      (creative) => creative.variant === "MOBILE" && creative.isPrimary
    ) ??
    creatives.find((creative) => creative.variant === "MOBILE") ??
    null;

  const buildPreview = async (
    creative: AdvertisementCreative,
    usesDesktopFallback: boolean
  ): Promise<AdvertisementCreativePreview> => {
    let expectedWidthPx: number | null = null;
    let expectedHeightPx: number | null = null;

    if (creative.formatId !== null) {
      const format = await repository.findFormat(creative.formatId);

      if (format) {
        if (creative.variant === "MOBILE" && !usesDesktopFallback) {
          expectedWidthPx = format.mobileWidthPx;
          expectedHeightPx = format.mobileHeightPx;
        } else {
          expectedWidthPx = format.widthPx;
          expectedHeightPx = format.heightPx;
        }
      }
    }

    return createPreview(
      creative,
      expectedWidthPx,
      expectedHeightPx,
      usesDesktopFallback
    );
  };

  const desktopPreview =
    desktop === null ? null : await buildPreview(desktop, false);

  const mobilePreview =
    mobile !== null
      ? await buildPreview(mobile, false)
      : desktop !== null
        ? await buildPreview(desktop, true)
        : null;

  return {
    desktop: desktopPreview,
    mobile: mobilePreview
  };
};
