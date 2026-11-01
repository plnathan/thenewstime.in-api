import sharp from "sharp";
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
    const estimatedWidth = Math.ceil(text.length * safeSize * 0.66);
    const x =
      options.watermarkPosition === "LEFT"
        ? margin
        : options.watermarkPosition === "RIGHT"
          ? Math.max(margin, width - estimatedWidth - margin)
          : Math.max(margin, (width - estimatedWidth) / 2);
    const y =
      options.watermarkPosition === "TOP"
        ? margin + safeSize
        : options.watermarkPosition === "BOTTOM"
          ? height - margin
          : (height + safeSize) / 2;
    const fill = options.watermarkColor === "BLACK" ? "#000000" : "#ffffff";
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${Math.round(x)}" y="${Math.round(y)}" font-family="Arial, sans-serif" font-size="${safeSize}" font-weight="bold" fill="${fill}" stroke="${fill === "#000000" ? "#ffffff" : "#000000"}" stroke-opacity="0.35" stroke-width="1" paint-order="stroke">${escapeXml(text)}</text></svg>`
    );
    pipeline = pipeline.composite([{ input: svg, top: 0, left: 0 }]);
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
