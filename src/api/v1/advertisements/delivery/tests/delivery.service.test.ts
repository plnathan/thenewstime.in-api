import { beforeEach, describe, expect, it, vi } from "vitest";

import * as deliveryRepository from "../delivery.repository.js";
import * as placementRepository from "../../placements/placement.repository.js";

import { getEligibleAdvertisements } from "../delivery.service.js";

import type { AdvertisementDeliveryCandidate } from "../delivery.repository.js";
import type { AdvertisementPlacement } from "../../placements/placement.types.js";

vi.mock("../delivery.repository.js", () => ({
  findEligibleCandidates: vi.fn(),
  findEligibleHouseAdCandidates: vi.fn()
}));

vi.mock("../../placements/placement.repository.js", () => ({
  findById: vi.fn()
}));

const mockedFindEligibleCandidates = vi.mocked(
  deliveryRepository.findEligibleCandidates
);

const mockedFindEligibleHouseAdCandidates = vi.mocked(
  deliveryRepository.findEligibleHouseAdCandidates
);

const mockedFindPlacementById = vi.mocked(placementRepository.findById);

function createPlacement(
  overrides: Partial<AdvertisementPlacement> = {}
): AdvertisementPlacement {
  return {
    id: 15,
    code: "HOME_TOP",
    displayName: "Home Top",
    description: "Advertisement at the top of homepage",
    pageType: "HOME",
    placementType: "HOME_TOP",
    insertionType: "FIXED",
    displayOrder: 1,
    isEnabled: true,
    collapseWhenEmpty: true,
    fallbackBehavior: "HIDE",
    displayFrequency: null,
    frequencyValue: null,
    autoCloseEnabled: false,
    autoCloseSeconds: null,
    closeButtonEnabled: true,
    closeOnOverlayClick: true,
    status: "ACTIVE",
    formatId: null,
    format: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createCandidate(
  overrides: Partial<AdvertisementDeliveryCandidate> = {}
): AdvertisementDeliveryCandidate {
  return {
    advertisementId: 100,
    advertisementName: "Test Advertisement",
    advertisementType: "DISPLAY",
    destinationUrl: "https://example.com",
    priority: 10,
    openInNewTab: true,
    isClickable: true,
    isHouseAd: false,

    placementId: 10,
    placementCode: "NEWS_DETAIL_TOP",
    placementDisplayName: "News Detail Top",
    placementDescription: "Advertisement at the top of news detail",
    pageType: "NEWS_DETAIL",
    placementType: "NEWS_DETAIL_TOP",
    placementInsertionType: "FIXED",
    placementDisplayOrder: 1,
    collapseWhenEmpty: true,
    fallbackBehavior: "HIDE",
    displayFrequency: null,
    frequencyValue: null,
    autoCloseEnabled: false,
    autoCloseSeconds: null,
    closeButtonEnabled: true,
    closeOnOverlayClick: true,

    placementRuleId: 20,
    placementRuleDisplayOrder: 1,
    placementRuleInsertionType: null,
    insertionPosition: null,
    maxImpressions: null,

    scheduleId: 30,
    schedulePriority: 5,

    creative: {
      id: 40,
      creativeType: "IMAGE",
      variant: "DESKTOP",
      title: "Test Creative",
      altText: "Test advertisement",
      mediaUrl: "https://cdn.example.com/ad.jpg",
      thumbnailUrl: "https://cdn.example.com/ad-thumb.jpg",
      widthPx: 728,
      heightPx: 90,
      displayOrder: 1,
      isPrimary: true
    },

    format: {
      id: 50,
      code: "LEADERBOARD",
      displayName: "Leaderboard",
      description: "728x90 leaderboard",
      widthPx: 728,
      heightPx: 90,
      mobileWidthPx: 320,
      mobileHeightPx: 100,
      isResponsive: true
    },

    targets: [],

    ...overrides
  };
}

describe("Advertisement Delivery Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFindEligibleHouseAdCandidates.mockResolvedValue([]);
  });

  it("should retrieve eligible advertisements for a valid page and placement", async () => {
    const candidate = createCandidate();

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(mockedFindEligibleCandidates).toHaveBeenCalledWith(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      undefined
    );

    expect(result.placement).not.toBeNull();
    expect(result.placement?.id).toBe(10);
    expect(result.placement?.code).toBe("NEWS_DETAIL_TOP");
    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should reject an invalid page and placement combination", async () => {
    await expect(
      getEligibleAdvertisements({
        pageType: "HOME",
        placementType: "NEWS_DETAIL_TOP"
      })
    ).rejects.toThrow(
      "Placement type NEWS_DETAIL_TOP is not valid for page type HOME."
    );

    expect(mockedFindEligibleCandidates).not.toHaveBeenCalled();
    expect(mockedFindEligibleHouseAdCandidates).not.toHaveBeenCalled();
    expect(mockedFindPlacementById).not.toHaveBeenCalled();
  });

  it("should return an empty response when no candidates are found", async () => {
    mockedFindEligibleCandidates.mockResolvedValue([]);

    const result = await getEligibleAdvertisements({
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    expect(result).toEqual({
      placement: {
        id: 0,
        code: "",
        displayName: "",
        description: null,
        pageType: "HOME",
        placementType: "HOME_TOP",
        insertionType: "FIXED",
        displayOrder: 0,
        collapseWhenEmpty: true,
        fallbackBehavior: "HIDE",
        displayFrequency: null,
        frequencyValue: null,
        autoCloseEnabled: false,
        autoCloseSeconds: null,
        closeButtonEnabled: true,
        closeOnOverlayClick: true
      },
      advertisements: [],
      fallbackApplied: false
    });
  });

  it("should pass placementId to the repository", async () => {
    const candidate = createCandidate({
      placementId: 15,
      placementCode: "HOME_TOP",
      placementDisplayName: "Home Top",
      placementDescription: "Advertisement at the top of homepage",
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    mockedFindPlacementById.mockResolvedValue(
      createPlacement({
        id: 15,
        code: "HOME_TOP",
        displayName: "Home Top",
        description: "Advertisement at the top of homepage",
        pageType: "HOME",
        placementType: "HOME_TOP"
      })
    );

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "HOME",
      placementType: "HOME_TOP",
      placementId: 15
    });

    expect(mockedFindPlacementById).toHaveBeenCalledWith(15);

    expect(mockedFindEligibleCandidates).toHaveBeenCalledWith(
      "HOME",
      "HOME_TOP",
      15,
      undefined
    );

    expect(result.placement).not.toBeNull();
    expect(result.placement?.id).toBe(15);
    expect(result.placement?.code).toBe("HOME_TOP");
    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should return an empty response when the requested placement is not present", async () => {
    mockedFindPlacementById.mockResolvedValue(null);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      placementId: 99
    });

    expect(mockedFindPlacementById).toHaveBeenCalledWith(99);

    expect(mockedFindEligibleCandidates).not.toHaveBeenCalled();

    expect(result).toEqual({
      placement: null,
      advertisements: [],
      fallbackApplied: false
    });
  });

  it("should include an advertisement when an include target matches the context", async () => {
    const candidate = createCandidate({
      targets: [
        {
          id: 1,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        }
      ]
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        state: " tamil-nadu "
      }
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.advertisements[0]?.advertisementId).toBe(100);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should exclude an advertisement when an exclude target matches the context", async () => {
    const candidate = createCandidate({
      targets: [
        {
          id: 1,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: false
        }
      ]
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        state: "tamil-nadu"
      }
    });

    expect(result.placement).not.toBeNull();
    expect(result.advertisements).toHaveLength(0);
    expect(result.placement?.id).toBe(10);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should require at least one include target to match when include targets exist", async () => {
    const candidate = createCandidate({
      targets: [
        {
          id: 1,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        },
        {
          id: 2,
          targetType: "COUNTRY",
          targetValue: "India",
          isInclude: true
        }
      ]
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        state: "Kerala",
        country: "India"
      }
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should return no advertisements when include targets do not match", async () => {
    const candidate = createCandidate({
      targets: [
        {
          id: 1,
          targetType: "STATE",
          targetValue: "tamil-nadu",
          isInclude: true
        }
      ]
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        state: "Kerala"
      }
    });

    expect(result.placement).not.toBeNull();
    expect(result.advertisements).toHaveLength(0);
    expect(result.placement?.id).toBe(10);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should allow an advertisement with only non-matching exclude targets", async () => {
    const candidate = createCandidate({
      targets: [
        {
          id: 1,
          targetType: "STATE",
          targetValue: "Kerala",
          isInclude: false
        }
      ]
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        state: "Tamil Nadu"
      }
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should allow advertisements without targets", async () => {
    const candidate = createCandidate({
      targets: []
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should exclude an advertisement without usable creative", async () => {
    const candidate = createCandidate({
      creative: null
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.placement).not.toBeNull();
    expect(result.advertisements).toHaveLength(0);
    expect(result.placement?.id).toBe(10);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should exclude an advertisement when the creative media URL is empty", async () => {
    const candidate = createCandidate({
      creative: {
        id: 40,
        creativeType: "IMAGE",
        variant: "DESKTOP",
        title: "Invalid Creative",
        altText: "Invalid",
        mediaUrl: "   ",
        thumbnailUrl: null,
        widthPx: 728,
        heightPx: 90,
        displayOrder: 1,
        isPrimary: true
      }
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(0);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should exclude an advertisement when its format has an empty code", async () => {
    const candidate = createCandidate({
      format: {
        id: 50,
        code: "   ",
        displayName: "Invalid Format",
        description: null,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        isResponsive: true
      }
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(0);
    expect(result.fallbackApplied).toBe(false);
  });

  it("should allow a usable creative without a format", async () => {
    const candidate = createCandidate({
      format: null
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.advertisements[0]?.creative?.formatId).toBeNull();
    expect(result.advertisements[0]?.format).toBeNull();
    expect(result.fallbackApplied).toBe(false);
  });

  it("should deduplicate advertisements and retain the higher schedule priority candidate", async () => {
    const lowerPriorityCandidate = createCandidate({
      scheduleId: 30,
      schedulePriority: 5,
      priority: 100,
      placementRuleId: 20
    });

    const higherPriorityCandidate = createCandidate({
      scheduleId: 31,
      schedulePriority: 10,
      priority: 1,
      placementRuleId: 21,
      placementRuleDisplayOrder: 2
    });

    mockedFindEligibleCandidates.mockResolvedValue([
      lowerPriorityCandidate,
      higherPriorityCandidate
    ]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
    expect(result.advertisements[0]).toMatchObject({
      advertisementId: 100,
      schedulePriority: 10,
      placementRuleId: 21
    });
  });

  it("should use advertisement priority when schedule priorities are equal", async () => {
    const lowerAdvertisementPriority = createCandidate({
      scheduleId: 30,
      schedulePriority: 10,
      priority: 5,
      placementRuleId: 20
    });

    const higherAdvertisementPriority = createCandidate({
      scheduleId: 31,
      schedulePriority: 10,
      priority: 20,
      placementRuleId: 21
    });

    mockedFindEligibleCandidates.mockResolvedValue([
      lowerAdvertisementPriority,
      higherAdvertisementPriority
    ]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements).toHaveLength(1);
    expect(result.fallbackApplied).toBe(false);
    expect(result.advertisements[0]).toMatchObject({
      advertisementId: 100,
      schedulePriority: 10,
      priority: 20,
      placementRuleId: 21
    });
  });

  it("should sort advertisements by schedule priority, advertisement priority, rule order, and advertisement id", async () => {
    const candidateA = createCandidate({
      advertisementId: 101,
      schedulePriority: 5,
      priority: 10,
      placementRuleDisplayOrder: 3
    });

    const candidateB = createCandidate({
      advertisementId: 102,
      schedulePriority: 10,
      priority: 1,
      placementRuleDisplayOrder: 3
    });

    const candidateC = createCandidate({
      advertisementId: 103,
      schedulePriority: 10,
      priority: 20,
      placementRuleDisplayOrder: 2
    });

    const candidateD = createCandidate({
      advertisementId: 104,
      schedulePriority: 10,
      priority: 20,
      placementRuleDisplayOrder: 3
    });

    mockedFindEligibleCandidates.mockResolvedValue([
      candidateA,
      candidateB,
      candidateC,
      candidateD
    ]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(
      result.advertisements.map(
        (advertisement) => advertisement.advertisementId
      )
    ).toEqual([103, 104, 102, 101]);

    expect(result.fallbackApplied).toBe(false);
  });

  it("should map placement, creative, format, and advertisement fields correctly", async () => {
    const candidate = createCandidate({
      placementRuleInsertionType: "AFTER_N_ITEMS",
      insertionPosition: 3,
      maxImpressions: 1000,
      placementInsertionType: "FIXED",
      destinationUrl: "https://advertiser.example.com",
      openInNewTab: false,
      isClickable: true,
      displayFrequency: "ONCE_PER_SESSION",
      frequencyValue: 1,
      autoCloseEnabled: true,
      autoCloseSeconds: 8,
      closeButtonEnabled: true,
      closeOnOverlayClick: false,
      creative: {
        id: 40,
        creativeType: "IMAGE",
        variant: "DESKTOP",
        title: "Test Creative",
        altText: "Test advertisement",
        mediaUrl: "https://cdn.example.com/ad.jpg",
        thumbnailUrl: "https://cdn.example.com/ad-thumb.jpg",
        widthPx: 728,
        heightPx: 90,
        displayOrder: 1,
        isPrimary: true
      },
      format: {
        id: 50,
        code: "LEADERBOARD",
        displayName: "Leaderboard",
        description: "728x90 leaderboard",
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        isResponsive: true
      }
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.placement).toEqual({
      id: 10,
      code: "NEWS_DETAIL_TOP",
      displayName: "News Detail Top",
      description: "Advertisement at the top of news detail",
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      insertionType: "FIXED",
      displayOrder: 1,
      collapseWhenEmpty: true,
      fallbackBehavior: "HIDE",
      displayFrequency: "ONCE_PER_SESSION",
      frequencyValue: 1,
      autoCloseEnabled: true,
      autoCloseSeconds: 8,
      closeButtonEnabled: true,
      closeOnOverlayClick: false
    });

    expect(result.advertisements[0]).toEqual({
      advertisementId: 100,
      name: "Test Advertisement",
      advertisementType: "DISPLAY",
      destinationUrl: "https://advertiser.example.com",
      priority: 10,
      openInNewTab: false,
      isClickable: true,
      isHouseAd: false,
      schedulePriority: 5,
      placementRuleId: 20,
      placementDisplayOrder: 1,
      insertionType: "AFTER_N_ITEMS",
      insertionPosition: 3,
      maxImpressions: 1000,
      creative: {
        id: 40,
        formatId: 50,
        creativeType: "IMAGE",
        variant: "DESKTOP",
        title: "Test Creative",
        altText: "Test advertisement",
        mediaUrl: "https://cdn.example.com/ad.jpg",
        thumbnailUrl: "https://cdn.example.com/ad-thumb.jpg",
        widthPx: 728,
        heightPx: 90,
        displayOrder: 1,
        isPrimary: true
      },
      format: {
        id: 50,
        code: "LEADERBOARD",
        displayName: "Leaderboard",
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        isResponsive: true
      }
    });

    expect(result.fallbackApplied).toBe(false);
  });

  it("should preserve the mobile creative variant when mapping delivery data", async () => {
    const candidate = createCandidate({
      creative: {
        id: 41,
        creativeType: "IMAGE",
        variant: "MOBILE",
        title: "Mobile Creative",
        altText: "Mobile advertisement",
        mediaUrl: "https://cdn.example.com/ad-mobile.jpg",
        thumbnailUrl: "https://cdn.example.com/ad-mobile-thumb.jpg",
        widthPx: 320,
        heightPx: 100,
        displayOrder: 1,
        isPrimary: false
      }
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements[0]?.creative).toMatchObject({
      id: 41,
      creativeType: "IMAGE",
      variant: "MOBILE",
      widthPx: 320,
      heightPx: 100
    });
  });

  it("should preserve mobile format dimensions when mapping delivery data", async () => {
    const candidate = createCandidate({
      format: {
        id: 50,
        code: "LEADERBOARD",
        displayName: "Leaderboard",
        description: "Responsive leaderboard",
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        isResponsive: true
      }
    });

    mockedFindEligibleCandidates.mockResolvedValue([candidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(result.advertisements[0]?.format).toMatchObject({
      id: 50,
      widthPx: 728,
      heightPx: 90,
      mobileWidthPx: 320,
      mobileHeightPx: 100
    });
  });

  it("should normalize targeting context before querying the repository", async () => {
    mockedFindEligibleCandidates.mockResolvedValue([]);

    await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        site: " TheNewsTime.in ",
        category: " Politics ",
        state: " Tamil Nadu ",
        district: " Tiruppur ",
        country: " India ",
        newsId: 123
      }
    });

    expect(mockedFindEligibleCandidates).toHaveBeenCalledWith(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      {
        site: "thenewstime.in",
        category: "politics",
        state: "tamil nadu",
        district: "tiruppur",
        country: "india",
        newsId: 123
      }
    );
  });

  it("should pass an undefined context to the repository when no context is supplied", async () => {
    mockedFindEligibleCandidates.mockResolvedValue([]);

    await getEligibleAdvertisements({
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    expect(mockedFindEligibleCandidates).toHaveBeenCalledWith(
      "HOME",
      "HOME_TOP",
      undefined,
      undefined
    );
  });

  it("should apply a house advertisement when the placement fallback behavior is HOUSE_AD", async () => {
    const houseCandidate = createCandidate({
      advertisementId: 200,
      advertisementName: "House Advertisement",
      isHouseAd: true,
      fallbackBehavior: "HOUSE_AD"
    });

    mockedFindEligibleCandidates.mockResolvedValue([
      createCandidate({
        fallbackBehavior: "HOUSE_AD",
        creative: null
      })
    ]);

    mockedFindEligibleHouseAdCandidates.mockResolvedValue([houseCandidate]);

    const result = await getEligibleAdvertisements({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(mockedFindEligibleHouseAdCandidates).toHaveBeenCalledWith(
      "NEWS_DETAIL",
      "NEWS_DETAIL_TOP",
      undefined,
      undefined
    );

    expect(result.advertisements).toHaveLength(1);
    expect(result.advertisements[0]?.advertisementId).toBe(200);
    expect(result.advertisements[0]?.isHouseAd).toBe(true);
    expect(result.fallbackApplied).toBe(true);
  });

  it("should never mark fallbackApplied when house fallback produces no advertisement", async () => {
    mockedFindEligibleCandidates.mockResolvedValue([]);

    mockedFindEligibleHouseAdCandidates.mockResolvedValue([]);

    const result = await getEligibleAdvertisements({
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    expect(result.advertisements).toHaveLength(0);
    expect(result.fallbackApplied).toBe(false);
  });
});
