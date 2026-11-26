import sharp from "sharp";
import { resolve } from "node:path";
import { access } from "node:fs/promises";
import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

export type WatermarkPosition = "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "CENTER";
export interface ImageProcessingOptions {
  compress: boolean;
  watermark: boolean;
  watermarkText?: string;
  watermarkFontSize?: number;
  watermarkColor?: "BLACK" | "WHITE";
  watermarkPosition?: WatermarkPosition;
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export async function processNewsImage(
  input: Buffer,
  options: ImageProcessingOptions
): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  if (!options.compress && !options.watermark) {
    return { buffer: input, mimeType: "", extension: "" };
  }
  const image = sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000
  }).rotate();
  const info = await image.metadata();
  if (
    !info.width ||
    !info.height ||
    !["jpeg", "png", "webp"].includes(info.format ?? "")
  ) {
    throw new ApiError(400, "Unsupported image format or dimensions.");
  }
  let pipeline = image;
  if (options.watermark) {
    const text = options.watermarkText?.trim();
    const size = options.watermarkFontSize;
    if (
      !text ||
      text.length > 120 ||
      !size ||
      !Number.isInteger(size) ||
      size < 8 ||
      size > 120 ||
      !["BLACK", "WHITE"].includes(options.watermarkColor ?? "") ||
      !["TOP", "BOTTOM", "LEFT", "RIGHT", "CENTER"].includes(
        options.watermarkPosition ?? ""
      )
    ) {
      throw new ApiError(
        400,
        "Valid watermark text, font size (8–120), color and position are required."
      );
    }
    const width = info.width;
    const height = info.height;
    const margin = Math.max(12, Math.round(Math.min(width, height) * 0.025));
    const safeSize = Math.min(
      size,
      Math.max(8, Math.floor(width / Math.max(3, text.length * 0.65)))
    );
    const fontDirectory = resolve(process.cwd(), "assets", "watermark-fonts");
    const latinFont = resolve(fontDirectory, "NotoSans-Bold.ttf");
    const tamilFont = resolve(fontDirectory, "NotoSansTamil-Bold.ttf");
    try {
      await Promise.all([access(latinFont), access(tamilFont)]);
    } catch {
      throw new ApiError(503, "Watermark fonts are not configured.");
    }
    // Register both fonts before rendering mixed-language text with Pango.
    await sharp({
      text: { text: "A", font: "Noto Sans Bold 12", fontfile: latinFont }
    })
      .png()
      .toBuffer();
    await sharp({
      text: { text: "அ", font: "Noto Sans Tamil Bold 12", fontfile: tamilFont }
    })
      .png()
      .toBuffer();
    const fill = options.watermarkColor === "BLACK" ? "#000000" : "#ffffff";
    const render = (fontSize: number) =>
      sharp({
        text: {
          text: `<span foreground="${fill}" font_family="Noto Sans Tamil, Noto Sans" weight="bold">${escapeXml(text)}</span>`,
          font: `Noto Sans Tamil Bold ${fontSize}`,
          fontfile: tamilFont,
          dpi: 72,
          rgba: true
        }
      })
        .png()
        .toBuffer({ resolveWithObject: true });
    const availableWidth = Math.max(1, width - 2 * margin);
    const availableHeight = Math.max(1, height - 2 * margin);
    let fontSize = safeSize;
    let overlay = await render(fontSize);
    while (
      (overlay.info.width > availableWidth ||
        overlay.info.height > availableHeight) &&
      fontSize > 1
    ) {
      fontSize = Math.max(
        1,
        Math.min(
          fontSize - 1,
          Math.floor(
            fontSize *
              Math.min(
                availableWidth / overlay.info.width,
                availableHeight / overlay.info.height
              )
          )
        )
      );
      overlay = await render(fontSize);
    }
    if (overlay.info.width > width || overlay.info.height > height) {
      throw new ApiError(400, "Watermark does not fit the image.");
    }
    const x =
      options.watermarkPosition === "LEFT"
        ? margin
        : options.watermarkPosition === "RIGHT"
          ? width - overlay.info.width - margin
          : (width - overlay.info.width) / 2;
    const y =
      options.watermarkPosition === "TOP"
        ? margin
        : options.watermarkPosition === "BOTTOM"
          ? height - overlay.info.height - margin
          : (height - overlay.info.height) / 2;
    pipeline = pipeline.composite([
      {
        input: overlay.data,
        left: Math.max(0, Math.min(width - overlay.info.width, Math.round(x))),
        top: Math.max(0, Math.min(height - overlay.info.height, Math.round(y)))
      }
    ]);
  }
  if (options.compress) {
    return {
      buffer: await pipeline.webp({ quality: 78, effort: 4 }).toBuffer(),
      mimeType: "image/webp",
      extension: "webp"
    };
  }
  const format = info.format;
  if (format === "jpeg")
    return {
      buffer: await pipeline.jpeg({ quality: 95 }).toBuffer(),
      mimeType: "image/jpeg",
      extension: "jpg"
    };
  if (format === "png")
    return {
      buffer: await pipeline.png().toBuffer(),
      mimeType: "image/png",
      extension: "png"
    };
  return {
    buffer: await pipeline.webp({ quality: 100 }).toBuffer(),
    mimeType: "image/webp",
    extension: "webp"
  };
}
