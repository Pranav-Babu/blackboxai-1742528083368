const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const helpers = require('../helpers');
const config = require('../../config/config');

describe('Middleware', () => {
  describe('Auth Middleware', () => {
    let user;
    let token;

    beforeEach(async () => {
      await helpers.clearDatabase();
      user = await helpers.createUser('customer');
      token = helpers.generateToken(user);
    });

    describe('protect', () => {
      it('should allow access with valid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set(helpers.authHeader(token))
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should deny access without token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Not authorized to access this route');
      });

      it('should deny access with invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set(helpers.authHeader('invalid.token.here'))
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Not authorized to access this route');
      });

      it('should deny access with expired token', async () => {
        const expiredToken = jwt.sign(
          { id: user._id },
          config.jwt.secret,
          { expiresIn: '1ms' }
        );

        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 2));

        const response = await request(app)
          .get('/api/auth/me')
          .set(helpers.authHeader(expiredToken))
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Not authorized to access this route');
      });

      it('should deny access if user no longer exists', async () => {
        await user.deleteOne();

        const response = await request(app)
          .get('/api/auth/me')
          .set(helpers.authHeader(token))
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Not authorized to access this route');
      });

      it('should deny access if user is inactive', async () => {
        user.isActive = false;
        await user.save();

        const response = await request(app)
          .get('/api/auth/me')
          .set(helpers.authHeader(token))
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Your account has been deactivated');
      });
    });

    describe('authorize', () => {
      it('should allow access with correct role', async () => {
        const adminUser = await helpers.createUser('admin');
        const adminToken = helpers.generateToken(adminUser);

        const response = await request(app)
          .get('/api/auth/users') // Admin only route
          .set(helpers.authHeader(adminToken))
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should deny access with incorrect role', async () => {
        const response = await request(app)
          .get('/api/auth/users') // Admin only route
          .set(helpers.authHeader(token))
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Not authorized to access this route');
      });
    });

    describe('verifyPharmacy', () => {
      it('should allow access to verified pharmacy', async () => {
        const pharmacyUser = await helpers.createUser('pharmacy');
        const pharmacy = await helpers.createPharmacy(pharmacyUser);
        const pharmacyToken = helpers.generateToken(pharmacyUser);

        const response = await request(app)
          .get('/api/pharmacies/dashboard/stats')
          .set(helpers.authHeader(pharmacyToken))
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should deny access to unverified pharmacy', async () => {
        const pharmacyUser = await helpers.createUser('pharmacy');
        const pharmacy = await helpers.createPharmacy(pharmacyUser, {
          verificationStatus: 'pending'
        });
        const pharmacyToken = helpers.generateToken(pharmacyUser);

        const response = await request(app)
          .get('/api/pharmacies/dashboard/stats')
          .set(helpers.authHeader(pharmacyToken))
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Pharmacy not verified');
      });
    });
  });

  describe('Error Handler', () => {
    it('should handle validation errors', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle duplicate key errors', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'customer'
      };

      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Try to create second user with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User already exists with this email');
    });

    it('should handle cast errors', async () => {
      const response = await request(app)
        .get('/api/medicines/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Resource not found');
    });

    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/nonexistent/route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Resource not found');
    });

    it('should handle rate limit errors', async () => {
      // Make multiple requests quickly
      const requests = Array(101).fill().map(() =>
        request(app)
          .get('/api/medicines')
      );

      const responses = await Promise.all(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.success).toBe(false);
      expect(lastResponse.body.error).toContain('Too many requests');
    });
  });

  describe('File Upload Middleware', () => {
    it('should handle file size limits', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB

      const response = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(token))
        .attach('prescriptionImages', largeBuffer, 'large.jpg')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File too large');
    });

    it('should handle invalid file types', async () => {
      const response = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(token))
        .attach('prescriptionImages', Buffer.from('fake-exe'), 'file.exe')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });
  });
});