import type { PoolClient } from "pg";

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

type DatabaseClient = PoolClient;

const DEFAULT_MAX_ACTIVE_ROTATION_MEMBERS_PER_PLACEMENT = 10;
const MIN_ROTATION_INTERVAL_SECONDS = 1;
const MAX_ROTATION_INTERVAL_SECONDS = 3600;

const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

const validateId = (value: number, label: string): void => {
  if (!isPositiveInteger(value)) {
    throw new ApiError(400, `${label} must be a positive integer.`);
  }
};

const validateActorId = (value: number, label: string): void => {
  validateId(value, label);
};

const validateRotationConfigInput = (
  input: UpdateAdvertisementRotationConfigInput
): void => {
  if (
    input.rotationEnabled !== undefined &&
    typeof input.rotationEnabled !== "boolean"
  ) {
    throw new ApiError(400, "Rotation enabled must be a boolean.");
  }

  if (input.rotationMode !== undefined && input.rotationMode !== "TIME_BASED") {
    throw new ApiError(400, "The supported rotation mode is TIME_BASED.");
  }

  if (
    input.rotationStrategy !== undefined &&
    input.rotationStrategy !== "ROUND_ROBIN"
  ) {
    throw new ApiError(400, "The supported rotation strategy is ROUND_ROBIN.");
  }

  if (input.rotationIntervalSeconds !== undefined) {
    const interval = input.rotationIntervalSeconds;

    if (
      !Number.isInteger(interval) ||
      interval < MIN_ROTATION_INTERVAL_SECONDS ||
      interval > MAX_ROTATION_INTERVAL_SECONDS
    ) {
      throw new ApiError(
        400,
        `Rotation interval must be between ${MIN_ROTATION_INTERVAL_SECONDS} and ${MAX_ROTATION_INTERVAL_SECONDS} seconds.`
      );
    }
  }
};

const validateMemberInput = (
  input: CreateAdvertisementRotationMemberInput
): void => {
  validateId(input.advertisementId, "Advertisement ID");

  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  ) {
    throw new ApiError(
      400,
      "Rotation priority must be a non-negative integer."
    );
  }

  if (
    input.status !== undefined &&
    input.status !== "ACTIVE" &&
    input.status !== "INACTIVE"
  ) {
    throw new ApiError(
      400,
      "Rotation member status must be ACTIVE or INACTIVE."
    );
  }
};

const validateMemberUpdateInput = (
  input: UpdateAdvertisementRotationMemberInput
): void => {
  if (Object.keys(input).length === 0) {
    throw new ApiError(400, "At least one rotation member field is required.");
  }

  if (
    input.priority !== undefined &&
    (!Number.isInteger(input.priority) || input.priority < 0)
  ) {
    throw new ApiError(
      400,
      "Rotation priority must be a non-negative integer."
    );
  }

  if (
    input.status !== undefined &&
    input.status !== "ACTIVE" &&
    input.status !== "INACTIVE"
  ) {
    throw new ApiError(
      400,
      "Rotation member status must be ACTIVE or INACTIVE."
    );
  }
};

const getMaxActiveRotationMembers = async (
  client: DatabaseClient
): Promise<number> => {
  const limits = await repository.findRotationLimits(client);
  const limit =
    limits.maxActiveRotationMembersPerPlacement ??
    DEFAULT_MAX_ACTIVE_ROTATION_MEMBERS_PER_PLACEMENT;

  if (!Number.isInteger(limit) || limit < 1) {
    throw new ApiError(
      500,
      "The configured active rotation-member limit is invalid."
    );
  }

  return limit;
};

const assertActiveMemberCapacity = async (
  placementId: number,
  client: DatabaseClient
): Promise<void> => {
  const maxActiveMembers = await getMaxActiveRotationMembers(client);
  const activeMemberCount = await repository.countActiveMembersByPlacement(
    placementId,
    client
  );

  if (activeMemberCount >= maxActiveMembers) {
    throw new ApiError(
      409,
      `This placement already has the maximum of ${maxActiveMembers} active rotation members. Increase the configured limit or deactivate an existing member before adding or activating another member.`
    );
  }
};

const lockPlacement = async (
  placementId: number,
  client: DatabaseClient
): Promise<void> => {
  const placement = await repository.findPlacementForUpdate(
    placementId,
    client
  );

  if (!placement) {
    throw new ApiError(404, "Advertisement placement was not found.");
  }
};

const validateAdvertisementForPlacement = async (
  placementId: number,
  advertisementId: number,
  client: DatabaseClient
): Promise<void> => {
  const advertisement = await repository.findAdvertisement(
    advertisementId,
    client
  );

  if (!advertisement) {
    throw new ApiError(404, "Advertisement was not found.");
  }

  const status = String(
    (advertisement as { status?: unknown }).status ?? ""
  ).toUpperCase();

  const workflowStatus = String(
    (advertisement as { workflowStatus?: unknown }).workflowStatus ?? ""
  ).toUpperCase();

  if (status === "ARCHIVED" || workflowStatus === "ARCHIVED") {
    throw new ApiError(
      409,
      "Archived advertisements cannot be added to an active rotation."
    );
  }

  const hasActiveRule = await repository.hasActivePlacementRule(
    advertisementId,
    placementId,
    client
  );

  if (!hasActiveRule) {
    throw new ApiError(
      409,
      "The advertisement must have an active rule for this placement before it can be added to the rotation."
    );
  }
};

