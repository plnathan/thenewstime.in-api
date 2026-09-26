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

const validateNoOverlap = async (
  advertisementId: number,
  placementId: number,
  startAt: Date,
  endAt: Date,
  excludeId?: number
): Promise<void> => {
  const overlapping = await repository.findOverlapping(
    advertisementId,
    placementId,
    startAt,
    endAt,
    excludeId
  );

  if (overlapping) {
    throw new ApiError(
      409,
      "Advertisement already has an overlapping schedule for this placement."
    );
  }
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

  await validateNoOverlap(
    input.advertisementId,
    input.placementId,
    input.startAt,
    input.endAt
  );

  try {
    return await repository.create(input, userId);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23514"
    ) {
      throw new ApiError(400, "Schedule violates a database constraint.");
    }

    throw error;
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

  if (changingScheduleWindow) {
    await validateNoOverlap(
      existing.advertisementId,
      existing.placementId,
      startAt,
      endAt,
      id
    );
  }

  const updated = await repository.update(id, input, userId);

  if (!updated) {
    throw new ApiError(404, "Advertisement schedule not found");
  }

  return updated;
};

const transition = async (
  id: number,
  userId: number,
  targetStatus: AdvertisementSchedule["status"]
): Promise<AdvertisementSchedule> => {
  const existing = await getById(id);

  validateTransition(existing.status, targetStatus);

  await validateLifecyclePrerequisites(existing);

  if (targetStatus === "ACTIVE") {
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
