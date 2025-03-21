const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    name: err.name,
    code: err.code,
    message: err.message,
    stack: err.stack
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ErrorResponse(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let field = Object.keys(err.keyPattern)[0];
    const message = `Duplicate value entered for ${field} field`;
    error = new ErrorResponse(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ErrorResponse(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token';
    error = new ErrorResponse(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Authentication token expired';
    error = new ErrorResponse(message, 401);
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size is too large';
    error = new ErrorResponse(message, 400);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files uploaded';
    error = new ErrorResponse(message, 400);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Invalid file type';
    error = new ErrorResponse(message, 400);
  }

  // Handle file system errors
  if (err.code === 'ENOENT') {
    const message = 'File not found';
    error = new ErrorResponse(message, 404);
  }

  // Handle network errors
  if (err.code === 'ECONNREFUSED') {
    const message = 'Service unavailable';
    error = new ErrorResponse(message, 503);
  }

  // Handle timeout errors
  if (err.code === 'ETIMEDOUT') {
    const message = 'Request timeout';
    error = new ErrorResponse(message, 408);
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    const message = 'Request entity too large';
    error = new ErrorResponse(message, 413);
  }

  // Handle unsupported media type
  if (err.type === 'entity.parse.failed') {
    const message = 'Unsupported media type';
    error = new ErrorResponse(message, 415);
  }

  // Custom application errors
  if (err.name === 'ApplicationError') {
    error = new ErrorResponse(err.message, err.statusCode);
  }

  // Business logic errors
  if (err.name === 'BusinessError') {
    error = new ErrorResponse(err.message, 422);
  }

  // Authentication errors
  if (err.name === 'AuthenticationError') {
    error = new ErrorResponse(err.message, 401);
  }

  // Authorization errors
  if (err.name === 'AuthorizationError') {
    error = new ErrorResponse(err.message, 403);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error = new ErrorResponse(err.message, 400);
  }

  // Resource not found
  if (err.name === 'NotFoundError') {
    error = new ErrorResponse(err.message, 404);
  }

  // Conflict errors
  if (err.name === 'ConflictError') {
    error = new ErrorResponse(err.message, 409);
  }

  // Rate limit errors
  if (err.name === 'RateLimitError') {
    error = new ErrorResponse('Too many requests', 429);
  }

  // Default error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });

  // Log error to monitoring service if in production
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement error logging service
    // Example: logError(error);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection:', err.message);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err.message);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = errorHandler;