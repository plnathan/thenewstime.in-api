import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  processNewsImage,
  type ImageProcessingOptions
} from "../media.image-processing.js";

let input: Buffer;
const watermark: ImageProcessingOptions = {
  compress: false,
  watermark: true,
  watermarkText: "www.thenewstime.in",
  watermarkFontSize: 24,
  watermarkColor: "WHITE",
  watermarkPosition: "BOTTOM"
};

beforeAll(async () => {
  input = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#336699" }
  })
    .png()
    .toBuffer();
});

describe("processNewsImage", () => {
  it("preserves the original buffer when both options are disabled", async () => {
    const result = await processNewsImage(input, {
      compress: false,
      watermark: false
    });
    expect(result.buffer).toBe(input);
    expect(result.mimeType).toBe("");
    expect(result.extension).toBe("");
  });

  it("compresses to WebP without a watermark", async () => {
    const result = await processNewsImage(input, {
      compress: true,
      watermark: false
    });
    expect(result.mimeType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(640);
    expect(metadata.height).toBe(360);
  });

  it("embeds a permanent watermark without compression", async () => {
    const result = await processNewsImage(input, watermark);
    expect(result.mimeType).toBe("image/png");
    expect(result.extension).toBe("png");
    expect(result.buffer.equals(input)).toBe(false);
    const original = await sharp(input).raw().toBuffer();
    const modified = await sharp(result.buffer).raw().toBuffer();
    expect(modified.equals(original)).toBe(false);
  });

  it("applies both compression and permanent watermarking", async () => {
    const result = await processNewsImage(input, {
      ...watermark,
      compress: true
    });
    expect(result.mimeType).toBe("image/webp");
    expect((await sharp(result.buffer).metadata()).format).toBe("webp");
  });

  it.each(["TOP", "BOTTOM", "LEFT", "RIGHT", "CENTER"] as const)(
    "supports watermark position %s",
    async (position) => {
      const result = await processNewsImage(input, {
        ...watermark,
        watermarkPosition: position
      });
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  );

  it.each(["BLACK", "WHITE"] as const)(
    "supports text color %s",
    async (color) => {
      const result = await processNewsImage(input, {
        ...watermark,
        watermarkColor: color
      });
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  );

  it("rejects missing watermark details", async () => {
    await expect(
      processNewsImage(input, { compress: false, watermark: true })
    ).rejects.toThrow(/watermark text/i);
  });

  it("rejects an invalid watermark font size", async () => {
    await expect(
      processNewsImage(input, { ...watermark, watermarkFontSize: 7 })
    ).rejects.toThrow(/font size/i);
  });

  it("rejects invalid image bytes when processing is requested", async () => {
    await expect(
      processNewsImage(Buffer.from("not an image"), {
        compress: true,
        watermark: false
      })
    ).rejects.toThrow();
  });

  it("escapes XML characters in watermark text", async () => {
    const result = await processNewsImage(input, {
      ...watermark,
      watermarkText: "A&B <News>"
    });
    expect(result.buffer.length).toBeGreaterThan(0);
  });
  it.each([
    { width: 1200, height: 800 },
    { width: 800, height: 1200 },
    { width: 1600, height: 900 }
  ])(
    "preserves source dimensions for $width x $height across processing combinations",
    async ({ width, height }) => {
      const source = await sharp({
        create: { width, height, channels: 3, background: "#447799" }
      })
        .png()
        .toBuffer();
      for (const options of [
        { compress: false, watermark: false },
        { compress: true, watermark: false },
        { ...watermark, compress: false },
        { ...watermark, compress: true }
      ] satisfies ImageProcessingOptions[]) {
        const processed = await processNewsImage(source, options);
        const dimensions = await sharp(processed.buffer).metadata();
        expect(dimensions.width).toBe(width);
        expect(dimensions.height).toBe(height);
      }
    }
  );
});
