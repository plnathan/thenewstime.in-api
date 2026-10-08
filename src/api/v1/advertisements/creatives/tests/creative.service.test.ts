import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdvertisementCreative,
  AdvertisementCreativePreview,
  AdvertisementCreativePreviewResponse,
  CreateAdvertisementCreativeInput
} from "../creative.types.js";

const repositoryMock = vi.hoisted(() => ({
  findById: vi.fn(),
  findByAdvertisementId: vi.fn(),
  findActiveByAdvertisementId: vi.fn(),
  findActiveByAdvertisementAndVariant: vi.fn(),
  findByAdvertisementAndVariant: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  clearPrimaryForVariant: vi.fn(),
  remove: vi.fn(),
  findAdvertisement: vi.fn(),
  findFormat: vi.fn()
}));

const poolMock = vi.hoisted(() => ({
  connect: vi.fn()
}));

vi.mock("../creative.repository.js", () => repositoryMock);

vi.mock("../../../../../shared/config/db.js", () => ({
  pool: poolMock
}));

import * as service from "../creative.service.js";

function createCreative(
  overrides: Partial<AdvertisementCreative> = {}
): AdvertisementCreative {
  return {
    id: 1,
    advertisementId: 10,
    formatId: 20,
    creativeType: "IMAGE",
    variant: "DESKTOP",
    title: "Test Creative",
    altText: "Test advertisement",
    mediaUrl: "https://cdn.example.com/ad.jpg",
    thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    widthPx: 728,
    heightPx: 90,
    displayOrder: 1,
    isPrimary: true,
    status: "ACTIVE",
    createdBy: 100,
    updatedBy: 100,
    createdAt: new Date("2026-09-27T00:00:00.000Z"),
    updatedAt: new Date("2026-09-27T00:00:00.000Z"),
    ...overrides
  };
}

function createClient() {
  return {
    query: vi.fn(),
    release: vi.fn()
  };
}

function createValidCreateInput(
  overrides: Partial<CreateAdvertisementCreativeInput> = {}
): CreateAdvertisementCreativeInput {
  return {
    formatId: 20,
    creativeType: "IMAGE",
    variant: "DESKTOP",
    title: "  Test Creative  ",
    altText: "  Test Alt Text  ",
    mediaUrl: "  https://cdn.example.com/ad.jpg  ",
    thumbnailUrl: "  https://cdn.example.com/thumb.jpg  ",
    widthPx: 728,
    heightPx: 90,
    displayOrder: 1,
    isPrimary: true,
    status: "ACTIVE",
    ...overrides
  };
}

