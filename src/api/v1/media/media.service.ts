import { randomUUID } from "node:crypto";

import path from "node:path";

import { pool } from "../../../shared/config/db.js";

import { ApiError } from "../../../shared/utils/apiErrorInfo.js";

import * as newsRepository from "../news/news.repository.js";

import {
  deleteCloudinaryImage,
  getThumbnailUrl,
  uploadImageBuffer
} from "../../../shared/config/cloudinary.js";

import * as repository from "./media.repository.js";

import type {
  MediaOrderItem,
  MediaUploadMetadata,
  NewsMediaItem
} from "./media.types.js";

const MAX_FILES = 10;

const parseMetadata = (
  value: string | undefined,
  count: number
): MediaUploadMetadata[] => {
  if (!value) {
    return Array.from({ length: count }, () => ({}));
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      throw new Error();
    }

    return Array.from({ length: count }, (_, index) => {
      const item = parsed[index];

      if (!item || typeof item !== "object") {
        return {};
      }

      const record = item as Record<string, unknown>;

      return {
        altText:
          typeof record.altText === "string" ? record.altText.trim() : null,

        caption:
          typeof record.caption === "string" ? record.caption.trim() : null
      };
    });
  } catch {
    throw new ApiError(400, "Invalid media metadata.");
  }
};

export const getNewsMedia = async (newsId: number) => {
  const news = await newsRepository.findById(newsId);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  return repository.findByNewsId(newsId);
};

export const uploadNewsMedia = async (
  newsId: number,
  files: Express.Multer.File[],
  uploadedBy: number,
  metadataJson?: string
): Promise<NewsMediaItem[]> => {
  if (files.length === 0) {
    throw new ApiError(400, "At least one image is required.");
  }

  if (files.length > MAX_FILES) {
    throw new ApiError(
      400,
      `A maximum of ${MAX_FILES} images can be uploaded at once.`
    );
  }

  const news = await newsRepository.findById(newsId);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  const metadata = parseMetadata(metadataJson, files.length);

  const uploadedPublicIds: string[] = [];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let displayOrder = await repository.getNextDisplayOrder(newsId, client);

    const created: NewsMediaItem[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];

      if (!file) {
        throw new ApiError(400, "Invalid uploaded image.");
      }

      const extension = path
        .extname(file.originalname)
        .replace(/^\./, "")
        .toLowerCase();

      const publicId = randomUUID();

      const upload = await uploadImageBuffer(file.buffer, {
        folder: `${
          process.env.CLOUDINARY_FOLDER ?? "thenewstime/news"
        }/${newsId}`,

        publicId
      });

      uploadedPublicIds.push(upload.public_id);

      const item = await repository.createAssetAndLink(
        {
          newsId,

          provider: "CLOUDINARY",

          assetType: "IMAGE",

          publicId: upload.public_id,

          originalFileName: file.originalname,

          mimeType: file.mimetype,

          fileExtension: extension,

          fileSizeBytes: file.size,

          width: upload.width ?? null,

          height: upload.height ?? null,

          altText: metadata[index]?.altText ?? null,

          caption: metadata[index]?.caption ?? null,

          fileUrl: upload.secure_url,

          thumbnailUrl: getThumbnailUrl(upload.public_id),

          uploadedBy,

          displayOrder
        },
        client
      );

      created.push(item);

      displayOrder += 1;
    }

    await client.query("COMMIT");

    return created;
  } catch (error) {
    await client.query("ROLLBACK");

    await Promise.allSettled(
      uploadedPublicIds.map((publicId) => deleteCloudinaryImage(publicId))
    );

    throw error;
  } finally {
    client.release();
  }
};

export const reorderNewsMedia = async (
  newsId: number,
  items: MediaOrderItem[]
): Promise<NewsMediaItem[]> => {
  const news = await newsRepository.findById(newsId);

  if (!news) {
    throw new ApiError(404, "News not found.");
  }

  const current = await repository.findByNewsId(newsId);

  const currentIds = new Set(current.map((item) => item.id));

  const submittedIds = items.map((item) => item.mediaId);

  if (submittedIds.some((id) => !currentIds.has(id))) {
    throw new ApiError(
      400,
      "One or more media items do not belong to this news article."
    );
  }

  const orders = items.map((item) => item.displayOrder);

  if (new Set(orders).size !== orders.length) {
    throw new ApiError(400, "Display order values must be unique.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await repository.reorder(newsId, items, client);

    await client.query("COMMIT");

    return repository.findByNewsId(newsId);
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
};

export const deleteNewsMedia = async (
  newsId: number,
  mediaId: number
): Promise<void> => {
  const media = await repository.findMediaForDeletion(newsId, mediaId);

  if (!media) {
    throw new ApiError(404, "News media not found.");
  }

  const client = await pool.connect();

  let shouldDeleteCloudinary = false;

  try {
    await client.query("BEGIN");

    const assetId = await repository.deleteLink(newsId, mediaId, client);

    if (!assetId) {
      throw new ApiError(404, "News media not found.");
    }

    const references = await repository.countAssetReferences(assetId, client);

    if (references === 0) {
      await repository.markAssetDeleted(assetId, client);

      shouldDeleteCloudinary = true;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }

  if (shouldDeleteCloudinary) {
    try {
      await deleteCloudinaryImage(media.publicId);
    } catch (error) {
      console.error("Cloudinary cleanup failed:", error);
    }
  }
};
