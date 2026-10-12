import type {
  AdvertisementDeliveryCandidate,
  AdvertisementDeliveryTargetRow
} from "./delivery.repository.js";
import * as deliveryRepository from "./delivery.repository.js";

import type {
  AdvertisementDeliveryContext,
  AdvertisementDeliveryCreative,
  AdvertisementDeliveryFormat,
  AdvertisementDeliveryItem,
  AdvertisementDeliveryPageType,
  AdvertisementDeliveryPlacement,
  AdvertisementDeliveryPlacementType,
  AdvertisementDeliveryRequest,
  AdvertisementDeliveryResponse,
  AdvertisementDeliveryTargeting
} from "./delivery.types.js";

import * as placementRepository from "../placements/placement.repository.js";
import type { AdvertisementPlacement } from "../placements/placement.types.js";

const placementTypeByPage: Record<
  AdvertisementDeliveryPageType,
  AdvertisementDeliveryPlacementType[]
> = {
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
};

type PlacementRotationSettings = {
  rotationEnabled?: boolean;
  rotationMode?: AdvertisementDeliveryPlacement["rotationMode"];
  rotationIntervalSeconds?: number;
  rotationStrategy?: AdvertisementDeliveryPlacement["rotationStrategy"];
};

type CandidateCreative = NonNullable<
  AdvertisementDeliveryCandidate["creatives"]
>[number];

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeContext(
  context?: AdvertisementDeliveryContext
): AdvertisementDeliveryContext | undefined {
  if (!context) {
    return undefined;
  }

  const normalized: AdvertisementDeliveryContext = {};

  if (context.site !== undefined) {
    normalized.site = normalizeValue(context.site);
  }

  if (context.newsId !== undefined) {
    normalized.newsId = context.newsId;
  }

  if (context.category !== undefined) {
    normalized.category = normalizeValue(context.category);
  }

  if (context.state !== undefined) {
    normalized.state = normalizeValue(context.state);
  }

  if (context.district !== undefined) {
    normalized.district = normalizeValue(context.district);
  }

  if (context.country !== undefined) {
    normalized.country = normalizeValue(context.country);
  }

  return normalized;
}

function getContextValue(
  targetType: AdvertisementDeliveryTargetRow["targetType"],
  context?: AdvertisementDeliveryContext
): string | undefined {
  if (!context) {
    return undefined;
  }

  switch (targetType) {
    case "SITE":
      return context.site;

    case "NEWS":
      return context.newsId === undefined ? undefined : String(context.newsId);

    case "CATEGORY":
      return context.category;

    case "STATE":
      return context.state;

    case "DISTRICT":
      return context.district;

    case "COUNTRY":
      return context.country;

    default:
      return undefined;
  }
}

function targetMatches(
  target: AdvertisementDeliveryTargetRow,
  context?: AdvertisementDeliveryContext
): boolean {
  const contextValue = getContextValue(target.targetType, context);

  if (contextValue === undefined) {
    return false;
  }

  return normalizeValue(target.targetValue) === normalizeValue(contextValue);
}

function matchesTargeting(
  targets: AdvertisementDeliveryTargetRow[],
  context?: AdvertisementDeliveryContext
): boolean {
  if (targets.length === 0) {
    return true;
  }

  const includeTargets = targets.filter((target) => target.isInclude);
  const excludeTargets = targets.filter((target) => !target.isInclude);

  if (excludeTargets.some((target) => targetMatches(target, context))) {
    return false;
  }

  if (includeTargets.length === 0) {
    return true;
  }

  return includeTargets.some((target) => targetMatches(target, context));
}

function isValidPlacementForPage(
  pageType: AdvertisementDeliveryPageType,
  placementType: AdvertisementDeliveryPlacementType
): boolean {
  return placementTypeByPage[pageType].includes(placementType);
}

function hasUsableCreative(candidate: AdvertisementDeliveryCandidate): boolean {
  const activeCreatives = candidate.creatives ?? [];

  if (activeCreatives.length > 0) {
    return activeCreatives.some(
      (creative) => creative.mediaUrl.trim().length > 0
    );
  }

  // Preserve compatibility with repository results that only include
  // the legacy singular creative field.
  if (!candidate.creative || candidate.creative.mediaUrl.trim().length === 0) {
    return false;
  }

  if (candidate.format !== null) {
    return candidate.format.code.trim().length > 0;
  }

  return true;
}

