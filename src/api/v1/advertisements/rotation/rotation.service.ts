import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./rotation.repository.js";

import type {
  AdvertisementRotationConfig,
  AdvertisementRotationMember,
  CreateAdvertisementRotationMemberInput,
  UpdateAdvertisementRotationConfigInput,
  UpdateAdvertisementRotationMemberInput
} from "./rotation.types.js";

const validateId = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApiError(400, `${name} must be a positive integer.`);
  }
};

const validateRotationConfiguration = (
  input: UpdateAdvertisementRotationConfigInput
): void => {
  if (input.rotationMode !== undefined && input.rotationMode !== "TIME_BASED") {
    throw new ApiError(400, "Unsupported rotation mode.");
  }

  if (
    input.rotationStrategy !== undefined &&
    input.rotationStrategy !== "ROUND_ROBIN"
  ) {
    throw new ApiError(400, "Unsupported rotation strategy.");
  }

  if (
    input.rotationIntervalSeconds !== undefined &&
    (!Number.isInteger(input.rotationIntervalSeconds) ||
      input.rotationIntervalSeconds <= 0)
  ) {
    throw new ApiError(
      400,
      "rotationIntervalSeconds must be a positive integer."
    );
  }
};

const validateAdvertisementEligibility = (advertisement: {
  status: string;
  workflowStatus: string;
}): void => {
  if (
    advertisement.status === "ARCHIVED" ||
    advertisement.workflowStatus === "ARCHIVED"
  ) {
    throw new ApiError(
      409,
      "Archived advertisements cannot participate in rotation."
    );
  }
};

export const getRotationConfig = async (
  placementId: number
): Promise<AdvertisementRotationConfig> => {
  validateId(placementId, "placementId");

  const config = await repository.findRotationConfig(placementId);

  if (!config) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return config;
};

export const updateRotationConfig = async (
  placementId: number,
  input: UpdateAdvertisementRotationConfigInput,
  updatedBy: number
): Promise<AdvertisementRotationConfig> => {
  validateId(placementId, "placementId");
  validateId(updatedBy, "updatedBy");

  validateRotationConfiguration(input);

  const existing = await repository.findRotationConfig(placementId);

  if (!existing) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const locked = await repository.findPlacementForUpdate(placementId, client);

    if (!locked) {
      throw new ApiError(404, "Advertisement placement not found.");
    }

    const updated = await repository.updateRotationConfig(
      placementId,
      input,
      updatedBy,
      client
    );

    if (!updated) {
      throw new ApiError(404, "Advertisement placement not found.");
    }

    await client.query("COMMIT");

    return updated;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getMembers = async (
  placementId: number
): Promise<AdvertisementRotationMember[]> => {
  validateId(placementId, "placementId");

  const exists = await repository.findPlacement(placementId);

  if (!exists) {
    throw new ApiError(404, "Advertisement placement not found.");
  }

  return repository.findMembersByPlacement(placementId);
};

export const addMember = async (
  placementId: number,
  input: CreateAdvertisementRotationMemberInput,
  createdBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "placementId");
  validateId(input.advertisementId, "advertisementId");
  validateId(createdBy, "createdBy");

  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  ) {
    throw new ApiError(400, "priority must be a non-negative integer.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const placementExists = await repository.findPlacementForUpdate(
      placementId,
      client
    );

    if (!placementExists) {
      throw new ApiError(404, "Advertisement placement not found.");
    }

    const advertisement = await repository.findAdvertisement(
      input.advertisementId,
      client
    );

    if (!advertisement) {
      throw new ApiError(404, "Advertisement not found.");
    }

    validateAdvertisementEligibility(advertisement);

    const hasPlacementRule = await repository.hasActivePlacementRule(
      input.advertisementId,
      placementId,
      client
    );

    if (!hasPlacementRule) {
      throw new ApiError(
        409,
        "Advertisement does not have an active placement rule for this placement."
      );
    }

    const existing = await repository.findMemberByAdvertisement(
      placementId,
      input.advertisementId,
      client
    );

    if (existing) {
      throw new ApiError(
        409,
        "Advertisement is already a rotation member for this placement."
      );
    }

    const member = await repository.createMember(placementId, input, client);

    await client.query("COMMIT");

    return member;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateMember = async (
  placementId: number,
  memberId: number,
  input: UpdateAdvertisementRotationMemberInput,
  updatedBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "placementId");
  validateId(memberId, "memberId");
  validateId(updatedBy, "updatedBy");

  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  ) {
    throw new ApiError(400, "priority must be a non-negative integer.");
  }

  const existing = await repository.findMemberById(placementId, memberId);

  if (!existing) {
    throw new ApiError(404, "Advertisement rotation member not found.");
  }

  const updated = await repository.updateMember(placementId, memberId, input);

  if (!updated) {
    throw new ApiError(404, "Advertisement rotation member not found.");
  }

  return updated;
};

export const removeMember = async (
  placementId: number,
  memberId: number,
  updatedBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "placementId");
  validateId(memberId, "memberId");
  validateId(updatedBy, "updatedBy");

  const existing = await repository.findMemberById(placementId, memberId);

  if (!existing) {
    throw new ApiError(404, "Advertisement rotation member not found.");
  }

  const updated = await repository.deactivateMember(placementId, memberId);

  if (!updated) {
    throw new ApiError(404, "Advertisement rotation member not found.");
  }

  return updated;
};
