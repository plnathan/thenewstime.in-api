import type { NextFunction, Request, Response } from "express";

import { sendSuccess } from "../../../../shared/utils/response.js";

import * as service from "./rotation.service.js";

import type {
  CreateAdvertisementRotationMemberInput,
  UpdateAdvertisementRotationConfigInput,
  UpdateAdvertisementRotationMemberInput
} from "./rotation.types.js";

export const getConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await service.getRotationConfig(
      Number(req.params.placementId)
    );

    sendSuccess(
      res,
      "Advertisement rotation configuration retrieved successfully.",
      config
    );
  } catch (error) {
    next(error);
  }
};

export const updateConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateAdvertisementRotationConfigInput;

    const config = await service.updateRotationConfig(
      Number(req.params.placementId),
      input,
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement rotation configuration updated successfully.",
      config
    );
  } catch (error) {
    next(error);
  }
};

export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const members = await service.getMembers(Number(req.params.placementId));

    sendSuccess(
      res,
      "Advertisement rotation members retrieved successfully.",
      members
    );
  } catch (error) {
    next(error);
  }
};

export const addMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as CreateAdvertisementRotationMemberInput;

    const member = await service.addMember(
      Number(req.params.placementId),
      input,
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement rotation member added successfully.",
      member,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const input = req.body as UpdateAdvertisementRotationMemberInput;

    const member = await service.updateMember(
      Number(req.params.placementId),
      Number(req.params.memberId),
      input,
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement rotation member updated successfully.",
      member
    );
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await service.removeMember(
      Number(req.params.placementId),
      Number(req.params.memberId),
      req.user.id
    );

    sendSuccess(
      res,
      "Advertisement rotation member deactivated successfully.",
      member
    );
  } catch (error) {
    next(error);
  }
};
