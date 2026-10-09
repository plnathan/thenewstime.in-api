import multer from "multer";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
]);

const allowedVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);

export const advertisementCreativeUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 1,
    fileSize: MAX_VIDEO_SIZE_BYTES
  },

  fileFilter: (_req, file, callback) => {
    if (
      allowedImageMimeTypes.has(file.mimetype) ||
      allowedVideoMimeTypes.has(file.mimetype)
    ) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        "Unsupported creative file type. Upload a JPEG, PNG, WEBP, GIF, AVIF, MP4, WEBM, or MOV file."
      )
    );
  }
});
