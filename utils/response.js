/**
 * Shared response helpers for consistent API responses across all routes.
 */

const sendSuccess = (res, message, data = {}, statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

module.exports = { sendSuccess, sendError };
