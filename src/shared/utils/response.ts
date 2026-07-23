import { type Response } from "express";

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
//----------------------