import type { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../../shared/utils/response.js";
import * as service from "./format.service.js";

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res).catch(next);
  };

export const getAll = wrap(async (_req, res) => {
  sendSuccess(res, "Formats retrieved.", await service.listFormats());
});

export const getById = wrap(async (req, res) => {
  sendSuccess(res, "Format retrieved.", await service.getFormat(req.params.id));
});

export const create = wrap(async (req, res) => {
  sendSuccess(
    res,
    "Format created.",
    await service.createFormat(req.body, req.user.id),
    201
  );
});

export const update = wrap(async (req, res) => {
  sendSuccess(
    res,
    "Format updated.",
    await service.updateFormat(req.params.id, req.body, req.user.id)
  );
});

export const activate = wrap(async (req, res) => {
  sendSuccess(
    res,
    "Format activated.",
    await service.activateFormat(req.params.id, req.user.id)
  );
});

export const deactivate = wrap(async (req, res) => {
  sendSuccess(
    res,
    "Format deactivated.",
    await service.deactivateFormat(req.params.id, req.user.id)
  );
});

export const archive = wrap(async (req, res) => {
  sendSuccess(
    res,
    "Format archived.",
    await service.archiveFormat(req.params.id, req.user.id)
  );
});
