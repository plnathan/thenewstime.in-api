import { pool } from "../../../../shared/config/db.js";
import type { PoolClient } from "pg";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./schedule.repository.js";

import type {
  AdvertisementSchedule,
  AdvertisementScheduleStatus,
  CreateScheduleInput,
  ScheduleQuery,
  UpdateScheduleInput
} from "./schedule.types.js";

const validateDateRange = (startAt: Date, endAt: Date): void => {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new ApiError(400, "Invalid schedule date/time.");
  }

  if (endAt <= startAt) {
    throw new ApiError(400, "End date/time must be after start date/time.");
  }
};

const validateApprovedAdvertisement = async (
  advertisementId: number
): Promise<void> => {
  const workflowStatus =
    await repository.findAdvertisementWorkflowStatus(advertisementId);

  if (workflowStatus === null) {
    throw new ApiError(404, "Advertisement not found");
  }

  if (workflowStatus !== "APPROVED") {
    throw new ApiError(400, "Only APPROVED advertisements can be scheduled.");
  }
};

const validateScheduleWithinCampaign = async (
  advertisementId: number,
  startAt: Date,
  endAt: Date
): Promise<void> => {
  const window =
    await repository.findAdvertisementCampaignWindow(advertisementId);

  if (!window) {
    throw new ApiError(404, "Advertisement not found.");
  }

  if (window.startAt === null || window.endAt === null) {
    throw new ApiError(
      409,
      "Both campaign start and end date/time must be configured before scheduling."
    );
  }

  const campaignStart = new Date(window.startAt).getTime();
  const campaignEnd = new Date(window.endAt).getTime();
  const scheduleStart = startAt.getTime();
  const scheduleEnd = endAt.getTime();

  if (
    !Number.isFinite(campaignStart) ||
    !Number.isFinite(campaignEnd) ||
    campaignEnd <= campaignStart
  ) {
    throw new ApiError(
      409,
      "Advertisement campaign has an invalid date window."
    );
  }

  if (scheduleStart < campaignStart || scheduleEnd > campaignEnd) {
    throw new ApiError(
      400,
      "The schedule must start at or after the campaign start and end at or before the campaign end."
    );
  }
};

const validatePlacement = async (placementId: number): Promise<void> => {
  const placement = await repository.findPlacement(placementId);

  if (!placement) {
    throw new ApiError(404, "Advertisement placement not found");
  }

  if (placement.status !== "ACTIVE" || !placement.is_enabled) {
    throw new ApiError(
      400,
      "Advertisement placement is not active or enabled."
    );
  }
};

const validatePlacementRule = async (
  placementRuleId: number,
  advertisementId: number,
  placementId: number
): Promise<void> => {
  const rule = await repository.findPlacementRule(placementRuleId);

  if (!rule) {
    throw new ApiError(404, "Advertisement placement rule not found");
  }

  if (
    rule.advertisement_id !== advertisementId ||
    rule.placement_id !== placementId
  ) {
    throw new ApiError(
      400,
      "Placement rule does not belong to the specified advertisement and placement."
    );
  }

  if (rule.status !== "ACTIVE") {
    throw new ApiError(400, "Advertisement placement rule is not active.");
  }
};

const validateRescheduledFrom = async (
  scheduleId: number | null | undefined,
  advertisementId: number,
  placementId: number
): Promise<void> => {
  if (scheduleId === undefined || scheduleId === null) {
    return;
  }

  const source = await repository.findById(scheduleId);

  if (!source) {
    throw new ApiError(404, "Source schedule for rescheduling was not found.");
  }

  if (
    source.advertisementId !== advertisementId ||
    source.placementId !== placementId
  ) {
    throw new ApiError(
      400,
      "Source schedule must belong to the same advertisement and placement."
    );
  }
};

/**
 * Checks for schedule conflicts.
 *
 * Preserve the five-argument repository call when no transaction client is
 * supplied. This keeps the service contract consistent for non-transactional
 * lifecycle operations and unit tests.
 *
 * Transactional create/update operations pass their PoolClient explicitly so
 * the overlap check participates in the same transaction as the write.
 */