function deduplicateCandidates(
  candidates: AdvertisementDeliveryCandidate[],
  rotationEnabled: boolean
): AdvertisementDeliveryCandidate[] {
  const selected = new Map<number, AdvertisementDeliveryCandidate>();

  for (const candidate of candidates) {
    const existing = selected.get(candidate.advertisementId);

    if (!existing) {
      selected.set(candidate.advertisementId, candidate);
      continue;
    }

    if (rotationEnabled) {
      // For rotating advertisements, keep the earliest placement rule
      // for duplicate rows belonging to the same advertisement.
      if (
        candidate.placementRuleDisplayOrder <
          existing.placementRuleDisplayOrder ||
        (candidate.placementRuleDisplayOrder ===
          existing.placementRuleDisplayOrder &&
          candidate.placementRuleId < existing.placementRuleId)
      ) {
        selected.set(candidate.advertisementId, candidate);
      }

      continue;
    }

    // Preserve the existing non-rotation selection behaviour.
    if (
      candidate.schedulePriority > existing.schedulePriority ||
      (candidate.schedulePriority === existing.schedulePriority &&
        candidate.priority > existing.priority)
    ) {
      selected.set(candidate.advertisementId, candidate);
    }
  }

  return Array.from(selected.values());
}

function getRotationSettings(
  placement: AdvertisementDeliveryPlacement | null,
  candidate?: AdvertisementDeliveryCandidate
): Pick<
  AdvertisementDeliveryPlacement,
  | "rotationEnabled"
  | "rotationMode"
  | "rotationIntervalSeconds"
  | "rotationStrategy"
> {
  const candidateSettings = candidate as
    (AdvertisementDeliveryCandidate & PlacementRotationSettings) | undefined;

  return {
    rotationEnabled:
      candidateSettings?.rotationEnabled ?? placement?.rotationEnabled ?? false,
    rotationMode:
      candidateSettings?.rotationMode ??
      placement?.rotationMode ??
      "TIME_BASED",
    rotationIntervalSeconds:
      candidateSettings?.rotationIntervalSeconds ??
      placement?.rotationIntervalSeconds ??
      10,
    rotationStrategy:
      candidateSettings?.rotationStrategy ??
      placement?.rotationStrategy ??
      "ROUND_ROBIN"
  };
}

function mapPlacement(
  candidate: AdvertisementDeliveryCandidate
): AdvertisementDeliveryPlacement {
  const rotation = getRotationSettings(null, candidate);

  return {
    id: candidate.placementId,
    code: candidate.placementCode,
    displayName: candidate.placementDisplayName,
    description: candidate.placementDescription,
    pageType: candidate.pageType,
    placementType: candidate.placementType,
    insertionType: candidate.placementInsertionType,
    displayOrder: candidate.placementDisplayOrder,
    collapseWhenEmpty: candidate.collapseWhenEmpty,
    fallbackBehavior: candidate.fallbackBehavior,
    displayFrequency: candidate.displayFrequency,
    frequencyValue: candidate.frequencyValue,
    autoCloseEnabled: candidate.autoCloseEnabled,
    autoCloseSeconds: candidate.autoCloseSeconds,
    closeButtonEnabled: candidate.closeButtonEnabled,
    closeOnOverlayClick: candidate.closeOnOverlayClick,
    isEnabled: true,
    ...rotation
  };
}

