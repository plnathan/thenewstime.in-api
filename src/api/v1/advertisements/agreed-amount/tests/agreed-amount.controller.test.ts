import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendSuccess } from "../../../../../shared/utils/response.js";

import { calculateAdvertisementAgreedAmount } from "../agreed-amount.controller.js";
import * as service from "../agreed-amount.service.js";

vi.mock("../../../../../shared/utils/response.js", () => ({
  sendSuccess: vi.fn()
}));

vi.mock("../agreed-amount.service.js", () => ({
  calculateAgreedAmount: vi.fn()
}));

const mockCalculateAgreedAmount =
  service.calculateAgreedAmount as unknown as ReturnType<typeof vi.fn>;

const mockSendSuccess = sendSuccess as unknown as ReturnType<typeof vi.fn>;

const createRequest = (body: Record<string, unknown>): Request =>
  ({
    body
  }) as Request;

const createResponse = (): Response => ({}) as Response;

const createNext = (): NextFunction => vi.fn();

describe("Advertisement Agreed Amount Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateAdvertisementAgreedAmount", () => {
    it("should calculate agreed amount and send a success response", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 8500,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        standardAmount: 10000,
        agreedAmount: 8500,
        varianceAmount: -1500,
        variancePercentage: -15,
        currencyCode: "INR"
      };

      mockCalculateAgreedAmount.mockReturnValue(result);

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(mockCalculateAgreedAmount).toHaveBeenCalledTimes(1);

      expect(mockCalculateAgreedAmount).toHaveBeenCalledWith(req.body);

      expect(mockSendSuccess).toHaveBeenCalledTimes(1);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement agreed amount calculated successfully.",
        result
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should support an agreed amount equal to the standard amount", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 10000,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        standardAmount: 10000,
        agreedAmount: 10000,
        varianceAmount: 0,
        variancePercentage: 0,
        currencyCode: "INR"
      };

      mockCalculateAgreedAmount.mockReturnValue(result);

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(mockCalculateAgreedAmount).toHaveBeenCalledWith(req.body);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement agreed amount calculated successfully.",
        result
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should support an agreed amount above the standard amount", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 12500,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const result = {
        standardAmount: 10000,
        agreedAmount: 12500,
        varianceAmount: 2500,
        variancePercentage: 25,
        currencyCode: "INR"
      };

      mockCalculateAgreedAmount.mockReturnValue(result);

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(mockSendSuccess).toHaveBeenCalledWith(
        res,
        "Advertisement agreed amount calculated successfully.",
        result
      );

      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors to next", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 8500,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Agreed amount calculation failed.");

      mockCalculateAgreedAmount.mockImplementation(() => {
        throw error;
      });

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);

      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it("should forward unexpected service errors to next", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 8500,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const error = new TypeError("Unexpected calculation failure.");

      mockCalculateAgreedAmount.mockImplementation(() => {
        throw error;
      });

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(mockSendSuccess).not.toHaveBeenCalled();
    });

    it("should not modify the request body before passing it to the service", async () => {
      const body = {
        standardAmount: 25000,
        agreedAmount: 18000,
        currencyCode: "INR"
      };

      const req = createRequest(body);
      const res = createResponse();
      const next = createNext();

      const result = {
        standardAmount: 25000,
        agreedAmount: 18000,
        varianceAmount: -7000,
        variancePercentage: -28,
        currencyCode: "INR"
      };

      mockCalculateAgreedAmount.mockReturnValue(result);

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(mockCalculateAgreedAmount).toHaveBeenCalledWith(body);

      expect(req.body).toEqual(body);
    });

    it("should not call sendSuccess when the service fails", async () => {
      const req = createRequest({
        standardAmount: 10000,
        agreedAmount: 5000,
        currencyCode: "INR"
      });

      const res = createResponse();
      const next = createNext();

      const error = new Error("Calculation error.");

      mockCalculateAgreedAmount.mockImplementation(() => {
        throw error;
      });

      await calculateAdvertisementAgreedAmount(req, res, next);

      expect(mockSendSuccess).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
