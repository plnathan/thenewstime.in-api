import { Router } from "express";

import { validate } from "../../../../shared/middleware/validate.middleware.js";

import { authorize } from "../../security/middleware/authorize.middleware.js";

import * as controller from "./creative.controller.js";

import {
  advertisementIdSchema,
  createAdvertisementCreativeSchema,
  creativeIdSchema,
  updateAdvertisementCreativeSchema
} from "./creative.validation.js";

const router = Router({
  mergeParams: true
});

router.get(
  "/",
  authorize("ADVERTISEMENT", "advertisements.creatives", "read"),
  validate(advertisementIdSchema, "params"),
  controller.getAll
);

router.get(
  "/preview",
  authorize("ADVERTISEMENT", "advertisements.creatives", "read"),
  validate(advertisementIdSchema, "params"),
  controller.getAdvertisementPreview
);

router.post(
  "/",
  authorize("ADVERTISEMENT", "advertisements.creatives", "create"),
  validate(advertisementIdSchema, "params"),
  validate(createAdvertisementCreativeSchema, "body"),
  controller.create
);

router.get(
  "/:creativeId/preview",
  authorize("ADVERTISEMENT", "advertisements.creatives", "read"),
  validate(creativeIdSchema, "params"),
  controller.getPreview
);

router.get(
  "/:creativeId",
  authorize("ADVERTISEMENT", "advertisements.creatives", "read"),
  validate(creativeIdSchema, "params"),
  controller.getById
);

router.patch(
  "/:creativeId",
  authorize("ADVERTISEMENT", "advertisements.creatives", "update"),
  validate(creativeIdSchema, "params"),
  validate(updateAdvertisementCreativeSchema, "body"),
  controller.update
);

router.delete(
  "/:creativeId",
  authorize("ADVERTISEMENT", "advertisements.creatives", "delete"),
  validate(creativeIdSchema, "params"),
  controller.remove
);

export default router;

/*
| Operation             | Endpoint                                                             |
| --------------------- | -------------------------------------------------------------------- |
| List creatives        | `GET /advertisements/:advertisementId/creatives`                     |
| Advertisement preview | `GET /advertisements/:advertisementId/creatives/preview`             |
| Create creative       | `POST /advertisements/:advertisementId/creatives`                    |
| Creative detail       | `GET /advertisements/:advertisementId/creatives/:creativeId`         |
| Creative preview      | `GET /advertisements/:advertisementId/creatives/:creativeId/preview` |
| Update creative       | `PATCH /advertisements/:advertisementId/creatives/:creativeId`       |
| Deactivate creative   | `DELETE /advertisements/:advertisementId/creatives/:creativeId`      |
*/