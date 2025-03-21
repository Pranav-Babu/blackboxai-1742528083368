const mongoose = require('mongoose');
const logger = require('../utils/logger');

module.exports = async () => {
  try {
    // Close all mongoose connections
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');

    // Clean up any open handles
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up any temporary files created during tests
    const fs = require('fs').promises;
    const path = require('path');
    const uploadDir = path.join(__dirname, '../uploads/temp');
    
    try {
      const files = await fs.readdir(uploadDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(uploadDir, file)))
      );
      logger.info('Cleaned up temporary files');
    } catch (error) {
      // Ignore if directory doesn't exist
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Reset environment variables
    process.env.NODE_ENV = 'development';
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRE;

    // Clean up global test utilities
    if (global.testUtils) {
      delete global.testUtils;
    }

    // Re-enable logging
    logger.transports.forEach(t => {
      t.silent = false;
    });

    // Clean up any open timers
    const openHandles = process._getActiveHandles();
    openHandles.forEach(handle => {
      if (handle instanceof Timer) {
        clearTimeout(handle);
      }
    });

    // Clean up any test-specific caches
    const cache = require('../utils/cache');
    await cache.flush();

    // Clean up any test-specific schedulers
    const scheduler = require('../utils/scheduler');
    scheduler.cleanup();

    // Clean up any test-specific file uploads
    const fileHandler = require('../utils/fileHandler');
    await fileHandler.cleanTemp();

    logger.info('Test teardown completed successfully');
  } catch (error) {
    logger.error('Test teardown failed:', error);
    throw error;
  }
};

// Handle cleanup on process termination
process.on('SIGINT', async () => {
  try {
    await module.exports();
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup on SIGINT failed:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await module.exports();
    process.exit(0);
  } catch (error) {
    logger.error('Cleanup on SIGTERM failed:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions during teardown
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception during teardown:', error);
  try {
    await module.exports();
    process.exit(1);
  } catch (cleanupError) {
    logger.error('Cleanup after uncaught exception failed:', cleanupError);
    process.exit(1);
  }
});

// Handle unhandled rejections during teardown
process.on('unhandledRejection', async (error) => {
  logger.error('Unhandled rejection during teardown:', error);
  try {
    await module.exports();
    process.exit(1);
  } catch (cleanupError) {
    logger.error('Cleanup after unhandled rejection failed:', cleanupError);
    process.exit(1);
  }
});