const validateNoOverlap = async (
  advertisementId: number,
  placementId: number,
  startAt: Date,
  endAt: Date,
  excludeId?: number,
  client?: PoolClient
): Promise<void> => {
  const overlapping =
    client === undefined
      ? await repository.findOverlapping(
          advertisementId,
          placementId,
          startAt,
          endAt,
          excludeId
        )
      : await repository.findOverlapping(
          advertisementId,
          placementId,
          startAt,
          endAt,
          excludeId,
          client
        );

  if (!overlapping) {
    return;
  }

  const sameAdvertisement = overlapping.advertisementId === advertisementId;

  throw new ApiError(
    409,
    sameAdvertisement
      ? "This advertisement already has an overlapping schedule for this placement."
      : "This placement is configured as exclusive (rotation is disabled) and already has an overlapping advertisement schedule. Enable rotation or choose a non-overlapping time window."
  );
};

const validateLifecyclePrerequisites = async (
  schedule: AdvertisementSchedule
): Promise<void> => {
  await validateApprovedAdvertisement(schedule.advertisementId);
  await validatePlacement(schedule.placementId);

  if (schedule.placementRuleId !== null) {
    await validatePlacementRule(
      schedule.placementRuleId,
      schedule.advertisementId,
      schedule.placementId
    );
  }
};

const validateTransition = (
  currentStatus: AdvertisementScheduleStatus,
  targetStatus: AdvertisementScheduleStatus
): void => {
  const allowedTransitions: Record<
    AdvertisementScheduleStatus,
    AdvertisementScheduleStatus[]
  > = {
    SCHEDULED: ["ACTIVE", "PAUSED", "CANCELLED"],
    ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
    PAUSED: ["ACTIVE", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: []
  };

  if (!allowedTransitions[currentStatus].includes(targetStatus)) {
    throw new ApiError(
      409,
      `Invalid schedule lifecycle transition from ${currentStatus} to ${targetStatus}.`
    );
  }
};

export const getAll = async (
  query: ScheduleQuery = {}
): Promise<AdvertisementSchedule[]> => {
  return repository.findAll(query);
};

export const getById = async (id: number): Promise<AdvertisementSchedule> => {
  const schedule = await repository.findById(id);

  if (!schedule) {
    throw new ApiError(404, "Advertisement schedule not found");
  }

  return schedule;
};

export const create = async (
  input: CreateScheduleInput,
  userId: number
): Promise<AdvertisementSchedule> => {
  if (input.status !== undefined && input.status !== "SCHEDULED") {
    throw new ApiError(
      400,
      "A new schedule must be created with SCHEDULED status."
    );
  }

  validateDateRange(input.startAt, input.endAt);

  await validateScheduleWithinCampaign(
    input.advertisementId,
    input.startAt,
    input.endAt
  );

  await validateApprovedAdvertisement(input.advertisementId);
  await validatePlacement(input.placementId);

  if (input.placementRuleId !== undefined && input.placementRuleId !== null) {
    await validatePlacementRule(
      input.placementRuleId,
      input.advertisementId,
      input.placementId
    );
  }

  await validateRescheduledFrom(
    input.rescheduledFromId,
    input.advertisementId,
    input.placementId
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await repository.lockPlacementScheduleScope(input.placementId, client);

    // Recheck overlap after acquiring the placement lock. This serializes
    // schedule writes for the placement and closes the validation/write race.
    await validateNoOverlap(
      input.advertisementId,
      input.placementId,
      input.startAt,
      input.endAt,
      undefined,
      client
    );

    const created = await repository.create(input, userId, client);

    await client.query("COMMIT");

    return created;
  } catch (error: unknown) {
    await client.query("ROLLBACK");

    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23514"
    ) {
      throw new ApiError(400, "Schedule violates a database constraint.");
    }

    throw error;
  } finally {
    client.release();
  }
};

