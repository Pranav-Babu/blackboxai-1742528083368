const path = require('path');
const config = require('../../config/config');

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Environment Settings', () => {
    it('should use default environment settings', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.HOST;

      const freshConfig = require('../../config/config');

      expect(freshConfig.env).toBe('development');
      expect(freshConfig.port).toBe(5000);
      expect(freshConfig.host).toBe('localhost');
    });

    it('should use environment variables when provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8000';
      process.env.HOST = 'example.com';

      const freshConfig = require('../../config/config');

      expect(freshConfig.env).toBe('production');
      expect(freshConfig.port).toBe(8000);
      expect(freshConfig.host).toBe('example.com');
    });

    it('should set correct environment flags', () => {
      process.env.NODE_ENV = 'production';
      const prodConfig = require('../../config/config');
      expect(prodConfig.isProduction).toBe(true);
      expect(prodConfig.isDevelopment).toBe(false);

      process.env.NODE_ENV = 'development';
      const devConfig = require('../../config/config');
      expect(devConfig.isDevelopment).toBe(true);
      expect(devConfig.isProduction).toBe(false);
    });
  });

  describe('Database Configuration', () => {
    it('should use default MongoDB URI if not provided', () => {
      delete process.env.MONGODB_URI;
      const freshConfig = require('../../config/config');
      expect(freshConfig.mongodb.uri).toBe('mongodb://localhost:27017/pharmacy-delivery');
    });

    it('should use provided MongoDB URI', () => {
      process.env.MONGODB_URI = 'mongodb://custom:27017/test';
      const freshConfig = require('../../config/config');
      expect(freshConfig.mongodb.uri).toBe('mongodb://custom:27017/test');
    });

    it('should have correct MongoDB options', () => {
      expect(config.mongodb.options).toEqual({
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    });
  });

  describe('JWT Configuration', () => {
    it('should use default JWT settings if not provided', () => {
      delete process.env.JWT_SECRET;
      delete process.env.JWT_EXPIRE;
      delete process.env.JWT_COOKIE_EXPIRE;

      const freshConfig = require('../../config/config');

      expect(freshConfig.jwt.secret).toBe('your_jwt_secret_key_here');
      expect(freshConfig.jwt.expire).toBe('30d');
      expect(freshConfig.jwt.cookie.expire).toBe(30);
    });

    it('should use provided JWT settings', () => {
      process.env.JWT_SECRET = 'custom_secret';
      process.env.JWT_EXPIRE = '7d';
      process.env.JWT_COOKIE_EXPIRE = '7';

      const freshConfig = require('../../config/config');

      expect(freshConfig.jwt.secret).toBe('custom_secret');
      expect(freshConfig.jwt.expire).toBe('7d');
      expect(freshConfig.jwt.cookie.expire).toBe(7);
    });
  });

  describe('File Upload Configuration', () => {
    it('should have correct file upload settings', () => {
      expect(config.upload.maxSize).toBe(5 * 1024 * 1024); // 5MB
      expect(config.upload.types.prescription.maxCount).toBe(5);
      expect(config.upload.types.medicine.maxCount).toBe(3);
      expect(config.upload.types.profile.maxCount).toBe(1);
    });

    it('should use correct upload path', () => {
      process.env.UPLOAD_PATH = 'custom-uploads';
      const freshConfig = require('../../config/config');
      expect(freshConfig.upload.path).toBe('custom-uploads');
    });
  });

  describe('Geocoding Configuration', () => {
    it('should use default geocoding provider if not provided', () => {
      delete process.env.GEOCODER_PROVIDER;
      const freshConfig = require('../../config/config');
      expect(freshConfig.geocoding.provider).toBe('google');
    });

    it('should use provided geocoding settings', () => {
      process.env.GEOCODER_PROVIDER = 'mapbox';
      process.env.GEOCODER_API_KEY = 'test_api_key';

      const freshConfig = require('../../config/config');

      expect(freshConfig.geocoding.provider).toBe('mapbox');
      expect(freshConfig.geocoding.apiKey).toBe('test_api_key');
    });
  });

  describe('Delivery Configuration', () => {
    it('should have correct delivery slots', () => {
      expect(config.delivery.slots).toContain('9 AM');
      expect(config.delivery.slots).toContain('6 PM');
    });

    it('should have correct delivery charges configuration', () => {
      expect(config.delivery.charges.base).toBe(50);
      expect(config.delivery.charges.perKm).toBe(10);
      expect(config.delivery.charges.min).toBe(50);
      expect(config.delivery.charges.max).toBe(200);
    });
  });

  describe('Order Configuration', () => {
    it('should have correct order timeouts', () => {
      expect(config.order.timeouts.pharmacyApproval).toBe(10 * 60 * 1000); // 10 minutes
      expect(config.order.timeouts.customerConfirmation).toBe(10 * 60 * 1000);
    });

    it('should have correct order statuses', () => {
      expect(config.order.statuses.pendingApproval).toBe('pending_approval');
      expect(config.order.statuses.delivered).toBe('delivered');
    });
  });

  describe('Security Configuration', () => {
    it('should have correct CORS settings', () => {
      process.env.CORS_ORIGIN = 'http://example.com';
      const freshConfig = require('../../config/config');

      expect(freshConfig.security.cors.origin).toBe('http://example.com');
      expect(freshConfig.security.cors.credentials).toBe(true);
    });

    it('should have correct rate limiting settings', () => {
      expect(config.rateLimit.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.rateLimit.max).toBe(100);
    });
  });

  describe('Notification Configuration', () => {
    it('should have correct email settings', () => {
      process.env.EMAIL_FROM = 'test@example.com';
      process.env.SMTP_HOST = 'smtp.test.com';
      const freshConfig = require('../../config/config');

      expect(freshConfig.notifications.email.from).toBe('test@example.com');
      expect(freshConfig.notifications.email.smtp.host).toBe('smtp.test.com');
    });

    it('should have correct SMS settings', () => {
      process.env.SMS_PROVIDER = 'twilio';
      process.env.SMS_API_KEY = 'test_key';
      const freshConfig = require('../../config/config');

      expect(freshConfig.notifications.sms.provider).toBe('twilio');
      expect(freshConfig.notifications.sms.apiKey).toBe('test_key');
    });
  });

  describe('Cache Configuration', () => {
    it('should have correct cache settings', () => {
      expect(config.cache.ttl).toBe(60 * 60 * 1000); // 1 hour
      expect(config.cache.checkPeriod).toBe(60 * 60 * 1000);
    });
  });

  describe('Maintenance Mode', () => {
    it('should handle maintenance mode setting', () => {
      process.env.MAINTENANCE_MODE = 'true';
      const freshConfig = require('../../config/config');

      expect(freshConfig.maintenance.enabled).toBe(true);
      expect(freshConfig.maintenance.message).toBeDefined();
    });
  });
});