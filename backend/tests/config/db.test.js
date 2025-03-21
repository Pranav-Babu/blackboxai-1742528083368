const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../config/db');
const config = require('../../config/config');
const logger = require('../../utils/logger');

describe('Database Configuration', () => {
  let mongoServer;

  beforeAll(async () => {
    // Create an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should connect to database successfully', async () => {
    const logSpy = jest.spyOn(logger, 'info');
    
    await connectDB();
    
    expect(mongoose.connection.readyState).toBe(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MongoDB Connected')
    );
  });

  it('should handle connection errors', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    const invalidUri = 'mongodb://invalid:27017/test';
    process.env.MONGODB_URI = invalidUri;

    try {
      await connectDB();
    } catch (error) {
      expect(error).toBeDefined();
      expect(errorSpy).toHaveBeenCalled();
    }

    // Restore valid URI
    process.env.MONGODB_URI = mongoServer.getUri();
  });

  it('should use correct database options', async () => {
    const connectSpy = jest.spyOn(mongoose, 'connect');
    
    await connectDB();

    expect(connectSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        useNewUrlParser: true,
        useUnifiedTopology: true
      })
    );
  });

  it('should handle disconnection', async () => {
    const logSpy = jest.spyOn(logger, 'info');
    
    await connectDB();
    await mongoose.disconnect();

    expect(mongoose.connection.readyState).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MongoDB Disconnected')
    );
  });

  describe('Connection Events', () => {
    it('should handle connection error event', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      
      await connectDB();
      mongoose.connection.emit('error', new Error('Test error'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MongoDB connection error'),
        expect.any(Error)
      );
    });

    it('should handle disconnected event', async () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      await connectDB();
      mongoose.connection.emit('disconnected');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('MongoDB Disconnected')
      );
    });

    it('should handle reconnected event', async () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      await connectDB();
      mongoose.connection.emit('reconnected');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('MongoDB Reconnected')
      );
    });
  });

  describe('Environment Configuration', () => {
    it('should use correct URI based on environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalUri = process.env.MONGODB_URI;

      // Test production environment
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://production/db';
      
      const connectSpy = jest.spyOn(mongoose, 'connect');
      await connectDB();

      expect(connectSpy).toHaveBeenCalledWith(
        'mongodb://production/db',
        expect.any(Object)
      );

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
      process.env.MONGODB_URI = originalUri;
    });

    it('should use default URI if not provided', async () => {
      const originalUri = process.env.MONGODB_URI;
      delete process.env.MONGODB_URI;

      const connectSpy = jest.spyOn(mongoose, 'connect');
      await connectDB();

      expect(connectSpy).toHaveBeenCalledWith(
        config.mongodb.uri,
        expect.any(Object)
      );

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    });
  });

  describe('Error Handling', () => {
    it('should handle initial connection failure', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // Force connection failure
      jest.spyOn(mongoose, 'connect').mockRejectedValueOnce(new Error('Connection failed'));

      try {
        await connectDB();
      } catch (error) {
        expect(error.message).toBe('Connection failed');
        expect(errorSpy).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(1);
      }

      exitSpy.mockRestore();
    });

    it('should handle connection timeout', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const timeoutError = new Error('Connection timed out');
      timeoutError.name = 'MongoTimeoutError';

      jest.spyOn(mongoose, 'connect').mockRejectedValueOnce(timeoutError);

      try {
        await connectDB();
      } catch (error) {
        expect(error.name).toBe('MongoTimeoutError');
        expect(errorSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Connection Pool', () => {
    it('should handle connection pool events', async () => {
      const logSpy = jest.spyOn(logger, 'debug');
      
      await connectDB();
      mongoose.connection.emit('connected');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('MongoDB Connected')
      );
    });

    it('should clean up connection pool on disconnect', async () => {
      await connectDB();
      const closeSpy = jest.spyOn(mongoose.connection, 'close');
      
      await mongoose.disconnect();

      expect(closeSpy).toHaveBeenCalled();
    });
  });
});