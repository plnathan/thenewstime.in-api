import { describe, expect, it } from "vitest";
import {
  mediaUploadBodySchema,
  mediaNewsParamsSchema,
  mediaDeleteParamsSchema
} from "../media.validation.js";

describe("media upload validation", () => {
  it("accepts legacy upload requests without processing options", () => {
    expect(mediaUploadBodySchema.safeParse({ uploadedBy: "10" }).success).toBe(
      true
    );
  });

  it("accepts both processing options enabled with watermark settings", () => {
    const parsed = mediaUploadBodySchema.parse({
      uploadedBy: "10",
      compress: "true",
      watermark: "true",
      watermarkText: "www.thenewstime.in",
      watermarkFontSize: "24",
      watermarkColor: "WHITE",
      watermarkPosition: "BOTTOM"
    });
    expect(parsed.uploadedBy).toBe(10);
    expect(parsed.watermarkFontSize).toBe(24);
  });

  it("accepts both options disabled", () => {
    expect(
      mediaUploadBodySchema.safeParse({
        uploadedBy: "10",
        compress: "false",
        watermark: "false"
      }).success
    ).toBe(true);
  });

  it.each(["BLACK", "WHITE"])("accepts watermark color %s", (color) => {
    expect(
      mediaUploadBodySchema.safeParse({ uploadedBy: 1, watermarkColor: color })
        .success
    ).toBe(true);
  });

  it.each(["TOP", "BOTTOM", "LEFT", "RIGHT", "CENTER"])(
    "accepts position %s",
    (position) => {
      expect(
        mediaUploadBodySchema.safeParse({
          uploadedBy: 1,
          watermarkPosition: position
        }).success
      ).toBe(true);
    }
  );

  it.each(["yes", "1", true])(
    "rejects invalid compression flag %s",
    (compress) => {
      expect(
        mediaUploadBodySchema.safeParse({ uploadedBy: 1, compress }).success
      ).toBe(false);
    }
  );

  it("rejects out-of-range watermark font sizes", () => {
    expect(
      mediaUploadBodySchema.safeParse({ uploadedBy: 1, watermarkFontSize: 7 })
        .success
    ).toBe(false);
    expect(
      mediaUploadBodySchema.safeParse({ uploadedBy: 1, watermarkFontSize: 121 })
        .success
    ).toBe(false);
  });

  it("rejects unsupported colors and positions", () => {
    expect(
      mediaUploadBodySchema.safeParse({ uploadedBy: 1, watermarkColor: "RED" })
        .success
    ).toBe(false);
    expect(
      mediaUploadBodySchema.safeParse({
        uploadedBy: 1,
        watermarkPosition: "CORNER"
      }).success
    ).toBe(false);
  });

  it("coerces valid route identifiers", () => {
    expect(mediaNewsParamsSchema.parse({ newsId: "660" }).newsId).toBe(660);
    expect(
      mediaDeleteParamsSchema.parse({ newsId: "660", mediaId: "12" }).mediaId
    ).toBe(12);
  });
});
