import { type ErrorRequestHandler } from "express";
import { type ErrorResponse } from "../helper/response.helper";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("❌ [Server Error]:", {
    message: err.message,
    stack: err.stack,
    status: err.status || err.statusCode,
  });

  const response: ErrorResponse = {
    success: false,
    error_code: (err?.status || err?.statusCode || 500) as number,
    message: (err?.message || "Something went wrong!") as string,
    data: err?.data ?? {},
  };

  res.status(response.error_code).json(response);
};