function mapPlacementEntity(
  placement: AdvertisementPlacement
): AdvertisementDeliveryPlacement {
  const rotationSource = placement as AdvertisementPlacement &
    PlacementRotationSettings;

  const rotation = getRotationSettings({
    id: placement.id,
    code: placement.code,
    displayName: placement.displayName,
    description: placement.description,
    pageType: placement.pageType,
    placementType: placement.placementType,
    insertionType: placement.insertionType,
    displayOrder: placement.displayOrder,
    collapseWhenEmpty: placement.collapseWhenEmpty,
    fallbackBehavior: placement.fallbackBehavior,
    displayFrequency: placement.displayFrequency,
    frequencyValue: placement.frequencyValue,
    autoCloseEnabled: placement.autoCloseEnabled,
    autoCloseSeconds: placement.autoCloseSeconds,
    closeButtonEnabled: placement.closeButtonEnabled,
    closeOnOverlayClick: placement.closeOnOverlayClick,
    isEnabled: placement.isEnabled,
    rotationEnabled: rotationSource.rotationEnabled ?? false,
    rotationMode: rotationSource.rotationMode ?? "TIME_BASED",
    rotationIntervalSeconds: rotationSource.rotationIntervalSeconds ?? 10,
    rotationStrategy: rotationSource.rotationStrategy ?? "ROUND_ROBIN"
  });

  return {
    id: placement.id,
    code: placement.code,
    displayName: placement.displayName,
    description: placement.description,
    pageType: placement.pageType,
    placementType: placement.placementType,
    insertionType: placement.insertionType,
    displayOrder: placement.displayOrder,
    collapseWhenEmpty: placement.collapseWhenEmpty,
    fallbackBehavior: placement.fallbackBehavior,
    displayFrequency: placement.displayFrequency,
    frequencyValue: placement.frequencyValue,
    autoCloseEnabled: placement.autoCloseEnabled,
    autoCloseSeconds: placement.autoCloseSeconds,
    closeButtonEnabled: placement.closeButtonEnabled,
    closeOnOverlayClick: placement.closeOnOverlayClick,
    isEnabled: placement.isEnabled,
    ...rotation
  };
}

function mapCreative(
  creative: CandidateCreative
): AdvertisementDeliveryCreative {
  return {
    id: creative.id,
    formatId: creative.format?.id ?? null,
    creativeType: creative.creativeType,
    variant: creative.variant,
    title: creative.title,
    altText: creative.altText,
    mediaUrl: creative.mediaUrl,
    thumbnailUrl: creative.thumbnailUrl,
    widthPx: creative.widthPx,
    heightPx: creative.heightPx,
    displayOrder: creative.displayOrder,
    isPrimary: creative.isPrimary
  };
}

function mapLegacyCreative(
  candidate: AdvertisementDeliveryCandidate
): AdvertisementDeliveryCreative | null {
  if (candidate.creative === null) {
    return null;
  }

  return {
    id: candidate.creative.id,
    formatId: candidate.format?.id ?? null,
    creativeType: candidate.creative.creativeType,
    variant: candidate.creative.variant,
    title: candidate.creative.title,
    altText: candidate.creative.altText,
    mediaUrl: candidate.creative.mediaUrl,
    thumbnailUrl: candidate.creative.thumbnailUrl,
    widthPx: candidate.creative.widthPx,
    heightPx: candidate.creative.heightPx,
    displayOrder: candidate.creative.displayOrder,
    isPrimary: candidate.creative.isPrimary
  };
}

function mapFormat(
  candidate: AdvertisementDeliveryCandidate
): AdvertisementDeliveryFormat | null {
  if (candidate.format === null) {
    return null;
  }

  return {
    id: candidate.format.id,
    code: candidate.format.code,
    displayName: candidate.format.displayName,
    description: null,
    widthPx: candidate.format.widthPx,
    heightPx: candidate.format.heightPx,
    mobileWidthPx: candidate.format.mobileWidthPx,
    mobileHeightPx: candidate.format.mobileHeightPx,
    isResponsive: candidate.format.isResponsive
  };
}

function mapTargeting(
  targets: AdvertisementDeliveryTargetRow[]
): AdvertisementDeliveryTargeting[] {
  return targets.map((target) => ({
    id: target.id,
    targetType: target.targetType,
    targetValue: target.targetValue,
    isInclude: target.isInclude
  }));
}

