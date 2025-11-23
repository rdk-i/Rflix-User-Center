const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * Returns standardized error responses
 */
function errorHandler(err, req, res, next) {
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: message,
      details: process.env.NODE_ENV === 'development' ? err.stack : null,
    },
  });
}

module.exports = errorHandler;