export const update = async (
  id: number,
  input: UpdateScheduleInput,
  userId: number
): Promise<AdvertisementSchedule> => {
  const existing = await getById(id);

  if (input.status !== undefined && input.status !== existing.status) {
    throw new ApiError(
      400,
      "Schedule status must be changed through the lifecycle endpoints."
    );
  }

  const startAt = input.startAt ?? existing.startAt;
  const endAt = input.endAt ?? existing.endAt;

  validateDateRange(startAt, endAt);

  await validateScheduleWithinCampaign(
    existing.advertisementId,
    startAt,
    endAt
  );

  if (input.placementRuleId !== undefined && input.placementRuleId !== null) {
    await validatePlacementRule(
      input.placementRuleId,
      existing.advertisementId,
      existing.placementId
    );
  }

  await validateRescheduledFrom(
    input.rescheduledFromId,
    existing.advertisementId,
    existing.placementId
  );

  const changingScheduleWindow =
    input.startAt !== undefined || input.endAt !== undefined;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await repository.lockPlacementScheduleScope(existing.placementId, client);

    // Re-read under the transaction after obtaining the placement lock.
    // This ensures the persisted schedule is checked against the latest row.
    const current = await repository.findById(id, client);

    if (!current) {
      throw new ApiError(404, "Advertisement schedule not found");
    }

    const currentStartAt = input.startAt ?? current.startAt;
    const currentEndAt = input.endAt ?? current.endAt;

    validateDateRange(currentStartAt, currentEndAt);

    await validateScheduleWithinCampaign(
      current.advertisementId,
      currentStartAt,
      currentEndAt
    );

    if (changingScheduleWindow) {
      await validateNoOverlap(
        current.advertisementId,
        current.placementId,
        currentStartAt,
        currentEndAt,
        id,
        client
      );
    }

    const updated = await repository.update(id, input, userId, client);

    if (!updated) {
      throw new ApiError(404, "Advertisement schedule not found");
    }

    await client.query("COMMIT");

    return updated;
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const transition = async (
  id: number,
  userId: number,
  targetStatus: AdvertisementScheduleStatus
): Promise<AdvertisementSchedule> => {
  const existing = await getById(id);

  validateTransition(existing.status, targetStatus);
  await validateLifecyclePrerequisites(existing);

  if (targetStatus === "ACTIVE") {
    const operationalStatus =
      await repository.findAdvertisementOperationalStatus(
        existing.advertisementId
      );

    if (operationalStatus !== "ACTIVE") {
      throw new ApiError(
        409,
        "A schedule can only be activated or resumed while its advertisement is operationally ACTIVE. Use the advertisement activation action to resume delivery."
      );
    }

    await validateNoOverlap(
      existing.advertisementId,
      existing.placementId,
      existing.startAt,
      existing.endAt,
      existing.id
    );
  }

  let updated: AdvertisementSchedule | null;

  switch (targetStatus) {
    case "ACTIVE":
      updated =
        existing.status === "PAUSED"
          ? await repository.resume(id, userId)
          : await repository.activate(id, userId);
      break;

    case "PAUSED":
      updated = await repository.pause(id, userId);
      break;

    case "COMPLETED":
      updated = await repository.complete(id, userId);
      break;

    case "CANCELLED":
      updated = await repository.cancel(id, userId);
      break;

    default:
      throw new ApiError(
        400,
        `Unsupported schedule lifecycle target status: ${targetStatus}.`
      );
  }

  if (!updated) {
    throw new ApiError(404, "Advertisement schedule not found");
  }

  return updated;
};

export const activate = async (
  id: number,
  userId: number
): Promise<AdvertisementSchedule> => {
  return transition(id, userId, "ACTIVE");
};

export const pause = async (
  id: number,
  userId: number
): Promise<AdvertisementSchedule> => {
  return transition(id, userId, "PAUSED");
};

export const resume = async (
  id: number,
  userId: number
): Promise<AdvertisementSchedule> => {
  return transition(id, userId, "ACTIVE");
};

export const complete = async (
  id: number,
  userId: number
): Promise<AdvertisementSchedule> => {
  return transition(id, userId, "COMPLETED");
};

export const cancel = async (
  id: number,
  userId: number
): Promise<AdvertisementSchedule> => {
  return transition(id, userId, "CANCELLED");
};
