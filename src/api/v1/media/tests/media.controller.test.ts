import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as controller from "../media.controller.js";
import * as service from "../media.service.js";
import { sendCreated } from "../../../../shared/utils/response.js";

vi.mock("../media.service.js", () => ({
  getNewsMedia: vi.fn(),
  uploadNewsMedia: vi.fn(),
  reorderNewsMedia: vi.fn(),
  deleteNewsMedia: vi.fn()
}));
vi.mock("../../../../shared/utils/response.js", () => ({
  sendCreated: vi.fn(),
  sendSuccess: vi.fn()
}));

const res = {} as Response;
let next: NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
  next = vi.fn();
});

const upload = async (body: Record<string, unknown>) => {
  const files = [
    { originalname: "photo.png", buffer: Buffer.from("test") }
  ] as Express.Multer.File[];
  const req = { params: { newsId: "660" }, body, files } as unknown as Request;
  vi.mocked(service.uploadNewsMedia).mockResolvedValue([]);
  await controller.uploadNewsMedia(req, res, next);
  return files;
};

describe("uploadNewsMedia controller", () => {
  it("passes enabled compression and watermark settings", async () => {
    const files = await upload({
      uploadedBy: "10",
      metadata: "[]",
      compress: "true",
      watermark: "true",
      watermarkText: "www.thenewstime.in",
      watermarkFontSize: "24",
      watermarkColor: "WHITE",
      watermarkPosition: "BOTTOM"
    });
    expect(service.uploadNewsMedia).toHaveBeenCalledWith(660, files, 10, "[]", {
      compress: true,
      watermark: true,
      watermarkText: "www.thenewstime.in",
      watermarkFontSize: 24,
      watermarkColor: "WHITE",
      watermarkPosition: "BOTTOM"
    });
    expect(sendCreated).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("does not pass undefined font size as an own property", async () => {
    await upload({ uploadedBy: "10", compress: "false", watermark: "false" });
    const options = vi.mocked(service.uploadNewsMedia).mock.calls[0]?.[4];
    expect(options).toBeDefined();
    expect(options).toMatchObject({ compress: false, watermark: false });
    expect(
      Object.prototype.hasOwnProperty.call(options, "watermarkFontSize")
    ).toBe(false);
  });

  it("forwards service failures to Express error middleware", async () => {
    const error = new Error("Cloudinary upload failed");
    vi.mocked(service.uploadNewsMedia).mockRejectedValue(error);
    const req = {
      params: { newsId: "660" },
      body: { uploadedBy: "10" },
      files: []
    } as unknown as Request;
    await controller.uploadNewsMedia(req, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(sendCreated).not.toHaveBeenCalled();
  });
});
