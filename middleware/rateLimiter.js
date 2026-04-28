const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for content creation/mutation endpoints.
 * Allows 15 requests per 15 minutes per IP.
 */
const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

module.exports = { mutationLimiter };
