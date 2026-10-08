import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../../../shared/utils/apiErrorInfo.js";

import * as repository from "../placement.repository.js";
import * as service from "../placement.service.js";

import type {
  AdvertisementPlacement,
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "../placement.types.js";

vi.mock("../placement.repository.js", () => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByCode: vi.fn(),
  findActiveFormatById: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
}));

describe("Advertisement Placement Service", () => {
  const placement: AdvertisementPlacement = {
    id: 1,
    code: "HOME_TOP",
    displayName: "Homepage Top",
    description: "Homepage top advertisement",
    pageType: "HOME",
    placementType: "HOME_TOP",
    insertionType: "FIXED",
    displayOrder: 1,
    isEnabled: true,
    collapseWhenEmpty: true,
    fallbackBehavior: "HIDE",
    displayFrequency: "EVERY_VISIT",
    frequencyValue: null,
    autoCloseEnabled: false,
    autoCloseSeconds: null,
    closeButtonEnabled: true,
    closeOnOverlayClick: true,
    status: "ACTIVE",
    formatId: null,
    format: null,
    createdBy: 10,
    updatedBy: 10,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const activeFormat = {
    id: 1,
    code: "DESKTOP_BANNER_728X90",
    displayName: "Desktop Banner 728x90",
    description: "Desktop banner format",
    widthPx: 728,
    heightPx: 90,
    isResponsive: false
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(repository.findActiveFormatById).mockResolvedValue(activeFormat);
  });

  describe("getAll", () => {
    it("should return all placements", async () => {
      vi.mocked(repository.findAll).mockResolvedValue([placement]);

      const result = await service.getAll();

      expect(result).toEqual([placement]);
      expect(repository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("getById", () => {
    it("should return an existing placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue(placement);

      const result = await service.getById(1);

      expect(result).toEqual(placement);
      expect(repository.findById).toHaveBeenCalledWith(1);
    });

    it("should throw 404 when placement does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.getById(999)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );
    });
  });

  describe("create", () => {
    it("should create a placement", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP"
      };

      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue(placement);

      const result = await service.create(input, 10);

      expect(result).toEqual(placement);
      expect(repository.findByCode).toHaveBeenCalledWith("HOME_TOP");
      expect(repository.create).toHaveBeenCalledWith(input, 10);
      expect(repository.findActiveFormatById).not.toHaveBeenCalled();
    });

    it("should validate an explicitly supplied format", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP",
        formatId: 1
      };

      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue({
        ...placement,
        formatId: 1,
        format: activeFormat
      });

      const result = await service.create(input, 10);

      expect(result.formatId).toBe(1);
      expect(result.format).toEqual(activeFormat);
      expect(repository.findActiveFormatById).toHaveBeenCalledWith(1);
      expect(repository.create).toHaveBeenCalledWith(input, 10);
    });

    it("should reject an inactive or missing format", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP",
        formatId: 999
      };

      vi.mocked(repository.findActiveFormatById).mockResolvedValue(null);

      await expect(service.create(input, 10)).rejects.toEqual(
        new ApiError(400, "Advertisement format not found or is inactive.")
      );

      expect(repository.findByCode).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should allow a placement without a format", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP",
        formatId: null
      };

      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue(placement);

      const result = await service.create(input, 10);

      expect(result).toEqual(placement);
      expect(repository.findActiveFormatById).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith(input, 10);
    });

    it("should trim the code before duplicate checking", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "  HOME_TOP  ",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP"
      };

      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue(placement);

      await service.create(input, 10);

      expect(repository.findByCode).toHaveBeenCalledWith("HOME_TOP");
      expect(repository.create).toHaveBeenCalledWith(input, 10);
    });

    it("should reject duplicate placement code", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "HOME_TOP",
        displayName: "Homepage Top",
        pageType: "HOME",
        placementType: "HOME_TOP"
      };

      vi.mocked(repository.findByCode).mockResolvedValue(placement);

      await expect(service.create(input, 10)).rejects.toEqual(
        new ApiError(409, "Advertisement placement code already exists.")
      );

      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should require frequencyValue for ONCE_PER_PERIOD", async () => {
      const input = {
        code: "HOME_PERIOD",
        displayName: "Periodic Homepage Ad",
        pageType: "HOME",
        placementType: "HOME_TOP",
        displayFrequency: "ONCE_PER_PERIOD"
      } as CreateAdvertisementPlacementInput;

      await expect(service.create(input, 10)).rejects.toEqual(
        new ApiError(400, "frequencyValue is required for ONCE_PER_PERIOD.")
      );

      expect(repository.findByCode).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should require autoCloseSeconds when auto-close is enabled", async () => {
      const input = {
        code: "HOME_MODAL",
        displayName: "Homepage Modal",
        pageType: "HOME",
        placementType: "HOME_TOP",
        autoCloseEnabled: true
      } as CreateAdvertisementPlacementInput;

      await expect(service.create(input, 10)).rejects.toEqual(
        new ApiError(
          400,
          "autoCloseSeconds is required when autoCloseEnabled is true."
        )
      );

      expect(repository.findByCode).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("should reject autoCloseSeconds when auto-close is explicitly disabled", async () => {
      const input = {
        code: "HOME_MODAL",
        displayName: "Homepage Modal",
        pageType: "HOME",
        placementType: "HOME_TOP",
        autoCloseEnabled: false,
        autoCloseSeconds: 10
      } as CreateAdvertisementPlacementInput;

      await expect(service.create(input, 10)).rejects.toEqual(
        new ApiError(
          400,
          "autoCloseSeconds must be null or omitted when autoCloseEnabled is false."
        )
      );
    });

    it("should allow HOUSE_AD fallback behavior", async () => {
      const input: CreateAdvertisementPlacementInput = {
        code: "NEWS_LIST_SIDEBAR",
        displayName: "News List Sidebar",
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_SIDEBAR",
        fallbackBehavior: "HOUSE_AD"
      };

      const configuredPlacement: AdvertisementPlacement = {
        ...placement,
        code: "NEWS_LIST_SIDEBAR",
        displayName: "News List Sidebar",
        pageType: "NEWS_LIST",
        placementType: "NEWS_LIST_SIDEBAR",
        fallbackBehavior: "HOUSE_AD"
      };

      vi.mocked(repository.findByCode).mockResolvedValue(null);
      vi.mocked(repository.create).mockResolvedValue(configuredPlacement);

      const result = await service.create(input, 10);

      expect(result).toEqual(configuredPlacement);
      expect(repository.findByCode).toHaveBeenCalledWith("NEWS_LIST_SIDEBAR");
      expect(repository.create).toHaveBeenCalledWith(input, 10);
    });
  });

  describe("update", () => {
    it("should update an existing placement", async () => {
      const input: UpdateAdvertisementPlacementInput = {
        displayName: "Updated Homepage Top"
      };

      const updated = {
        ...placement,
        displayName: "Updated Homepage Top"
      };

      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(updated);

      const result = await service.update(1, input, 20);

      expect(result).toEqual(updated);
      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should validate a supplied format when updating", async () => {
      const input: UpdateAdvertisementPlacementInput = {
        formatId: 1
      };

      const updated = {
        ...placement,
        formatId: 1,
        format: activeFormat
      };

      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.findActiveFormatById).mockResolvedValue(
        activeFormat
      );
      vi.mocked(repository.update).mockResolvedValue(updated);

      const result = await service.update(1, input, 20);

      expect(result).toEqual(updated);
      expect(repository.findActiveFormatById).toHaveBeenCalledWith(1);
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should reject an inactive or missing format during update", async () => {
      const input: UpdateAdvertisementPlacementInput = {
        formatId: 999
      };

      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.findActiveFormatById).mockResolvedValue(null);

      await expect(service.update(1, input, 20)).rejects.toEqual(
        new ApiError(400, "Advertisement format not found or is inactive.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should allow explicitly removing the format", async () => {
      const input: UpdateAdvertisementPlacementInput = {
        formatId: null
      };

      const updated = {
        ...placement,
        formatId: null,
        format: null
      };

      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        formatId: 1,
        format: activeFormat
      });
      vi.mocked(repository.update).mockResolvedValue(updated);

      const result = await service.update(1, input, 20);

      expect(result).toEqual(updated);
      expect(repository.findActiveFormatById).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should allow changing fallback behavior to HOUSE_AD", async () => {
      const existing = {
        ...placement,
        fallbackBehavior: "HIDE" as const
      };

      const updated = {
        ...existing,
        fallbackBehavior: "HOUSE_AD" as const
      };

      const input: UpdateAdvertisementPlacementInput = {
        fallbackBehavior: "HOUSE_AD"
      };

      vi.mocked(repository.findById).mockResolvedValue(existing);
      vi.mocked(repository.update).mockResolvedValue(updated);

      const result = await service.update(1, input, 20);

      expect(result).toEqual(updated);
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should throw 404 when updating a missing placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.update(999, { displayName: "Updated" }, 20)
      ).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should require frequencyValue when changing to ONCE_PER_PERIOD", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        displayFrequency: "EVERY_VISIT"
      });

      const input = {
        displayFrequency: "ONCE_PER_PERIOD"
      } as UpdateAdvertisementPlacementInput;

      await expect(service.update(1, input, 20)).rejects.toEqual(
        new ApiError(
          400,
          "frequencyValue is required when changing displayFrequency to ONCE_PER_PERIOD."
        )
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should allow ONCE_PER_PERIOD when the existing placement already has that frequency", async () => {
      const existing = {
        ...placement,
        displayFrequency: "ONCE_PER_PERIOD" as const,
        frequencyValue: 5
      };

      vi.mocked(repository.findById).mockResolvedValue(existing);
      vi.mocked(repository.update).mockResolvedValue(existing);

      const input = {
        displayFrequency: "ONCE_PER_PERIOD"
      } as UpdateAdvertisementPlacementInput;

      const result = await service.update(1, input, 20);

      expect(result).toEqual(existing);
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should require autoCloseSeconds when enabling auto-close without an existing value", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        autoCloseEnabled: false,
        autoCloseSeconds: null
      });

      const input = {
        autoCloseEnabled: true
      } as UpdateAdvertisementPlacementInput;

      await expect(service.update(1, input, 20)).rejects.toEqual(
        new ApiError(
          400,
          "autoCloseSeconds is required when enabling auto-close."
        )
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should update when auto-close already has a configured duration", async () => {
      const existing = {
        ...placement,
        autoCloseEnabled: false,
        autoCloseSeconds: 15
      };

      vi.mocked(repository.findById).mockResolvedValue(existing);
      vi.mocked(repository.update).mockResolvedValue(existing);

      const input = {
        autoCloseEnabled: true
      } as UpdateAdvertisementPlacementInput;

      const result = await service.update(1, input, 20);

      expect(result).toEqual(existing);
      expect(repository.update).toHaveBeenCalledWith(1, input, 20);
    });

    it("should throw 404 if repository update returns null", async () => {
      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(null);

      await expect(
        service.update(1, { displayName: "Updated" }, 20)
      ).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );
    });
  });

  describe("deactivate", () => {
    it("should deactivate an active placement", async () => {
      const inactivePlacement = {
        ...placement,
        status: "INACTIVE" as const,
        isEnabled: false
      };

      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(inactivePlacement);

      const result = await service.deactivate(1, 20);

      expect(result).toEqual(inactivePlacement);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        20
      );
    });

    it("should throw 404 when deactivating a missing placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.deactivate(999, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should reject deactivation of an already inactive placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        status: "INACTIVE"
      });

      await expect(service.deactivate(1, 20)).rejects.toEqual(
        new ApiError(400, "Advertisement placement is already inactive.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw 404 if repository deactivation returns null", async () => {
      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(null);

      await expect(service.deactivate(1, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );
    });
  });

  describe("enable", () => {
    it("should enable an inactive placement", async () => {
      const inactivePlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: false
      };

      const enabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: true,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(inactivePlacement);
      vi.mocked(repository.update).mockResolvedValue(enabledPlacement);

      const result = await service.enable(1, 20);

      expect(result).toEqual(enabledPlacement);
      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "ACTIVE",
          isEnabled: true
        },
        20
      );
    });

    it("should enable a placement when status is inactive but isEnabled is still true", async () => {
      const inactivePlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: true
      };

      const enabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: true,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(inactivePlacement);
      vi.mocked(repository.update).mockResolvedValue(enabledPlacement);

      const result = await service.enable(1, 20);

      expect(result).toEqual(enabledPlacement);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "ACTIVE",
          isEnabled: true
        },
        20
      );
    });

    it("should enable a placement when status is active but isEnabled is false", async () => {
      const disabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: false
      };

      const enabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: true,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(disabledPlacement);
      vi.mocked(repository.update).mockResolvedValue(enabledPlacement);

      const result = await service.enable(1, 20);

      expect(result).toEqual(enabledPlacement);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "ACTIVE",
          isEnabled: true
        },
        20
      );
    });

    it("should reject enabling an already enabled placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        status: "ACTIVE",
        isEnabled: true
      });

      await expect(service.enable(1, 20)).rejects.toEqual(
        new ApiError(400, "Advertisement placement is already enabled.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw 404 when enabling a missing placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.enable(999, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw 404 if repository enable returns null", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        status: "INACTIVE",
        isEnabled: false
      });

      vi.mocked(repository.update).mockResolvedValue(null);

      await expect(service.enable(1, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );
    });
  });

  describe("disable", () => {
    it("should disable an active placement", async () => {
      const disabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: false,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(disabledPlacement);

      const result = await service.disable(1, 20);

      expect(result).toEqual(disabledPlacement);
      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        20
      );
    });

    it("should disable a placement when status is active but isEnabled is already false", async () => {
      const partiallyDisabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: false
      };

      const disabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: false,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(
        partiallyDisabledPlacement
      );
      vi.mocked(repository.update).mockResolvedValue(disabledPlacement);

      const result = await service.disable(1, 20);

      expect(result).toEqual(disabledPlacement);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        20
      );
    });

    it("should disable a placement when status is inactive but isEnabled is still true", async () => {
      const partiallyDisabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: true
      };

      const disabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: false,
        updatedBy: 20
      };

      vi.mocked(repository.findById).mockResolvedValue(
        partiallyDisabledPlacement
      );
      vi.mocked(repository.update).mockResolvedValue(disabledPlacement);

      const result = await service.disable(1, 20);

      expect(result).toEqual(disabledPlacement);
      expect(repository.update).toHaveBeenCalledWith(
        1,
        {
          status: "INACTIVE",
          isEnabled: false
        },
        20
      );
    });

    it("should reject disabling an already disabled placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue({
        ...placement,
        status: "INACTIVE",
        isEnabled: false
      });

      await expect(service.disable(1, 20)).rejects.toEqual(
        new ApiError(400, "Advertisement placement is already disabled.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw 404 when disabling a missing placement", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.disable(999, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );

      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw 404 if repository disable returns null", async () => {
      vi.mocked(repository.findById).mockResolvedValue(placement);
      vi.mocked(repository.update).mockResolvedValue(null);

      await expect(service.disable(1, 20)).rejects.toEqual(
        new ApiError(404, "Advertisement placement not found.")
      );
    });
  });
});
