import { createHash } from "node:crypto";

import { pool } from "../../../../shared/config/db.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";

import * as repository from "./tracking.repository.js";
import type {
  AdvertisementMetrics,
  AdvertisementTrackingRelationship,
  AdvertisementTrackingRequest,
  AdvertisementTrackingResult
} from "./tracking.types.js";
import type {
  AdvertisementMetricsQueryInput,
  AdvertisementTrackingInput
} from "./tracking.validation.js";

interface TrackingMetadata {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  visitorId?: string;
}

function hashIpAddress(ipAddress: string): string {
  const secret =
    process.env.ADVERTISEMENT_TRACKING_HASH_SECRET ??
    process.env.JWT_SECRET ??
    "thenewstime-advertisement-tracking";

  return createHash("sha256").update(`${secret}:${ipAddress}`).digest("hex");
}

function buildTrackingContext(
  context: AdvertisementTrackingInput["context"]
): AdvertisementTrackingRequest["context"] {
  if (context === undefined) {
    return undefined;
  }

  const result: NonNullable<AdvertisementTrackingRequest["context"]> = {};

  if (context.site !== undefined) {
    result.site = context.site;
  }

  if (context.newsId !== undefined) {
    result.newsId = context.newsId;
  }

  if (context.category !== undefined) {
    result.category = context.category;
  }

  if (context.state !== undefined) {
    result.state = context.state;
  }

  if (context.district !== undefined) {
    result.district = context.district;
  }

  if (context.country !== undefined) {
    result.country = context.country;
  }

  return result;
}

function buildTrackingRequest(
  input: AdvertisementTrackingInput,
  metadata: TrackingMetadata
): AdvertisementTrackingRequest {
  const request: AdvertisementTrackingRequest = {
    advertisementId: input.advertisementId,
    placementId: input.placementId,
    placementRuleId: input.placementRuleId,
    scheduleId: input.scheduleId,
    creativeId: input.creativeId,
    pageType: input.pageType,
    placementType: input.placementType
  };

  if (input.sessionId !== undefined) {
    request.sessionId = input.sessionId;
  } else if (metadata.sessionId !== undefined) {
    request.sessionId = metadata.sessionId;
  }

  if (input.visitorId !== undefined) {
    request.visitorId = input.visitorId;
  } else if (metadata.visitorId !== undefined) {
    request.visitorId = metadata.visitorId;
  }

  if (input.browser !== undefined) {
    request.browser = input.browser;
  }

  if (input.operatingSystem !== undefined) {
    request.operatingSystem = input.operatingSystem;
  }

  if (input.deviceType !== undefined) {
    request.deviceType = input.deviceType;
  }

  if (input.pageUrl !== undefined) {
    request.pageUrl = input.pageUrl;
  }

  if (input.referrerUrl !== undefined) {
    request.referrerUrl = input.referrerUrl;
  }

  const context = buildTrackingContext(input.context);

  if (context !== undefined) {
    request.context = context;
  }

  if (metadata.ipAddress !== undefined) {
    request.ipHash = hashIpAddress(metadata.ipAddress);
  }

  if (metadata.userAgent !== undefined) {
    request.userAgent = metadata.userAgent;
  }

  return request;
}

function validateRelationship(
  request: AdvertisementTrackingRequest,
  relationship: AdvertisementTrackingRelationship | null
): AdvertisementTrackingRelationship {
  if (relationship === null) {
    throw new ApiError(400, "Invalid advertisement tracking relationship.");
  }

  if (
    relationship.advertisementId !== request.advertisementId ||
    relationship.placementId !== request.placementId ||
    relationship.placementRuleId !== request.placementRuleId ||
    relationship.scheduleId !== request.scheduleId ||
    relationship.creativeId !== request.creativeId
  ) {
    throw new ApiError(
      400,
      "Advertisement tracking relationship does not match the requested delivery."
    );
  }

  if (relationship.pageType !== request.pageType) {
    throw new ApiError(
      400,
      "Advertisement page type does not match the placement."
    );
  }

  if (relationship.placementType !== request.placementType) {
    throw new ApiError(
      400,
      "Advertisement placement type does not match the placement."
    );
  }

  return relationship;
}

function validateImpressionState(
  relationship: AdvertisementTrackingRelationship
): void {
  if (relationship.advertisementStatus !== "ACTIVE") {
    throw new ApiError(
      400,
      "Advertisement is not active for impression tracking."
    );
  }

  if (relationship.advertisementWorkflowStatus !== "APPROVED") {
    throw new ApiError(
      400,
      "Advertisement is not approved for impression tracking."
    );
  }

  if (
    relationship.placementStatus !== "ACTIVE" ||
    !relationship.placementEnabled
  ) {
    throw new ApiError(
      400,
      "Advertisement placement is not active or enabled."
    );
  }

  if (relationship.placementRuleStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement placement rule is not active.");
  }

  if (relationship.scheduleStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement schedule is not active.");
  }

  const now = new Date();

  if (
    relationship.scheduleStartAt === null ||
    relationship.scheduleEndAt === null ||
    now < relationship.scheduleStartAt ||
    now >= relationship.scheduleEndAt
  ) {
    throw new ApiError(400, "Advertisement schedule is not currently active.");
  }

  if (
    relationship.advertisementStartAt === null ||
    relationship.advertisementEndAt === null ||
    now < relationship.advertisementStartAt ||
    now >= relationship.advertisementEndAt
  ) {
    throw new ApiError(400, "Advertisement campaign is not currently active.");
  }

  if (relationship.rotationEnabled && !relationship.rotationMemberActive) {
    throw new ApiError(
      400,
      "Advertisement is not an active member of this placement rotation."
    );
  }

  if (relationship.creativeStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement creative is not active.");
  }
}

