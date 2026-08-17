import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

import { ApiError } from "../utils/apiErrorInfo.js";

const getClient = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  const apiKey = process.env.CLOUDINARY_API_KEY;

  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(500, "Cloudinary configuration is missing.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  return cloudinary;
};

export const uploadImageBuffer = async (
  buffer: Buffer,
  options: {
    folder: string;
    publicId?: string;
  }
): Promise<UploadApiResponse> => {
  const client = getClient();

  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: options.folder,

      resource_type: "image" as const,

      overwrite: false,

      use_filename: false,

      unique_filename: true,

      ...(options.publicId
        ? {
            public_id: options.publicId
          }
        : {})
    };

    const stream = client.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));

          return;
        }

        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

export const deleteCloudinaryImage = async (
  publicId: string
): Promise<void> => {
  const client = getClient();

  await client.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true
  });
};

export const getThumbnailUrl = (publicId: string): string => {
  const client = getClient();

  return client.url(publicId, {
    secure: true,

    resource_type: "image",

    type: "upload",

    transformation: [
      {
        width: 400,
        height: 225,
        crop: "fill",
        gravity: "auto"
      },
      {
        quality: "auto",
        fetch_format: "auto"
      }
    ]
  });
};
