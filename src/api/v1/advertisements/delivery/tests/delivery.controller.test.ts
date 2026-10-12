import type { NextFunction, Request, Response } from "express";

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as deliveryService from "../delivery.service.js";

import { getEligibleAdvertisements } from "../delivery.controller.js";

import type { AdvertisementDeliveryResponse } from "../delivery.types.js";

import { sendSuccess } from "../../../../../shared/utils/response.js";

vi.mock("../delivery.service.js", () => ({
  getEligibleAdvertisements: vi.fn()
}));

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

const mockedGetEligibleAdvertisements = vi.mocked(
  deliveryService.getEligibleAdvertisements
);

const mockedSendSuccess = vi.mocked(sendSuccess);

function mockResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  } as unknown as Response;
}

function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function mockRequest(query: Record<string, unknown>): Request {
  return {
    query: query as unknown as Request["query"]
  } as Request;
}

const mockResponseData: AdvertisementDeliveryResponse = {
  placement: {
    id: 10,
    code: "NEWS_DETAIL_TOP",
    displayName: "News Detail Top",
    description: null,
    pageType: "NEWS_DETAIL",
    placementType: "NEWS_DETAIL_TOP",
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
    rotationEnabled: false,
    rotationMode: "TIME_BASED",
    rotationIntervalSeconds: 10,
    rotationStrategy: "ROUND_ROBIN"
  },
  advertisements: [],
  fallbackApplied: false
};

describe("Advertisement Delivery Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should retrieve eligible advertisements successfully", async () => {
    mockedGetEligibleAdvertisements.mockResolvedValue(mockResponseData);

    const req = mockRequest({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    const res = mockResponse();
    const next = mockNext();

    await getEligibleAdvertisements(req, res, next);

    expect(mockedGetEligibleAdvertisements).toHaveBeenCalledWith({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      "Eligible advertisements retrieved successfully.",
      mockResponseData
    );

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass placementId to the service", async () => {
    mockedGetEligibleAdvertisements.mockResolvedValue(mockResponseData);

    const req = mockRequest({
      pageType: "HOME",
      placementType: "HOME_TOP",
      placementId: 12
    });

    const res = mockResponse();
    const next = mockNext();

    await getEligibleAdvertisements(req, res, next);

    expect(mockedGetEligibleAdvertisements).toHaveBeenCalledWith({
      pageType: "HOME",
      placementType: "HOME_TOP",
      placementId: 12
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should pass targeting context to the service", async () => {
    mockedGetEligibleAdvertisements.mockResolvedValue(mockResponseData);

    const req = mockRequest({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      newsId: 123,
      site: "thenewstime.in",
      category: "politics",
      state: "tamil-nadu",
      district: "tiruppur",
      country: "india"
    });

    const res = mockResponse();
    const next = mockNext();

    await getEligibleAdvertisements(req, res, next);

    expect(mockedGetEligibleAdvertisements).toHaveBeenCalledWith({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP",
      context: {
        newsId: 123,
        site: "thenewstime.in",
        category: "politics",
        state: "tamil-nadu",
        district: "tiruppur",
        country: "india"
      }
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should omit empty targeting context", async () => {
    mockedGetEligibleAdvertisements.mockResolvedValue(mockResponseData);

    const req = mockRequest({
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    const res = mockResponse();
    const next = mockNext();

    await getEligibleAdvertisements(req, res, next);

    expect(mockedGetEligibleAdvertisements).toHaveBeenCalledWith({
      pageType: "HOME",
      placementType: "HOME_TOP"
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("should forward service errors to next", async () => {
    const error = new Error("Failed to retrieve eligible advertisements.");

    mockedGetEligibleAdvertisements.mockRejectedValue(error);

    const req = mockRequest({
      pageType: "NEWS_DETAIL",
      placementType: "NEWS_DETAIL_TOP"
    });

    const res = mockResponse();
    const next = mockNext();

    await getEligibleAdvertisements(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(mockedSendSuccess).not.toHaveBeenCalled();
  });
});
