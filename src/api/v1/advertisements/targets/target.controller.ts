import type { NextFunction, Request, Response } from "express";

import * as targetService from "./target.service.js";

import {
  advertisementIdParamsSchema,
  createAdvertisementTargetSchema,
  replaceAdvertisementTargetsSchema,
  targetIdParamsSchema,
  updateAdvertisementTargetSchema
} from "./target.validation.js";

import type { UpdateAdvertisementTargetInput } from "./target.types.js";

function sendError(
  error: unknown,
  response: Response,
  next: NextFunction
): void {
  if (error instanceof targetService.AdvertisementTargetServiceError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: null,
      errors: null,
      meta: null
    });

    return;
  }

  next(error);
}

function sendValidationError(message: string, response: Response): void {
  response.status(400).json({
    success: false,
    message,
    data: null,
    errors: null,
    meta: null
  });
}

export async function getTargets(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const params = advertisementIdParamsSchema.safeParse(request.params);

  if (!params.success) {
    sendValidationError("Invalid advertisement ID.", response);
    return;
  }

  try {
    const targets = await targetService.listTargets(
      params.data.advertisementId
    );

    response.status(200).json({
      success: true,
      message: "Advertisement targeting rules retrieved successfully.",
      data: targets,
      errors: null,
      meta: null
    });
  } catch (error) {
    sendError(error, response, next);
  }
}

export async function createTarget(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const params = advertisementIdParamsSchema.safeParse(request.params);
  const body = createAdvertisementTargetSchema.safeParse(request.body);

  if (!params.success || !body.success) {
    sendValidationError("Invalid advertisement targeting request.", response);
    return;
  }

  try {
    const target = await targetService.addTarget(
      params.data.advertisementId,
      body.data
    );

    response.status(201).json({
      success: true,
      message: "Advertisement targeting rule created successfully.",
      data: target,
      errors: null,
      meta: null
    });
  } catch (error) {
    sendError(error, response, next);
  }
}

export async function updateTarget(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const params = targetIdParamsSchema.safeParse(request.params);
  const body = updateAdvertisementTargetSchema.safeParse(request.body);

  if (!params.success || !body.success) {
    sendValidationError("Invalid advertisement targeting update.", response);
    return;
  }

  /*
   * exactOptionalPropertyTypes is enabled in this project.
   *
   * Zod's inferred optional fields may include undefined.
   * Only copy defined properties into the service input.
   */
  const input: UpdateAdvertisementTargetInput = {
    ...(body.data.targetType !== undefined
      ? { targetType: body.data.targetType }
      : {}),
    ...(body.data.targetValue !== undefined
      ? { targetValue: body.data.targetValue }
      : {}),
    ...(body.data.isInclude !== undefined
      ? { isInclude: body.data.isInclude }
      : {})
  };

  try {
    const target = await targetService.editTarget(
      params.data.advertisementId,
      params.data.targetId,
      input
    );

    response.status(200).json({
      success: true,
      message: "Advertisement targeting rule updated successfully.",
      data: target,
      errors: null,
      meta: null
    });
  } catch (error) {
    sendError(error, response, next);
  }
}

export async function deleteTarget(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const params = targetIdParamsSchema.safeParse(request.params);

  if (!params.success) {
    sendValidationError(
      "Invalid advertisement targeting identifiers.",
      response
    );
    return;
  }

  try {
    await targetService.removeTarget(
      params.data.advertisementId,
      params.data.targetId
    );

    response.status(200).json({
      success: true,
      message: "Advertisement targeting rule deleted successfully.",
      data: {
        id: params.data.targetId
      },
      errors: null,
      meta: null
    });
  } catch (error) {
    sendError(error, response, next);
  }
}

export async function replaceAllTargets(
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> {
  const params = advertisementIdParamsSchema.safeParse(request.params);
  const body = replaceAdvertisementTargetsSchema.safeParse(request.body);

  if (!params.success || !body.success) {
    sendValidationError(
      "Invalid advertisement targeting configuration.",
      response
    );
    return;
  }

  try {
    const targets = await targetService.replaceTargets(
      params.data.advertisementId,
      body.data.targets
    );

    response.status(200).json({
      success: true,
      message: "Advertisement targeting configuration saved successfully.",
      data: targets,
      errors: null,
      meta: null
    });
  } catch (error) {
    sendError(error, response, next);
  }
}
