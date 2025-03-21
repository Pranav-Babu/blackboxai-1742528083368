const request = require('supertest');
const express = require('express');
const app = require('../../server');
const config = require('../../config/config');
const logger = require('../../utils/logger');

describe('Server Configuration', () => {
  beforeAll(() => {
    // Disable logging during tests
    logger.transports.forEach(t => {
      t.silent = true;
    });
  });

  describe('Basic Server Setup', () => {
    it('should be an express application', () => {
      expect(app).toBeInstanceOf(express);
    });

    it('should use JSON middleware', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should handle CORS', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', config.security.cors.origin);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should set security headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('API Routes', () => {
    it('should handle /api/auth routes', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle /api/pharmacies routes', async () => {
      const response = await request(app)
        .get('/api/pharmacies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle /api/medicines routes', async () => {
      const response = await request(app)
        .get('/api/medicines');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Health Check', () => {
    it('should respond to health check', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.environment).toBe(config.env);
    });
  });

  describe('API Documentation', () => {
    it('should redirect to API documentation', async () => {
      const response = await request(app)
        .get('/api-docs');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('documenter.getpostman.com');
    });
  });

  describe('Maintenance Mode', () => {
    it('should handle maintenance mode', async () => {
      // Enable maintenance mode
      const originalMode = config.maintenance.enabled;
      config.maintenance.enabled = true;

      const response = await request(app)
        .get('/api/medicines');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe(config.maintenance.message);

      // Restore original maintenance mode setting
      config.maintenance.enabled = originalMode;
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting', async () => {
      const requests = Array(101).fill().map(() =>
        request(app).get('/api/medicines')
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.success).toBe(false);
    });
  });

  describe('Static Files', () => {
    it('should serve static files', async () => {
      const response = await request(app)
        .get('/uploads/test.jpg');

      // Should return 404 if file doesn't exist, but route should be handled
      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle async errors', async () => {
      const response = await request(app)
        .get('/api/medicines/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/nonexistent/route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Resource not found');
    });
  });

  describe('Request Parsing', () => {
    it('should parse JSON bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(401); // Invalid credentials but request was parsed
    });

    it('should parse URL-encoded bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .type('form')
        .send('email=test@example.com&password=password123');

      expect(response.status).toBe(401); // Invalid credentials but request was parsed
    });

    it('should handle large payloads', async () => {
      const largeData = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB

      const response = await request(app)
        .post('/api/auth/login')
        .send(largeData);

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('Compression', () => {
    it('should compress responses', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .set('Accept-Encoding', 'gzip,deflate');

      expect(response.headers['content-encoding']).toBeDefined();
    });
  });

  describe('Security Features', () => {
    it('should prevent NoSQL injection', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: { $ne: null }, password: { $ne: null } });

      expect(response.status).toBe(400);
    });

    it('should prevent XSS attacks', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '<script>alert("xss")</script>',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
    });
  });
});