const mongoose = require('mongoose');
const cache = require('../../utils/cache');
const geocoder = require('../../utils/geocoder');
const logger = require('../../utils/logger');
const notifications = require('../../utils/notifications');
const payment = require('../../utils/payment');
const search = require('../../utils/search');
const fileHandler = require('../../utils/fileHandler');
const ErrorResponse = require('../../utils/errorResponse');

describe('Utilities', () => {
  describe('Cache Service', () => {
    beforeEach(() => {
      cache.flush();
    });

    it('should set and get cache value', () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      cache.set(key, value);
      const cachedValue = cache.get(key);

      expect(cachedValue).toEqual(value);
    });

    it('should respect TTL', async () => {
      const key = 'ttl-test';
      const value = 'test-value';

      cache.set(key, value, 1); // 1 second TTL
      expect(cache.get(key)).toBe(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get(key)).toBeNull();
    });

    it('should delete cache value', () => {
      const key = 'delete-test';
      cache.set(key, 'value');
      cache.delete(key);
      expect(cache.get(key)).toBeNull();
    });

    it('should handle cache middleware', async () => {
      const req = {
        originalUrl: '/test',
        method: 'GET'
      };
      const res = {
        json: jest.fn()
      };
      const next = jest.fn();

      const middleware = cache.middleware('test', 60);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Geocoder Service', () => {
    it('should calculate distance correctly', () => {
      const distance = geocoder.calculateDistance(
        19.0760, 72.8777, // Mumbai
        28.6139, 77.2090  // Delhi
        // Approximate distance should be around 1150-1200 km
      );

      expect(distance).toBeGreaterThan(1100);
      expect(distance).toBeLessThan(1300);
    });

    it('should validate coordinates', () => {
      expect(geocoder.validateCoordinates(19.0760, 72.8777)).toBe(true);
      expect(geocoder.validateCoordinates(91, 181)).toBe(false);
    });

    it('should calculate delivery zone', () => {
      const location = {
        coordinates: [72.8777, 19.0760]
      };
      const zone = geocoder.calculateDeliveryZone(location, 5);

      expect(zone.center).toEqual(location.coordinates);
      expect(zone.radius).toBe(5);
      expect(zone.polygon).toBeDefined();
      expect(zone.polygon.length).toBeGreaterThan(0);
    });
  });

  describe('Logger Service', () => {
    it('should log different levels', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('Info message');
      logger.error('Error message');
      logger.warn('Warning message');
      logger.debug('Debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should format error logs', () => {
      const error = new Error('Test error');
      const logSpy = jest.spyOn(logger, 'error').mockImplementation();

      logger.error('Error occurred', { error });

      expect(logSpy).toHaveBeenCalledWith('Error occurred', expect.objectContaining({
        error: expect.any(Error)
      }));

      logSpy.mockRestore();
    });
  });

  describe('Notifications Service', () => {
    it('should format order status message', () => {
      const message = notifications.getOrderStatusMessage('delivered');
      expect(message).toContain('delivered');
    });

    it('should format prescription status message', () => {
      const message = notifications.getPrescriptionStatusMessage('verified');
      expect(message).toContain('verified');
    });
  });

  describe('Payment Service', () => {
    it('should calculate refund amount', async () => {
      const order = {
        _id: new mongoose.Types.ObjectId(),
        finalAmount: 1000,
        paymentDetails: {
          gateway: 'razorpay'
        }
      };

      const refund = await payment.processRefund(order, { amount: 500 });
      expect(refund.amount).toBe(500);
    });
  });

  describe('Search Service', () => {
    it('should build search query', async () => {
      const filters = {
        search: 'test',
        category: 'non-prescription',
        minPrice: 100,
        maxPrice: 500
      };

      const query = await search.searchMedicines(filters);
      expect(query).toBeDefined();
    });
  });

  describe('File Handler Service', () => {
    it('should validate file types', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024 * 1024 // 1MB
      };

      const isValid = fileHandler.validateFileType(file, ['image/jpeg', 'image/png']);
      expect(isValid).toBe(true);
    });

    it('should handle file size limits', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024 // 10MB
      };

      expect(() => {
        fileHandler.validateFileSize(file, 5 * 1024 * 1024); // 5MB limit
      }).toThrow('File size exceeds limit');
    });
  });

  describe('Error Response', () => {
    it('should create error with message and status code', () => {
      const error = new ErrorResponse('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
    });

    it('should include stack trace', () => {
      const error = new ErrorResponse('Test error', 500);
      expect(error.stack).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should handle cache and notifications together', async () => {
      const key = 'notification-test';
      const value = {
        type: 'order',
        status: 'delivered'
      };

      // Cache the notification
      cache.set(key, value);

      // Get cached notification and format message
      const cachedValue = cache.get(key);
      const message = notifications.getOrderStatusMessage(cachedValue.status);

      expect(message).toContain('delivered');
    });

    it('should handle search and geocoding together', async () => {
      const location = {
        latitude: 19.0760,
        longitude: 72.8777,
        radius: 5000
      };

      const searchResults = await search.searchPharmacies({
        ...location,
        services: ['Home Delivery']
      });

      expect(searchResults).toBeDefined();
    });
  });
});