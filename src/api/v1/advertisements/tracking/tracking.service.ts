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

  if (input.clientEventId !== undefined) {
    request.clientEventId = input.clientEventId;
  }

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

    // The placement-rule row is locked, so retries are serialized with
    // the original insert and cannot consume an additional impression cap.
    if (request.clientEventId !== undefined) {
      const existing = await repository.findImpressionByClientEventId(
        request.clientEventId,
        client
      );
      if (existing !== null) {
        await client.query("COMMIT");
        return {
          tracked: false,
          eventId: existing.id,
          eventAt: existing.eventAt
        };
      }
    }

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

/**
 * Transaction-safe batch: lock every involved rule in deterministic order,
 * revalidate live eligibility, enforce per-schedule caps, then bulk insert.
 * Invalid events are rejected individually without affecting valid siblings.
 */
export const trackImpressionBatch = async (
  inputs: AdvertisementTrackingInput[],
  metadata: TrackingMetadata
): Promise<{
  accepted: number;
  rejected: number;
  duplicatesOrCapped: number;
}> => {
  const requests = inputs.map((input) => buildTrackingRequest(input, metadata));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ruleIds = [
      ...new Set(requests.map((request) => request.placementRuleId))
    ].sort((a, b) => a - b);
    const lockedRules = new Map<
      number,
      { maxImpressions: number | null } | null
    >();
    for (const ruleId of ruleIds) {
      lockedRules.set(
        ruleId,
        await repository.lockPlacementRule(ruleId, client)
      );
    }

    const existingIds = await repository.findExistingImpressionEventIds(
      requests.flatMap((request) =>
        request.clientEventId === undefined ? [] : [request.clientEventId]
      ),
      client
    );
    const seenIds = new Set(existingIds);
    const capCounts = new Map<string, number>();
    const candidates: AdvertisementTrackingRequest[] = [];
    let rejected = 0;
    let duplicatesOrCapped = 0;

    for (const request of requests) {
      try {
        if (
          request.clientEventId !== undefined &&
          seenIds.has(request.clientEventId)
        ) {
          duplicatesOrCapped += 1;
          continue;
        }
        if (lockedRules.get(request.placementRuleId) == null) {
          throw new ApiError(400, "Placement rule not found.");
        }
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
        validateImpressionState(relationship);
        if (relationship.maxImpressions !== null) {
          const key = `${request.scheduleId}:${request.placementRuleId}`;
          let count = capCounts.get(key);
          if (count === undefined) {
            count = await repository.countImpressionsForSchedule(
              request.scheduleId,
              request.placementRuleId,
              client
            );
          }
          if (count >= relationship.maxImpressions) {
            capCounts.set(key, count);
            duplicatesOrCapped += 1;
            continue;
          }
          capCounts.set(key, count + 1);
        }
        candidates.push(request);
        if (request.clientEventId !== undefined)
          seenIds.add(request.clientEventId);
      } catch {
        rejected += 1;
      }
    }

    const inserted = await repository.createImpressionsBulk(candidates, client);
    // A conflicting event ID may already exist under another rule; count only
    // rows actually returned by INSERT ... ON CONFLICT DO NOTHING.
    const accepted = inserted.length;
    duplicatesOrCapped += candidates.length - accepted;
    await client.query("COMMIT");
    return { accepted, rejected, duplicatesOrCapped };
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

  // HTML date inputs represent calendar days in India, not UTC instants.
  // Use [start of FROM day, start of day AFTER TO) to include the entire
  // selected final day without losing events after midnight UTC.
  const indiaOffsetMs = 5.5 * 60 * 60 * 1000;
  const from =
    query.from === undefined
      ? undefined
      : new Date(query.from.getTime() - indiaOffsetMs);
  const toExclusive =
    query.to === undefined
      ? undefined
      : new Date(query.to.getTime() + 24 * 60 * 60 * 1000 - indiaOffsetMs);

  return repository.getMetrics(advertisementId, from, toExclusive);
};
