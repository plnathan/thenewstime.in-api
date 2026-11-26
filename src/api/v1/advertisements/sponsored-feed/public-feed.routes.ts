import { Router } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../../shared/utils/response.js";
import { ApiError } from "../../../../shared/utils/apiErrorInfo.js";
import * as repo from "./public-feed.repository.js";
import { verifyReceipt } from "./public-feed.token.js";
const router = Router();
const newsId = z
  .string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
const token = z.string().min(1).max(4096);
const impression = z.object({ token }).strict();
const click = z.object({ token, element: z.enum(repo.elements) }).strict();
router.get("/news/:newsId", async (req, res, next) => {
  try {
    const p = newsId.safeParse(req.params.newsId);
    if (!p.success) throw new ApiError(400, "Invalid news ID.");
    res.set("Cache-Control", "no-store");
    sendSuccess(res, "Sponsored feed retrieved.", await repo.deliver(p.data));
  } catch (e) {
    next(e);
  }
});
// Sponsored tracking uses signed receipts; it must not be sent to the
// conventional advertisement batch endpoint (different event schema).
const batchImpressions = z
  .object({ events: z.array(impression).min(1).max(25) })
  .strict();
const batchClicks = z
  .object({ events: z.array(click).min(1).max(25) })
  .strict();
router.post("/impressions/batch", async (req, res, next) => {
  try {
    const parsed = batchImpressions.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "Invalid sponsored impression batch.");
    sendSuccess(
      res,
      "Sponsored impressions processed.",
      await repo.trackBatch(parsed.data.events.map((e) => ({ token: e.token })))
    );
  } catch (error) {
    next(error);
  }
});
router.post("/clicks/batch", async (req, res, next) => {
  try {
    const parsed = batchClicks.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "Invalid sponsored click batch.");
    sendSuccess(
      res,
      "Sponsored clicks processed.",
      await repo.trackBatch(parsed.data.events)
    );
  } catch (error) {
    next(error);
  }
});
router.post("/impression", async (req, res, next) => {
  try {
    const p = impression.safeParse(req.body);
    if (!p.success) throw new ApiError(400, "Invalid impression.");
    sendSuccess(
      res,
      "Impression recorded.",
      await repo.track(verifyReceipt(p.data.token))
    );
  } catch (e) {
    next(e);
  }
});
router.post("/click", async (req, res, next) => {
  try {
    const p = click.safeParse(req.body);
    if (!p.success) throw new ApiError(400, "Invalid click.");
    sendSuccess(
      res,
      "Click recorded.",
      await repo.track(verifyReceipt(p.data.token), p.data.element)
    );
  } catch (e) {
    next(e);
  }
});
export default router;
