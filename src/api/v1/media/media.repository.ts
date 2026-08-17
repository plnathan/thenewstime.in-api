import type { PoolClient } from "pg";

import { pool } from "../../../shared/config/db.js";

import type { MediaOrderItem, NewsMediaItem } from "./media.types.js";

const MEDIA_SELECT = `
  SELECT
    nm.id,

    nm.media_asset_id
      AS "mediaAssetId",

    nm.media_role
      AS "mediaRole",

    nm.display_order
      AS "displayOrder",

    ma.provider,

    ma.asset_type
      AS "assetType",

    ma.public_id
      AS "publicId",

    ma.original_file_name
      AS "originalFileName",

    ma.mime_type
      AS "mimeType",

    ma.file_extension
      AS "fileExtension",

    ma.file_size_bytes
      AS "fileSizeBytes",

    ma.width,

    ma.height,

    ma.alt_text
      AS "altText",

    ma.caption,

    ma.file_url
      AS "fileUrl",

    ma.thumbnail_url
      AS "thumbnailUrl"

  FROM news_media nm

  INNER JOIN media_assets ma
    ON ma.id = nm.media_asset_id
`;

export const findByNewsId = async (
  newsId: number,
  client?: PoolClient
): Promise<NewsMediaItem[]> => {
  const db = client ?? pool;

  const result = await db.query<NewsMediaItem>(
    `
          ${MEDIA_SELECT}

          WHERE nm.news_id = $1

          AND ma.status = 'ACTIVE'

          ORDER BY
            nm.display_order ASC,
            nm.id ASC;
        `,
    [newsId]
  );

  return result.rows.map((row) => ({
    ...row,

    id: Number(row.id),

    mediaAssetId: Number(row.mediaAssetId),

    displayOrder: Number(row.displayOrder),

    fileSizeBytes:
      row.fileSizeBytes === null ? null : Number(row.fileSizeBytes),

    width: row.width === null ? null : Number(row.width),

    height: row.height === null ? null : Number(row.height)
  }));
};

export const getNextDisplayOrder = async (
  newsId: number,
  client?: PoolClient
): Promise<number> => {
  const db = client ?? pool;

  const result = await db.query<{
    next_order: number;
  }>(
    `
          SELECT
            COALESCE(
              MAX(display_order),
              0
            ) + 1 AS next_order

          FROM news_media

          WHERE news_id = $1;
        `,
    [newsId]
  );

  return Number(result.rows[0]?.next_order ?? 1);
};

export const createAssetAndLink = async (
  input: {
    newsId: number;

    provider: string;

    assetType: string;

    publicId: string;

    originalFileName: string;

    mimeType: string;

    fileExtension: string;

    fileSizeBytes: number;

    width: number | null;

    height: number | null;

    altText: string | null;

    caption: string | null;

    fileUrl: string;

    thumbnailUrl: string | null;

    uploadedBy: number;

    displayOrder: number;
  },

  client: PoolClient
): Promise<NewsMediaItem> => {
  const assetResult = await client.query<{
    id: number;
  }>(
    `
          INSERT INTO media_assets
          (
            provider,
            asset_type,
            public_id,
            original_file_name,
            mime_type,
            file_extension,
            file_size_bytes,
            width,
            height,
            alt_text,
            caption,
            file_url,
            thumbnail_url,
            status,
            uploaded_by
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            'ACTIVE',
            $14
          )

          RETURNING id;
        `,
    [
      input.provider,
      input.assetType,
      input.publicId,
      input.originalFileName,
      input.mimeType,
      input.fileExtension,
      input.fileSizeBytes,
      input.width,
      input.height,
      input.altText,
      input.caption,
      input.fileUrl,
      input.thumbnailUrl,
      input.uploadedBy
    ]
  );

  const assetRow = assetResult.rows[0];

  if (!assetRow) {
    throw new Error("Failed to create media asset.");
  }

  const assetId = Number(assetRow.id);

  const linkResult = await client.query<{
    id: number;
  }>(
    `
      INSERT INTO news_media
      (
        news_id,
        media_asset_id,
        media_role,
        display_order
      )

      VALUES
      (
        $1,
        $2,
        'DETAIL',
        $3
      )

      RETURNING id;
    `,
    [input.newsId, assetId, input.displayOrder]
  );

  const linkRow = linkResult.rows[0];

  if (!linkRow) {
    throw new Error("Failed to create news media link.");
  }

  const result = await client.query<NewsMediaItem>(
    `
      ${MEDIA_SELECT}

      WHERE nm.id = $1;
    `,
    [linkRow.id]
  );

  const mediaItem = result.rows[0];

  if (!mediaItem) {
    throw new Error("Failed to retrieve created news media.");
  }

  return mediaItem;
};

export const reorder = async (
  newsId: number,
  items: MediaOrderItem[],
  client: PoolClient
): Promise<void> => {
  for (const item of items) {
    await client.query(
      `
          UPDATE news_media

          SET
            display_order = $1

          WHERE
            id = $2
            AND news_id = $3;
        `,
      [item.displayOrder, item.mediaId, newsId]
    );
  }
};

export const findMediaForDeletion = async (
  newsId: number,
  mediaId: number,
  client?: PoolClient
): Promise<{
  mediaAssetId: number;
  publicId: string;
} | null> => {
  const db = client ?? pool;

  const result = await db.query<{
    media_asset_id: number;
    public_id: string;
  }>(
    `
          SELECT
            nm.media_asset_id,
            ma.public_id

          FROM news_media nm

          INNER JOIN media_assets ma
            ON ma.id =
               nm.media_asset_id

          WHERE
            nm.id = $1
            AND nm.news_id = $2

          LIMIT 1;
        `,
    [mediaId, newsId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    mediaAssetId: Number(row.media_asset_id),

    publicId: row.public_id
  };
};

export const deleteLink = async (
  newsId: number,
  mediaId: number,
  client: PoolClient
): Promise<number | null> => {
  const result = await client.query<{
    media_asset_id: number;
  }>(
    `
          DELETE FROM news_media

          WHERE
            id = $1
            AND news_id = $2

          RETURNING media_asset_id;
        `,
    [mediaId, newsId]
  );

  return result.rows[0] ? Number(result.rows[0].media_asset_id) : null;
};

export const countAssetReferences = async (
  mediaAssetId: number,
  client?: PoolClient
): Promise<number> => {
  const db = client ?? pool;

  const result = await db.query<{
    count: string;
  }>(
    `
          SELECT
            COUNT(*)::text AS count

          FROM news_media

          WHERE media_asset_id = $1;
        `,
    [mediaAssetId]
  );

  return Number(result.rows[0]?.count ?? 0);
};

export const markAssetDeleted = async (
  mediaAssetId: number,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `
        UPDATE media_assets

        SET
          status = 'DELETED',
          updated_at = NOW()

        WHERE id = $1;
      `,
    [mediaAssetId]
  );
};
