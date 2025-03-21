const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// Define severity levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each severity level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

// Tell winston about our colors
winston.addColors(colors);

// Custom format for logging
const logFormat = winston.format.combine(
  // Add timestamp
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  // Add error stack trace if available
  winston.format.errors({ stack: true }),
  // Add custom format
  winston.format.printf(info => {
    const { timestamp, level, message, stack, ...meta } = info;
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if exists
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format: logFormat,
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true })
      )
    }),
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(config.logging.file),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    // Write error logs to separate file
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Create a stream object for Morgan HTTP logging
logger.stream = {
  write: message => logger.http(message.trim())
};

// Utility functions for structured logging
const logStructured = (level, message, meta = {}) => {
  logger[level](message, { ...meta, timestamp: new Date().toISOString() });
};

// Extended logging functions
const loggerExtended = {
  // Basic logging functions
  error: (message, meta) => logStructured('error', message, meta),
  warn: (message, meta) => logStructured('warn', message, meta),
  info: (message, meta) => logStructured('info', message, meta),
  http: (message, meta) => logStructured('http', message, meta),
  debug: (message, meta) => logStructured('debug', message, meta),

  // API request logging
  apiRequest: (req, meta = {}) => {
    logStructured('http', 'API Request', {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
      ip: req.ip,
      ...meta
    });
  },

  // API response logging
  apiResponse: (req, res, responseTime, meta = {}) => {
    logStructured('http', 'API Response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ...meta
    });
  },

  // Error logging with stack trace
  errorWithStack: (error, meta = {}) => {
    logStructured('error', error.message, {
      stack: error.stack,
      ...meta
    });
  },

  // Database operation logging
  dbOperation: (operation, collection, query, meta = {}) => {
    logStructured('debug', 'Database Operation', {
      operation,
      collection,
      query,
      ...meta
    });
  },

  // Authentication logging
  auth: (action, userId, meta = {}) => {
    logStructured('info', 'Authentication', {
      action,
      userId,
      ...meta
    });
  },

  // File operation logging
  fileOperation: (operation, filePath, meta = {}) => {
    logStructured('debug', 'File Operation', {
      operation,
      filePath,
      ...meta
    });
  },

  // Performance logging
  performance: (action, duration, meta = {}) => {
    logStructured('info', 'Performance Metric', {
      action,
      duration: `${duration}ms`,
      ...meta
    });
  },

  // Security event logging
  security: (event, meta = {}) => {
    logStructured('warn', 'Security Event', {
      event,
      ...meta
    });
  },

  // Business event logging
  business: (event, meta = {}) => {
    logStructured('info', 'Business Event', {
      event,
      ...meta
    });
  },

  // System event logging
  system: (event, meta = {}) => {
    logStructured('info', 'System Event', {
      event,
      ...meta
    });
  }
};

// Export both the basic logger and extended functions
module.exports = {
  ...logger,
  ...loggerExtended
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggerExtended.errorWithStack(error, {
    type: 'UncaughtException'
  });
  
  // Exit with error
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  loggerExtended.errorWithStack(reason, {
    type: 'UnhandledRejection',
    promise: promise
  });
});

// Log when the process is about to exit
process.on('exit', (code) => {
  loggerExtended.system('Process Exit', {
    exitCode: code
  });
});