function mapAdvertisement(
  candidate: AdvertisementDeliveryCandidate
): AdvertisementDeliveryItem {
  const aggregatedCreatives = (candidate.creatives ?? [])
    .filter((creative) => creative.mediaUrl.trim().length > 0)
    .map(mapCreative);

  const legacyCreative = mapLegacyCreative(candidate);

  // Preserve compatibility with repository results that only populate
  // the legacy singular creative field.
  const creatives =
    aggregatedCreatives.length > 0
      ? aggregatedCreatives
      : legacyCreative === null
        ? []
        : [legacyCreative];

  return {
    advertisementId: candidate.advertisementId,
    name: candidate.advertisementName,
    advertisementType: candidate.advertisementType,
    destinationUrl: candidate.destinationUrl,
    priority: candidate.priority,
    openInNewTab: candidate.openInNewTab,
    isClickable: candidate.isClickable,
    isHouseAd: candidate.isHouseAd,
    schedulePriority: candidate.schedulePriority,
    placementRuleId: candidate.placementRuleId,
    placementRuleDisplayOrder: candidate.placementRuleDisplayOrder,
    placementRuleInsertionType: candidate.placementRuleInsertionType,
    insertionPosition: candidate.insertionPosition,
    maxImpressions: candidate.maxImpressions,
    creative: legacyCreative,
    format: mapFormat(candidate),
    creatives,
    targeting: mapTargeting(candidate.targets)
  };
}

function createEmptyResponse(
  pageType: AdvertisementDeliveryPageType,
  placementType: AdvertisementDeliveryPlacementType
): AdvertisementDeliveryResponse {
  return {
    placement: {
      id: 0,
      code: "",
      displayName: "",
      description: null,
      pageType,
      placementType,
      insertionType: "FIXED",
      displayOrder: 0,
      collapseWhenEmpty: true,
      fallbackBehavior: "HIDE",
      displayFrequency: null,
      frequencyValue: null,
      autoCloseEnabled: false,
      autoCloseSeconds: null,
      closeButtonEnabled: true,
      closeOnOverlayClick: true,
      isEnabled: false,
      rotationEnabled: false,
      rotationMode: "TIME_BASED",
      rotationIntervalSeconds: 10,
      rotationStrategy: "ROUND_ROBIN"
    },
    advertisements: [],
    fallbackApplied: false
  };
}

