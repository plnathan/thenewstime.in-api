import type { NextFunction, Request, Response } from "express";

import {
  uploadAdvertisementCreativeBuffer,
  getThumbnailUrl
} from "../../../../shared/config/cloudinary.js";

import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import { sendSuccess } from "../../../../shared/utils/response.js";

const IMAGE_FOLDER = "thenewstime_dev/advertisement/images";

const VIDEO_FOLDER = "thenewstime_dev/advertisement/videos";

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
]);

const videoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const upload = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      throw new ApiError(400, "Please select an image or video file.");
    }

    let resourceType: "image" | "video";
    let folder: string;

    if (imageMimeTypes.has(file.mimetype)) {
      resourceType = "image";
      folder = IMAGE_FOLDER;
    } else if (videoMimeTypes.has(file.mimetype)) {
      resourceType = "video";
      folder = VIDEO_FOLDER;
    } else {
      throw new ApiError(400, "Unsupported advertisement creative file type.");
    }

    const uploaded = await uploadAdvertisementCreativeBuffer(file.buffer, {
      resourceType,
      folder
    });

    const thumbnailUrl =
      resourceType === "image" ? getThumbnailUrl(uploaded.public_id) : null;

    sendSuccess(
      res,
      "Advertisement creative uploaded successfully.",
      {
        resourceType,
        secureUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        format: uploaded.format,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSizeBytes: uploaded.bytes,
        widthPx: uploaded.width,
        heightPx: uploaded.height,
        thumbnailUrl
      },
      201
    );
  } catch (error) {
    next(error);
  }
};