function validateClickState(
  relationship: AdvertisementTrackingRelationship
): void {
  if (relationship.advertisementStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement is not active for click tracking.");
  }

  if (relationship.advertisementWorkflowStatus !== "APPROVED") {
    throw new ApiError(
      400,
      "Advertisement is not approved for click tracking."
    );
  }

  if (
    relationship.placementStatus !== "ACTIVE" ||
    !relationship.placementEnabled
  ) {
    throw new ApiError(
      400,
      "Advertisement placement is not active or enabled."
    );
  }

  if (relationship.placementRuleStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement placement rule is not active.");
  }

  if (relationship.scheduleStatus === "SCHEDULED") {
    throw new ApiError(
      400,
      "Advertisement schedule is not available for click tracking."
    );
  }

  if (relationship.scheduleStatus !== "ACTIVE") {
    throw new ApiError(
      400,
      "Advertisement schedule is not active for click tracking."
    );
  }

  const now = new Date();

  if (
    relationship.scheduleStartAt === null ||
    relationship.scheduleEndAt === null ||
    now < relationship.scheduleStartAt ||
    now >= relationship.scheduleEndAt
  ) {
    throw new ApiError(400, "Advertisement schedule is not currently active.");
  }

  if (
    relationship.advertisementStartAt === null ||
    relationship.advertisementEndAt === null ||
    now < relationship.advertisementStartAt ||
    now >= relationship.advertisementEndAt
  ) {
    throw new ApiError(400, "Advertisement campaign is not currently active.");
  }

  if (relationship.rotationEnabled && !relationship.rotationMemberActive) {
    throw new ApiError(
      400,
      "Advertisement is not an active member of this placement rotation."
    );
  }

  if (relationship.creativeStatus !== "ACTIVE") {
    throw new ApiError(400, "Advertisement creative is not active.");
  }
}

export const trackImpression = async (
  input: AdvertisementTrackingInput,
  metadata: TrackingMetadata
): Promise<AdvertisementTrackingResult> => {
  const request = buildTrackingRequest(input, metadata);

  const relationship = validateRelationship(
    request,
    await repository.findTrackingRelationship(
      request.advertisementId,
      request.placementId,
      request.placementRuleId,
      request.scheduleId,
      request.creativeId
    )
  );

  validateImpressionState(relationship);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await repository.lockPlacementRule(request.placementRuleId, client);

    const currentRelationship = validateRelationship(
      request,
      await repository.findTrackingRelationship(
        request.advertisementId,
        request.placementId,
        request.placementRuleId,
        request.scheduleId,
        request.creativeId,
        client
      )
    );
    validateImpressionState(currentRelationship);

    if (currentRelationship.maxImpressions !== null) {
      const impressionCount = await repository.countImpressionsForSchedule(
        request.scheduleId,
        request.placementRuleId,
        client
      );

      if (impressionCount >= currentRelationship.maxImpressions) {
        await client.query("COMMIT");

        return {
          tracked: false,
          eventId: null,
          eventAt: null,
          reason: "MAX_IMPRESSIONS_REACHED"
        };
      }
    }

    const event = await repository.createImpression(request, client);

    await client.query("COMMIT");

    return {
      tracked: true,
      eventId: event.id,
      eventAt: event.eventAt
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const trackClick = async (
  input: AdvertisementTrackingInput,
  metadata: TrackingMetadata
): Promise<AdvertisementTrackingResult> => {
  const request = buildTrackingRequest(input, metadata);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const relationship = validateRelationship(
      request,
      await repository.findTrackingRelationship(
        request.advertisementId,
        request.placementId,
        request.placementRuleId,
        request.scheduleId,
        request.creativeId,
        client
      )
    );
    validateClickState(relationship);

    const event = await repository.createClick(request, client);
    await client.query("COMMIT");

    return {
      tracked: true,
      eventId: event.id,
      eventAt: event.eventAt
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getMetrics = async (
  advertisementId: number,
  query: AdvertisementMetricsQueryInput
): Promise<AdvertisementMetrics> => {
  const advertisementExists =
    await repository.advertisementExists(advertisementId);

  if (!advertisementExists) {
    throw new ApiError(404, "Advertisement not found.");
  }

  return repository.getMetrics(advertisementId, query.from, query.to);
};
