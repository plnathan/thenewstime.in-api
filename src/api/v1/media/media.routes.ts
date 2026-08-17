import { Router } from "express";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import * as controller from "./media.controller.js";

import {
  mediaDeleteParamsSchema,
  mediaNewsParamsSchema,
  mediaOrderSchema,
  mediaUploadBodySchema
} from "./media.validation.js";

import { mediaUpload } from "./media.upload.js";

const router = Router();

router.get(
  "/news/:newsId",
  validate(mediaNewsParamsSchema, "params"),
  controller.getNewsMedia
);

router.post(
  "/news/:newsId",
  validate(mediaNewsParamsSchema, "params"),
  mediaUpload.array("files", 10),
  validate(mediaUploadBodySchema, "body"),
  controller.uploadNewsMedia
);

router.patch(
  "/news/:newsId/order",
  validate(mediaNewsParamsSchema, "params"),
  validate(mediaOrderSchema, "body"),
  controller.reorderNewsMedia
);

router.delete(
  "/news/:newsId/:mediaId",
  validate(mediaDeleteParamsSchema, "params"),
  controller.deleteNewsMedia
);

export default router;
