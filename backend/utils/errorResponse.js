/**
 * Custom error class for handling operational errors
 * @extends Error
 */
class ErrorResponse extends Error {
  /**
   * Creates a new ErrorResponse instance
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} [additionalInfo] - Additional error information
   */
  constructor(message, statusCode, additionalInfo = {}) {
    super(message);
    this.statusCode = statusCode;
    this.additionalInfo = additionalInfo;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);

    // Add timestamp
    this.timestamp = new Date().toISOString();

    // Set error name
    this.name = this.constructor.name;

    // Add error classification
    this.isOperational = true;

    // Add error code based on status code
    this.code = this.generateErrorCode(statusCode);
  }

  /**
   * Generates an error code based on the status code
   * @param {number} statusCode - HTTP status code
   * @returns {string} Error code
   * @private
   */
  generateErrorCode(statusCode) {
    const prefix = 'ERR';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}_${statusCode}_${timestamp}`;
  }

  /**
   * Creates a formatted error object
   * @returns {Object} Formatted error object
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        status: this.statusCode,
        message: this.message,
        timestamp: this.timestamp,
        ...(Object.keys(this.additionalInfo).length > 0 && {
          details: this.additionalInfo
        })
      }
    };
  }

  /**
   * Creates a validation error
   * @param {string} message - Error message
   * @param {Object} [fields] - Validation errors by field
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static validation(message, fields = {}) {
    return new ErrorResponse(message, 400, { fields });
  }

  /**
   * Creates an authentication error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static authentication(message = 'Authentication failed') {
    return new ErrorResponse(message, 401);
  }

  /**
   * Creates an authorization error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static authorization(message = 'Not authorized') {
    return new ErrorResponse(message, 403);
  }

  /**
   * Creates a not found error
   * @param {string} resource - Resource that wasn't found
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static notFound(resource = 'Resource') {
    return new ErrorResponse(`${resource} not found`, 404);
  }

  /**
   * Creates a conflict error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static conflict(message) {
    return new ErrorResponse(message, 409);
  }

  /**
   * Creates a rate limit error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static rateLimit(message = 'Too many requests') {
    return new ErrorResponse(message, 429);
  }

  /**
   * Creates a business logic error
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static business(message, details = {}) {
    return new ErrorResponse(message, 422, details);
  }

  /**
   * Creates a server error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static server(message = 'Internal server error') {
    return new ErrorResponse(message, 500);
  }

  /**
   * Creates a service unavailable error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ErrorResponse(message, 503);
  }

  /**
   * Creates a timeout error
   * @param {string} message - Error message
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static timeout(message = 'Request timeout') {
    return new ErrorResponse(message, 408);
  }

  /**
   * Creates a bad request error
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   * @returns {ErrorResponse} New ErrorResponse instance
   * @static
   */
  static badRequest(message, details = {}) {
    return new ErrorResponse(message, 400, details);
  }
}

module.exports = ErrorResponse;