describe("Advertisement Creative Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    poolMock.connect.mockImplementation(async () => createClient());

    repositoryMock.findAdvertisement.mockResolvedValue({
      id: 10,
      workflowStatus: "DRAFT",
      status: "DRAFT"
    });

    repositoryMock.findFormat.mockResolvedValue({
      id: 20,
      widthPx: 728,
      heightPx: 90,
      mobileWidthPx: 320,
      mobileHeightPx: 100,
      status: "ACTIVE"
    });

    repositoryMock.clearPrimaryForVariant.mockResolvedValue(undefined);
    repositoryMock.create.mockResolvedValue(createCreative());
    repositoryMock.update.mockResolvedValue(createCreative());
    repositoryMock.remove.mockResolvedValue(
      createCreative({
        status: "INACTIVE",
        isPrimary: false
      })
    );
  });

  describe("getById", () => {
    it("should return a creative belonging to the advertisement", async () => {
      const creative = createCreative();

      repositoryMock.findById.mockResolvedValue(creative);

      const result = await service.getById(10, 1);

      expect(result).toBe(creative);
      expect(repositoryMock.findById).toHaveBeenCalledWith(1);
    });

    it("should reject an invalid advertisement id", async () => {
      await expect(service.getById(0, 1)).rejects.toThrow(
        "advertisementId must be a positive integer."
      );

      expect(repositoryMock.findById).not.toHaveBeenCalled();
    });

    it("should reject an invalid creative id", async () => {
      await expect(service.getById(10, 0)).rejects.toThrow(
        "creativeId must be a positive integer."
      );
    });

    it("should reject a creative belonging to another advertisement", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          advertisementId: 99
        })
      );

      await expect(service.getById(10, 1)).rejects.toThrow(
        "Advertisement creative not found."
      );
    });

    it("should reject a missing creative", async () => {
      repositoryMock.findById.mockResolvedValue(null);

      await expect(service.getById(10, 1)).rejects.toThrow(
        "Advertisement creative not found."
      );
    });
  });

  describe("getAll", () => {
    it("should return all creatives for an existing advertisement", async () => {
      const creatives = [createCreative()];

      repositoryMock.findByAdvertisementId.mockResolvedValue(creatives);

      const result = await service.getAll(10);

      expect(result).toBe(creatives);
      expect(repositoryMock.findAdvertisement).toHaveBeenCalledWith(10);
      expect(repositoryMock.findByAdvertisementId).toHaveBeenCalledWith(10);
    });

    it("should reject when advertisement does not exist", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue(null);

      await expect(service.getAll(10)).rejects.toThrow(
        "Advertisement not found."
      );

      expect(repositoryMock.findByAdvertisementId).not.toHaveBeenCalled();
    });
  });

  describe("getActive", () => {
    it("should return active creatives", async () => {
      const creatives = [
        createCreative({
          status: "ACTIVE"
        })
      ];

      repositoryMock.findActiveByAdvertisementId.mockResolvedValue(creatives);

      const result = await service.getActive(10);

      expect(result).toBe(creatives);
      expect(repositoryMock.findActiveByAdvertisementId).toHaveBeenCalledWith(
        10
      );
    });

    it("should reject when advertisement does not exist", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue(null);

      await expect(service.getActive(10)).rejects.toThrow(
        "Advertisement not found."
      );
    });
  });

  describe("create", () => {
    it("should create a creative successfully", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const input = createValidCreateInput();

      const result = await service.create(10, input, 100);

      expect(result).toEqual(createCreative());

      expect(repositoryMock.clearPrimaryForVariant).toHaveBeenCalledWith(
        10,
        "DESKTOP",
        undefined,
        client
      );

      expect(repositoryMock.create).toHaveBeenCalledWith(
        10,
        {
          ...input,
          title: "Test Creative",
          altText: "Test Alt Text",
          mediaUrl: "https://cdn.example.com/ad.jpg",
          thumbnailUrl: "https://cdn.example.com/thumb.jpg"
        },
        100,
        client
      );

      expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT");
      expect(client.release).toHaveBeenCalled();
    });

    it("should default the primary-clearing variant to DESKTOP", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const input = createValidCreateInput({
        variant: undefined
      });

      await service.create(10, input, 100);

      expect(repositoryMock.clearPrimaryForVariant).toHaveBeenCalledWith(
        10,
        "DESKTOP",
        undefined,
        client
      );
    });

    it("should not clear primary when isPrimary is false", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const input = createValidCreateInput({
        isPrimary: false
      });

      await service.create(10, input, 100);

      expect(repositoryMock.clearPrimaryForVariant).not.toHaveBeenCalled();
    });

    it("should allow REJECTED advertisements to be modified", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      repositoryMock.findAdvertisement.mockResolvedValue({
        id: 10,
        workflowStatus: "REJECTED",
        status: "DRAFT"
      });

      await service.create(
        10,
        createValidCreateInput({
          isPrimary: false
        }),
        100
      );

      expect(repositoryMock.create).toHaveBeenCalled();
    });

    it("should reject creation for a missing advertisement", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue(null);

      await expect(
        service.create(10, createValidCreateInput(), 100)
      ).rejects.toThrow("Advertisement not found.");

      expect(poolMock.connect).not.toHaveBeenCalled();
    });

    it("should reject creation when advertisement is not editable", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue({
        id: 10,
        workflowStatus: "SUBMITTED",
        status: "DRAFT"
      });

      await expect(
        service.create(10, createValidCreateInput(), 100)
      ).rejects.toThrow(
        "Advertisement creatives cannot be modified while advertisement workflow status is 'SUBMITTED'."
      );

      expect(poolMock.connect).not.toHaveBeenCalled();
    });

    it("should reject an inactive format", async () => {
      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "INACTIVE"
      });

      await expect(
        service.create(10, createValidCreateInput(), 100)
      ).rejects.toThrow("Advertisement format is inactive.");
    });

    it("should reject a missing format", async () => {
      repositoryMock.findFormat.mockResolvedValue(null);

      await expect(
        service.create(10, createValidCreateInput(), 100)
      ).rejects.toThrow("Advertisement format not found.");
    });

    it("should allow creation without a format", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const input = createValidCreateInput({
        formatId: null,
        isPrimary: false
      });

      await service.create(10, input, 100);

      expect(repositoryMock.findFormat).not.toHaveBeenCalled();
      expect(repositoryMock.create).toHaveBeenCalled();
    });

    it("should reject empty HTML creative content", async () => {
      await expect(
        service.create(
          10,
          createValidCreateInput({
            creativeType: "HTML",
            mediaUrl: "   "
          }),
          100
        )
      ).rejects.toThrow("HTML creative content cannot be empty.");
    });

    it("should reject empty TEXT creative content", async () => {
      await expect(
        service.create(
          10,
          createValidCreateInput({
            creativeType: "TEXT",
            mediaUrl: "   "
          }),
          100
        )
      ).rejects.toThrow("TEXT creative content cannot be empty.");
    });

    it("should reject an invalid width", async () => {
      await expect(
        service.create(
          10,
          createValidCreateInput({
            widthPx: 0
          }),
          100
        )
      ).rejects.toThrow("widthPx must be a positive integer.");
    });

    it("should reject an invalid height", async () => {
      await expect(
        service.create(
          10,
          createValidCreateInput({
            heightPx: -1
          }),
          100
        )
      ).rejects.toThrow("heightPx must be a positive integer.");
    });

    it("should rollback when repository creation fails", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const error = new Error("Insert failed");

      repositoryMock.create.mockRejectedValue(error);

      await expect(
        service.create(
          10,
          createValidCreateInput({
            isPrimary: false
          }),
          100
        )
      ).rejects.toThrow("Insert failed");

      expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update an existing creative", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      const existing = createCreative({
        isPrimary: false
      });

      repositoryMock.findById.mockResolvedValue(existing);

      const updated = createCreative({
        title: "Updated Creative"
      });

      repositoryMock.update.mockResolvedValue(updated);

      const result = await service.update(
        10,
        1,
        {
          title: "  Updated Creative  ",
          mediaUrl: "  https://cdn.example.com/new.jpg  "
        },
        100
      );

      expect(result).toBe(updated);

      expect(repositoryMock.update).toHaveBeenCalledWith(
        1,
        {
          title: "Updated Creative",
          mediaUrl: "https://cdn.example.com/new.jpg",
          altText: undefined,
          thumbnailUrl: undefined
        },
        100,
        client
      );

      expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(client.query).toHaveBeenNthCalledWith(2, "COMMIT");
    });

    it("should clear primary when updating a creative to primary", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      repositoryMock.findById.mockResolvedValue(
        createCreative({
          isPrimary: false
        })
      );

      await service.update(
        10,
        1,
        {
          isPrimary: true
        },
        100
      );

      expect(repositoryMock.clearPrimaryForVariant).toHaveBeenCalledWith(
        10,
        "DESKTOP",
        1,
        client
      );
    });

    it("should clear primary when changing the variant of a primary creative", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      repositoryMock.findById.mockResolvedValue(
        createCreative({
          isPrimary: true,
          variant: "DESKTOP"
        })
      );

      await service.update(
        10,
        1,
        {
          variant: "MOBILE"
        },
        100
      );

      expect(repositoryMock.clearPrimaryForVariant).toHaveBeenCalledWith(
        10,
        "MOBILE",
        1,
        client
      );
    });

    it("should not clear primary for an ordinary update", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      repositoryMock.findById.mockResolvedValue(
        createCreative({
          isPrimary: false
        })
      );

      await service.update(
        10,
        1,
        {
          title: "Updated"
        },
        100
      );

      expect(repositoryMock.clearPrimaryForVariant).not.toHaveBeenCalled();
    });

    it("should reject a creative belonging to another advertisement", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          advertisementId: 999
        })
      );

      await expect(
        service.update(
          10,
          1,
          {
            title: "Updated"
          },
          100
        )
      ).rejects.toThrow("Advertisement creative not found.");
    });

    it("should reject updates for a submitted advertisement", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue({
        id: 10,
        workflowStatus: "SUBMITTED",
        status: "DRAFT"
      });

      repositoryMock.findById.mockResolvedValue(createCreative());

      await expect(
        service.update(
          10,
          1,
          {
            title: "Updated"
          },
          100
        )
      ).rejects.toThrow(
        "Advertisement creatives cannot be modified while advertisement workflow status is 'SUBMITTED'."
      );
    });

    it("should reject an invalid update width", async () => {
      await expect(
        service.update(
          10,
          1,
          {
            widthPx: 0
          },
          100
        )
      ).rejects.toThrow("widthPx must be a positive integer.");
    });

    it("should rollback when repository update fails", async () => {
      const client = createClient();

      poolMock.connect.mockResolvedValue(client);

      repositoryMock.findById.mockResolvedValue(
        createCreative({
          isPrimary: false
        })
      );

      const error = new Error("Update failed");

      repositoryMock.update.mockRejectedValue(error);

      await expect(
        service.update(
          10,
          1,
          {
            title: "Updated"
          },
          100
        )
      ).rejects.toThrow("Update failed");

      expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
      expect(client.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should deactivate a creative", async () => {
      repositoryMock.findById.mockResolvedValue(createCreative());

      const result = await service.remove(10, 1, 100);

      expect(result.status).toBe("INACTIVE");
      expect(repositoryMock.remove).toHaveBeenCalledWith(1, 100);
    });

    it("should reject removal for a submitted advertisement", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue({
        id: 10,
        workflowStatus: "APPROVED",
        status: "ACTIVE"
      });

      repositoryMock.findById.mockResolvedValue(createCreative());

      await expect(service.remove(10, 1, 100)).rejects.toThrow(
        "Advertisement creatives cannot be modified while advertisement workflow status is 'APPROVED'."
      );
    });

    it("should reject a creative belonging to another advertisement", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          advertisementId: 999
        })
      );

      await expect(service.remove(10, 1, 100)).rejects.toThrow(
        "Advertisement creative not found."
      );
    });

    it("should reject when repository remove returns null", async () => {
      repositoryMock.findById.mockResolvedValue(createCreative());
      repositoryMock.remove.mockResolvedValue(null);

      await expect(service.remove(10, 1, 100)).rejects.toThrow(
        "Advertisement creative not found."
      );
    });
  });

  describe("getPreview", () => {
    it("should return an exact dimension match", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          widthPx: 728,
          heightPx: 90
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.status).toBe("EXACT_MATCH");
      expect(result.expected).toEqual({
        widthPx: 728,
        heightPx: 90,
        aspectRatio: 8.088889
      });
      expect(result.actual).toEqual({
        widthPx: 728,
        heightPx: 90,
        aspectRatio: 8.088889
      });
      expect(result.renderMode).toBe("CONTAIN");
      expect(result.usesDesktopFallback).toBe(false);
    });

    it("should use mobile format dimensions for a mobile creative", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          variant: "MOBILE",
          widthPx: 320,
          heightPx: 100
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.variant).toBe("MOBILE");
      expect(result.expected).toEqual({
        widthPx: 320,
        heightPx: 100,
        aspectRatio: 3.2
      });
      expect(result.status).toBe("EXACT_MATCH");
    });

    it("should return dimensions not available when creative dimensions are null", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          widthPx: null,
          heightPx: null
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.status).toBe("DIMENSIONS_NOT_AVAILABLE");
    });

    it("should return no expected dimensions when format has no fixed dimensions", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          widthPx: 500,
          heightPx: 300
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: null,
        heightPx: null,
        mobileWidthPx: null,
        mobileHeightPx: null,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.status).toBe("NO_EXPECTED_DIMENSIONS");
    });

    it("should return a slight dimension difference when within tolerance", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          widthPx: 700,
          heightPx: 90
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.status).toBe("SLIGHTLY_DIFFERENT");
    });

    it("should return aspect ratio mismatch when aspect ratio differs materially", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          widthPx: 500,
          heightPx: 500
        })
      );

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getPreview(10, 1);

      expect(result.status).toBe("ASPECT_RATIO_MISMATCH");
    });

    it("should use native rendering for HTML", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          creativeType: "HTML"
        })
      );

      repositoryMock.findFormat.mockResolvedValue(null);

      const result = await service.getPreview(10, 1);

      expect(result.renderMode).toBe("NATIVE");
    });

    it("should use native rendering for TEXT", async () => {
      repositoryMock.findById.mockResolvedValue(
        createCreative({
          creativeType: "TEXT"
        })
      );

      repositoryMock.findFormat.mockResolvedValue(null);

      const result = await service.getPreview(10, 1);

      expect(result.renderMode).toBe("NATIVE");
    });
  });

  describe("getAdvertisementPreview", () => {
    it("should select the primary desktop and mobile creatives", async () => {
      const desktop = createCreative({
        id: 1,
        variant: "DESKTOP",
        isPrimary: true
      });

      const mobile = createCreative({
        id: 2,
        variant: "MOBILE",
        isPrimary: true,
        widthPx: 320,
        heightPx: 100
      });

      repositoryMock.findActiveByAdvertisementId.mockResolvedValue([
        desktop,
        mobile
      ]);

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getAdvertisementPreview(10);

      expect(result.desktop?.creativeId).toBe(1);
      expect(result.mobile?.creativeId).toBe(2);
      expect(result.desktop?.usesDesktopFallback).toBe(false);
      expect(result.mobile?.usesDesktopFallback).toBe(false);
    });

    it("should fall back to desktop creative when mobile creative is absent", async () => {
      const desktop = createCreative({
        id: 1,
        variant: "DESKTOP",
        isPrimary: true,
        widthPx: 728,
        heightPx: 90
      });

      repositoryMock.findActiveByAdvertisementId.mockResolvedValue([desktop]);

      repositoryMock.findFormat.mockResolvedValue({
        id: 20,
        widthPx: 728,
        heightPx: 90,
        mobileWidthPx: 320,
        mobileHeightPx: 100,
        status: "ACTIVE"
      });

      const result = await service.getAdvertisementPreview(10);

      expect(result.desktop?.creativeId).toBe(1);
      expect(result.mobile?.creativeId).toBe(1);
      expect(result.mobile?.usesDesktopFallback).toBe(true);
      expect(result.mobile?.renderMode).toBe("FALLBACK_DESKTOP");
      expect(result.mobile?.statusMessage).toContain(
        "Mobile preview is using the desktop creative"
      );
    });

    it("should return null previews when there are no active creatives", async () => {
      repositoryMock.findActiveByAdvertisementId.mockResolvedValue([]);

      const result = await service.getAdvertisementPreview(10);

      expect(result).toEqual({
        desktop: null,
        mobile: null
      });
    });

    it("should reject preview when advertisement does not exist", async () => {
      repositoryMock.findAdvertisement.mockResolvedValue(null);

      await expect(service.getAdvertisementPreview(10)).rejects.toThrow(
        "Advertisement not found."
      );
    });
  });
});
