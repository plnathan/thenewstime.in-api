import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as controller from "../placement.controller.js";
import * as service from "../placement.service.js";

import type {
  AdvertisementPlacement,
  CreateAdvertisementPlacementInput,
  UpdateAdvertisementPlacementInput
} from "../placement.types.js";

vi.mock("../placement.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn()
}));

describe("Advertisement Placement Controller", () => {
  const next = vi.fn();
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();

  const createResponse = (): Response =>
    ({
      status,
      json
    }) as unknown as Response;

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get all placements successfully", async () => {
    const placements = [placement];

    vi.mocked(service.getAll).mockResolvedValue(placements);

    const req = {} as Request;
    const res = createResponse();

    await controller.getAll(req, res, next as unknown as NextFunction);

    expect(service.getAll).toHaveBeenCalledTimes(1);

    expect(status).toHaveBeenCalledWith(200);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Advertisement placements retrieved successfully.",
      data: placements,
      errors: null,
      meta: null
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass getAll errors to next", async () => {
    const error = new Error("Database error");

    vi.mocked(service.getAll).mockRejectedValue(error);

    const req = {} as Request;
    const res = createResponse();

    await controller.getAll(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("should get placement by id successfully", async () => {
    vi.mocked(service.getById).mockResolvedValue(placement);

    const req = {
      params: {
        id: "1"
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.getById(req, res, next as unknown as NextFunction);

    expect(service.getById).toHaveBeenCalledWith(1);

    expect(status).toHaveBeenCalledWith(200);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Advertisement placement retrieved successfully.",
      data: placement,
      errors: null,
      meta: null
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass getById errors to next", async () => {
    const error = new Error("Placement not found");

    vi.mocked(service.getById).mockRejectedValue(error);

    const req = {
      params: {
        id: "999"
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.getById(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("should create a placement successfully", async () => {
    const input: CreateAdvertisementPlacementInput = {
      code: "HOME_TOP",
      displayName: "Homepage Top",
      pageType: "HOME",
      placementType: "HOME_TOP"
    };

    vi.mocked(service.create).mockResolvedValue(placement);

    const req = {
      body: input,
      user: {
        id: 10
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.create(req, res, next as unknown as NextFunction);

    expect(service.create).toHaveBeenCalledWith(input, 10);

    expect(status).toHaveBeenCalledWith(201);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Advertisement placement created successfully.",
      data: placement,
      errors: null,
      meta: null
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass create errors to next", async () => {
    const error = new Error("Duplicate placement");

    vi.mocked(service.create).mockRejectedValue(error);

    const req = {
      body: {
        code: "HOME_TOP"
      },
      user: {
        id: 10
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.create(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("should update a placement successfully", async () => {
    const input: UpdateAdvertisementPlacementInput = {
      displayName: "Updated Homepage Top"
    };

    const updatedPlacement: AdvertisementPlacement = {
      ...placement,
      displayName: "Updated Homepage Top"
    };

    vi.mocked(service.update).mockResolvedValue(updatedPlacement);

    const req = {
      params: {
        id: "1"
      },
      body: input,
      user: {
        id: 20
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.update(req, res, next as unknown as NextFunction);

    expect(service.update).toHaveBeenCalledWith(1, input, 20);

    expect(status).toHaveBeenCalledWith(200);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Advertisement placement updated successfully.",
      data: updatedPlacement,
      errors: null,
      meta: null
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass update errors to next", async () => {
    const error = new Error("Update failed");

    vi.mocked(service.update).mockRejectedValue(error);

    const req = {
      params: {
        id: "1"
      },
      body: {
        displayName: "Updated"
      },
      user: {
        id: 20
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.update(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("should deactivate a placement successfully", async () => {
    const inactivePlacement: AdvertisementPlacement = {
      ...placement,
      isEnabled: false,
      status: "INACTIVE"
    };

    vi.mocked(service.deactivate).mockResolvedValue(inactivePlacement);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 20
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.deactivate(req, res, next as unknown as NextFunction);

    expect(service.deactivate).toHaveBeenCalledWith(1, 20);

    expect(status).toHaveBeenCalledWith(200);

    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Advertisement placement deactivated successfully.",
      data: inactivePlacement,
      errors: null,
      meta: null
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass deactivate errors to next", async () => {
    const error = new Error("Already inactive");

    vi.mocked(service.deactivate).mockRejectedValue(error);

    const req = {
      params: {
        id: "1"
      },
      user: {
        id: 20
      }
    } as unknown as Request;

    const res = createResponse();

    await controller.deactivate(req, res, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith(error);
  });

  describe("enable", () => {
    it("should enable a placement successfully", async () => {
      const enabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "ACTIVE",
        isEnabled: true,
        updatedBy: 20
      };

      vi.mocked(service.enable).mockResolvedValue(enabledPlacement);

      const req = {
        params: {
          id: "1"
        },
        user: {
          id: 20
        }
      } as unknown as Request;

      const res = createResponse();

      await controller.enable(req, res, next as unknown as NextFunction);

      expect(service.enable).toHaveBeenCalledWith(1, 20);

      expect(status).toHaveBeenCalledWith(200);

      expect(json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement placement enabled successfully.",
        data: enabledPlacement,
        errors: null,
        meta: null
      });

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass enable errors to next", async () => {
      const error = new Error("Placement is already enabled");

      vi.mocked(service.enable).mockRejectedValue(error);

      const req = {
        params: {
          id: "1"
        },
        user: {
          id: 20
        }
      } as unknown as Request;

      const res = createResponse();

      await controller.enable(req, res, next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("disable", () => {
    it("should disable a placement successfully", async () => {
      const disabledPlacement: AdvertisementPlacement = {
        ...placement,
        status: "INACTIVE",
        isEnabled: false,
        updatedBy: 20
      };

      vi.mocked(service.disable).mockResolvedValue(disabledPlacement);

      const req = {
        params: {
          id: "1"
        },
        user: {
          id: 20
        }
      } as unknown as Request;

      const res = createResponse();

      await controller.disable(req, res, next as unknown as NextFunction);

      expect(service.disable).toHaveBeenCalledWith(1, 20);

      expect(status).toHaveBeenCalledWith(200);

      expect(json).toHaveBeenCalledWith({
        success: true,
        message: "Advertisement placement disabled successfully.",
        data: disabledPlacement,
        errors: null,
        meta: null
      });

      expect(next).not.toHaveBeenCalled();
    });

    it("should pass disable errors to next", async () => {
      const error = new Error("Placement is already disabled");

      vi.mocked(service.disable).mockRejectedValue(error);

      const req = {
        params: {
          id: "1"
        },
        user: {
          id: 20
        }
      } as unknown as Request;

      const res = createResponse();

      await controller.disable(req, res, next as unknown as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