const withTransaction = async <T>(
  operation: (client: DatabaseClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await operation(client);

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getRotationConfig = async (
  placementId: number
): Promise<AdvertisementRotationConfig> => {
  validateId(placementId, "Placement ID");

  const placement = await repository.findPlacement(placementId);

  if (!placement) {
    throw new ApiError(404, "Advertisement placement was not found.");
  }

  const config = await repository.findRotationConfig(placementId);

  if (!config) {
    throw new ApiError(
      404,
      "Rotation configuration was not found for this placement."
    );
  }

  return config;
};

export const updateRotationConfig = async (
  placementId: number,
  input: UpdateAdvertisementRotationConfigInput,
  updatedBy: number
): Promise<AdvertisementRotationConfig> => {
  validateId(placementId, "Placement ID");
  validateActorId(updatedBy, "Updated by");
  validateRotationConfigInput(input);

  if (Object.keys(input).length === 0) {
    throw new ApiError(
      400,
      "At least one rotation configuration field is required."
    );
  }

  return withTransaction(async (client) => {
    await lockPlacement(placementId, client);

    const existingConfig = await repository.findRotationConfig(
      placementId,
      client
    );

    if (!existingConfig) {
      throw new ApiError(
        404,
        "Rotation configuration was not found for this placement."
      );
    }

    const updatedConfig = await repository.updateRotationConfig(
      placementId,
      input,
      updatedBy,
      client
    );

    if (!updatedConfig) {
      throw new ApiError(
        500,
        "The rotation configuration could not be updated."
      );
    }

    return updatedConfig;
  });
};

export const getMembers = async (
  placementId: number
): Promise<AdvertisementRotationMember[]> => {
  validateId(placementId, "Placement ID");

  const placement = await repository.findPlacement(placementId);

  if (!placement) {
    throw new ApiError(404, "Advertisement placement was not found.");
  }

  return repository.findMembersByPlacement(placementId);
};

export const addMember = async (
  placementId: number,
  input: CreateAdvertisementRotationMemberInput,
  createdBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "Placement ID");
  validateActorId(createdBy, "Created by");
  validateMemberInput(input);

  const requestedStatus = input.status ?? "ACTIVE";

  return withTransaction(async (client) => {
    // Serializes additions and reactivations for this placement.
    await lockPlacement(placementId, client);

    await validateAdvertisementForPlacement(
      placementId,
      input.advertisementId,
      client
    );

    const existingMember = await repository.findMemberByAdvertisement(
      placementId,
      input.advertisementId,
      client
    );

    if (existingMember) {
      throw new ApiError(
        409,
        "This advertisement is already a member of the placement rotation."
      );
    }

    if (requestedStatus === "ACTIVE") {
      await assertActiveMemberCapacity(placementId, client);
    }

    const createdMember = await repository.createMember(
      placementId,
      {
        ...input,
        status: requestedStatus
      },
      client
    );

    if (!createdMember) {
      throw new ApiError(500, "The rotation member could not be created.");
    }

    return createdMember;
  });
};

export const updateMember = async (
  placementId: number,
  memberId: number,
  input: UpdateAdvertisementRotationMemberInput,
  updatedBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "Placement ID");
  validateId(memberId, "Rotation member ID");
  validateActorId(updatedBy, "Updated by");
  validateMemberUpdateInput(input);

  return withTransaction(async (client) => {
    await lockPlacement(placementId, client);

    const existingMember = await repository.findMemberById(
      placementId,
      memberId,
      client
    );

    if (!existingMember) {
      throw new ApiError(404, "Rotation member was not found.");
    }

    const isActivating =
      input.status === "ACTIVE" && existingMember.status !== "ACTIVE";

    if (isActivating) {
      await validateAdvertisementForPlacement(
        placementId,
        existingMember.advertisementId,
        client
      );

      await assertActiveMemberCapacity(placementId, client);
    }

    const updatedMember = await repository.updateMember(
      placementId,
      memberId,
      input,
      client
    );

    if (!updatedMember) {
      throw new ApiError(500, "The rotation member could not be updated.");
    }

    return updatedMember;
  });
};

export const removeMember = async (
  placementId: number,
  memberId: number,
  updatedBy: number
): Promise<AdvertisementRotationMember> => {
  validateId(placementId, "Placement ID");
  validateId(memberId, "Rotation member ID");
  validateActorId(updatedBy, "Updated by");

  return withTransaction(async (client) => {
    await lockPlacement(placementId, client);

    const existingMember = await repository.findMemberById(
      placementId,
      memberId,
      client
    );

    if (!existingMember) {
      throw new ApiError(404, "Rotation member was not found.");
    }

    const deactivatedMember = await repository.deactivateMember(
      placementId,
      memberId,
      client
    );

    if (!deactivatedMember) {
      throw new ApiError(500, "The rotation member could not be deactivated.");
    }

    return deactivatedMember;
  });
};