export async function getEligibleAdvertisements(
  request: AdvertisementDeliveryRequest
): Promise<AdvertisementDeliveryResponse> {
  if (!isValidPlacementForPage(request.pageType, request.placementType)) {
    throw new Error(
      `Placement type ${request.placementType} is not valid for page type ${request.pageType}.`
    );
  }

  const context = normalizeContext(request.context);

  const requestedPlacementId =
    request.placementId === undefined ? undefined : Number(request.placementId);

  let requestedPlacement: AdvertisementDeliveryPlacement | null = null;

  if (requestedPlacementId !== undefined) {
    const placement = await placementRepository.findById(requestedPlacementId);

    if (
      placement === null ||
      placement.pageType !== request.pageType ||
      placement.placementType !== request.placementType ||
      placement.status !== "ACTIVE" ||
      !placement.isEnabled
    ) {
      return {
        placement: null,
        advertisements: [],
        fallbackApplied: false
      };
    }

    requestedPlacement = mapPlacementEntity(placement);
  }

  const paidCandidates = await deliveryRepository.findEligibleCandidates(
    request.pageType,
    request.placementType,
    requestedPlacementId,
    context
  );

  const getPlacementCandidates = (
    candidates: AdvertisementDeliveryCandidate[]
  ): AdvertisementDeliveryCandidate[] => {
    if (requestedPlacementId === undefined) {
      return candidates;
    }

    return candidates.filter(
      (candidate) => candidate.placementId === requestedPlacementId
    );
  };

  const getEligibleCandidates = (
    candidates: AdvertisementDeliveryCandidate[]
  ): {
    placementCandidate: AdvertisementDeliveryCandidate | undefined;
    candidates: AdvertisementDeliveryCandidate[];
  } => {
    const requestedPlacementCandidates = getPlacementCandidates(candidates);

    if (requestedPlacementCandidates.length === 0) {
      return {
        placementCandidate: undefined,
        candidates: []
      };
    }

    const firstPlacementCandidate = requestedPlacementCandidates[0];

    if (firstPlacementCandidate === undefined) {
      return {
        placementCandidate: undefined,
        candidates: []
      };
    }

    const firstPlacement = firstPlacementCandidate.placementId;

    const placementCandidates = requestedPlacementCandidates.filter(
      (candidate) => candidate.placementId === firstPlacement
    );

    const placementCandidate = placementCandidates[0];

    if (placementCandidate === undefined) {
      return {
        placementCandidate: undefined,
        candidates: []
      };
    }

    const placementRotation = getRotationSettings(
      requestedPlacement,
      placementCandidate
    );

    const targetedCandidates = placementCandidates.filter((candidate) =>
      matchesTargeting(candidate.targets, context)
    );

    const creativeCandidates = targetedCandidates.filter(hasUsableCreative);

    if (creativeCandidates.length === 0) {
      return {
        placementCandidate,
        candidates: []
      };
    }

    let eligibleCandidates: AdvertisementDeliveryCandidate[];

    if (placementRotation.rotationEnabled) {
      // Only explicitly active rotation members can be delivered when
      // advertisement rotation is enabled.
      const activeMemberCandidates = creativeCandidates.filter(
        (candidate) =>
          candidate.rotationMemberId !== null &&
          candidate.rotationMemberId !== undefined
      );

      eligibleCandidates = deduplicateCandidates(activeMemberCandidates, true);

      // Membership priority controls rotation ordering; schedule priority
      // must not reorder rotation members.
      eligibleCandidates.sort((a, b) => {
        const priorityDifference =
          (a.rotationPriority ?? Number.MAX_SAFE_INTEGER) -
          (b.rotationPriority ?? Number.MAX_SAFE_INTEGER);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return a.advertisementId - b.advertisementId;
      });
    } else {
      eligibleCandidates = deduplicateCandidates(creativeCandidates, false);

      // Preserve the existing ordering when rotation is disabled.
      eligibleCandidates.sort((a, b) => {
        if (b.schedulePriority !== a.schedulePriority) {
          return b.schedulePriority - a.schedulePriority;
        }

        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }

        if (a.placementRuleDisplayOrder !== b.placementRuleDisplayOrder) {
          return a.placementRuleDisplayOrder - b.placementRuleDisplayOrder;
        }

        return a.advertisementId - b.advertisementId;
      });
    }

    return {
      placementCandidate,
      candidates: eligibleCandidates
    };
  };

  const paidSelection = getEligibleCandidates(paidCandidates);

  if (paidSelection.candidates.length > 0) {
    const placementCandidate = paidSelection.placementCandidate;

    if (placementCandidate === undefined) {
      return createEmptyResponse(request.pageType, request.placementType);
    }

    return {
      placement: requestedPlacement ?? mapPlacement(placementCandidate),
      advertisements: paidSelection.candidates.map(mapAdvertisement),
      fallbackApplied: false
    };
  }

  const paidPlacementCandidate = paidSelection.placementCandidate;

  const canUseHouseFallback =
    requestedPlacement?.fallbackBehavior === "HOUSE_AD" ||
    paidPlacementCandidate?.fallbackBehavior === "HOUSE_AD" ||
    (requestedPlacement === null && paidPlacementCandidate === undefined);

  if (!canUseHouseFallback) {
    if (requestedPlacement !== null) {
      return {
        placement: requestedPlacement,
        advertisements: [],
        fallbackApplied: false
      };
    }

    if (paidPlacementCandidate !== undefined) {
      return {
        placement: mapPlacement(paidPlacementCandidate),
        advertisements: [],
        fallbackApplied: false
      };
    }

    return createEmptyResponse(request.pageType, request.placementType);
  }

  const houseCandidates =
    await deliveryRepository.findEligibleHouseAdCandidates(
      request.pageType,
      request.placementType,
      requestedPlacementId,
      context
    );

  const houseSelection = getEligibleCandidates(houseCandidates);

  if (houseSelection.candidates.length > 0) {
    const placementCandidate = houseSelection.placementCandidate;

    if (placementCandidate === undefined) {
      return createEmptyResponse(request.pageType, request.placementType);
    }

    return {
      placement: requestedPlacement ?? mapPlacement(placementCandidate),
      advertisements: houseSelection.candidates.map(mapAdvertisement),
      fallbackApplied: true
    };
  }

  if (requestedPlacement !== null) {
    return {
      placement: requestedPlacement,
      advertisements: [],
      fallbackApplied: false
    };
  }

  if (paidPlacementCandidate !== undefined) {
    return {
      placement: mapPlacement(paidPlacementCandidate),
      advertisements: [],
      fallbackApplied: false
    };
  }

  return createEmptyResponse(request.pageType, request.placementType);
}
