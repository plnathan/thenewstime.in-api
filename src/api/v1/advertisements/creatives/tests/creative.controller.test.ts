import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as service from "../creative.service.js";
import type {
  AdvertisementCreative,
  AdvertisementCreativePreview,
  AdvertisementCreativePreviewResponse
} from "../creative.types.js";

import {
  create,
  getAdvertisementPreview,
  getAll,
  getById,
  getPreview,
  remove,
  update
} from "../creative.controller.js";

vi.mock("../creative.service.js", () => ({
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getPreview: vi.fn(),
  getAdvertisementPreview: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

import { sendSuccess } from "../../../../../shared/utils/response.js";

const mockedService = vi.mocked(service);
const mockedSendSuccess = vi.mocked(sendSuccess);

function createRequest(
  params: Record<string, string>,
  body: unknown = {},
  userId = 101
): Request {
  return {
    params,
    body,
    user: {
      id: userId
    }
  } as unknown as Request;
}

function createResponse(): Response {
  return {} as Response;
}

function createNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

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
    thumbnailUrl: null,
    widthPx: 728,
    heightPx: 90,
    displayOrder: 1,
    isPrimary: true,
    status: "ACTIVE",
    createdBy: 101,
    updatedBy: 101,
    createdAt: new Date("2026-09-27T00:00:00.000Z"),
    updatedAt: new Date("2026-09-27T00:00:00.000Z"),
    ...overrides
  };
}

function createPreview(
  overrides: Partial<AdvertisementCreativePreview> = {}
): AdvertisementCreativePreview {
  return {
    creativeId: 1,
    advertisementId: 10,
    formatId: 20,
    creativeType: "IMAGE",
    variant: "DESKTOP",
    previewUrl: "https://cdn.example.com/ad.jpg",
    thumbnailUrl: null,
    expected: {
      widthPx: 728,
      heightPx: 90,
      aspectRatio: 8.088889
    },
    actual: {
      widthPx: 728,
      heightPx: 90,
      aspectRatio: 8.088889
    },
    status: "EXACT_MATCH",
    statusMessage:
      "Creative dimensions exactly match the expected format dimensions.",
    renderMode: "CONTAIN",
    usesDesktopFallback: false,
    ...overrides
  };
}

describe("Advertisement Creative Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get all creatives", async () => {
    const creatives = [createCreative()];

    mockedService.getAll.mockResolvedValue(creatives);

    const req = createRequest({
      advertisementId: "10"
    });
    const res = createResponse();
    const next = createNext();

    await getAll(req, res, next);

    expect(mockedService.getAll).toHaveBeenCalledWith(10);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creatives retrieved successfully.",
      creatives
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass getAll errors to next", async () => {
    const error = new Error("Database error");

    mockedService.getAll.mockRejectedValue(error);

    const req = createRequest({
      advertisementId: "10"
    });
    const res = createResponse();
    const next = createNext();

    await getAll(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(mockedSendSuccess).not.toHaveBeenCalled();
  });

  it("should get a creative by id", async () => {
    const creative = createCreative();

    mockedService.getById.mockResolvedValue(creative);

    const req = createRequest({
      advertisementId: "10",
      creativeId: "1"
    });
    const res = createResponse();
    const next = createNext();

    await getById(req, res, next);

    expect(mockedService.getById).toHaveBeenCalledWith(10, 1);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative retrieved successfully.",
      creative
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should create a creative using the authenticated user id", async () => {
    const creative = createCreative();

    const input = {
      creativeType: "IMAGE" as const,
      variant: "DESKTOP" as const,
      mediaUrl: "https://cdn.example.com/ad.jpg",
      widthPx: 728,
      heightPx: 90,
      isPrimary: true
    };

    mockedService.create.mockResolvedValue(creative);

    const req = createRequest(
      {
        advertisementId: "10"
      },
      input,
      555
    );

    const res = createResponse();
    const next = createNext();

    await create(req, res, next);

    expect(mockedService.create).toHaveBeenCalledWith(10, input, 555);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative created successfully.",
      creative,
      201
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should update a creative using the authenticated user id", async () => {
    const creative = createCreative({
      title: "Updated Creative"
    });

    const input = {
      title: "Updated Creative",
      isPrimary: true
    };

    mockedService.update.mockResolvedValue(creative);

    const req = createRequest(
      {
        advertisementId: "10",
        creativeId: "1"
      },
      input,
      555
    );

    const res = createResponse();
    const next = createNext();

    await update(req, res, next);

    expect(mockedService.update).toHaveBeenCalledWith(10, 1, input, 555);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative updated successfully.",
      creative
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should deactivate a creative", async () => {
    const creative = createCreative({
      status: "INACTIVE",
      isPrimary: false
    });

    mockedService.remove.mockResolvedValue(creative);

    const req = createRequest(
      {
        advertisementId: "10",
        creativeId: "1"
      },
      {},
      555
    );

    const res = createResponse();
    const next = createNext();

    await remove(req, res, next);

    expect(mockedService.remove).toHaveBeenCalledWith(10, 1, 555);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative deactivated successfully.",
      creative
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should get an individual creative preview", async () => {
    const preview = createPreview();

    mockedService.getPreview.mockResolvedValue(preview);

    const req = createRequest({
      advertisementId: "10",
      creativeId: "1"
    });

    const res = createResponse();
    const next = createNext();

    await getPreview(req, res, next);

    expect(mockedService.getPreview).toHaveBeenCalledWith(10, 1);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative preview retrieved successfully.",
      preview
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should get the advertisement creative preview response", async () => {
    const previewResponse: AdvertisementCreativePreviewResponse = {
      desktop: createPreview(),
      mobile: null
    };

    mockedService.getAdvertisementPreview.mockResolvedValue(previewResponse);

    const req = createRequest({
      advertisementId: "10"
    });

    const res = createResponse();
    const next = createNext();

    await getAdvertisementPreview(req, res, next);

    expect(mockedService.getAdvertisementPreview).toHaveBeenCalledWith(10);

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Advertisement creative previews retrieved successfully.",
      previewResponse
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass update errors to next", async () => {
    const error = new Error("Update failed");

    mockedService.update.mockRejectedValue(error);

    const req = createRequest(
      {
        advertisementId: "10",
        creativeId: "1"
      },
      {
        title: "Updated"
      },
      555
    );

    const res = createResponse();
    const next = createNext();

    await update(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(mockedSendSuccess).not.toHaveBeenCalled();
  });

  it("should pass remove errors to next", async () => {
    const error = new Error("Remove failed");

    mockedService.remove.mockRejectedValue(error);

    const req = createRequest(
      {
        advertisementId: "10",
        creativeId: "1"
      },
      {},
      555
    );

    const res = createResponse();
    const next = createNext();

    await remove(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(mockedSendSuccess).not.toHaveBeenCalled();
  });
});
