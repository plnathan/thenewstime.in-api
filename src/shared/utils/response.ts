import { type Response } from "express";

import type {
  ApiResponse,
  PaginationMeta,
  ValidationError
} from "./apiResponse.js";

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data: T | null = null,
  statusCode = 200
): Response<ApiResponse<T>> => {

  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
    meta: null
  });

};

export const sendCreated = <T>(
  res: Response,
  message: string,
  data: T
): Response<ApiResponse<T>> => {

  return sendSuccess(
    res,
    message,
    data,
    201
  );

};

export const sendPaginated = <T>(
  res: Response,
  message: string,
  data: T,
  meta: PaginationMeta
): Response<ApiResponse<T>> => {

  return res.status(200).json({
    success: true,
    message,
    data,
    errors: null,
    meta
  });

};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors: ValidationError[] | null = null
): Response<ApiResponse<null>> => {

  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
    meta: null
  });

};

/*
export const sendSuccess = (
  res: Response,
  message: string,
  data: unknown = null,
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const sendPaginatedSuccess = (
  res: Response,
  message: string,
  data: unknown,
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  },
  statusCode = 200
) => {
  return res
    .status(statusCode)
    .json({ success: true, message, data, pagination });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  error: unknown = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    error
  });
};
*/