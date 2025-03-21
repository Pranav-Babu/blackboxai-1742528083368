const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const helpers = require('../helpers');

describe('Auth Controller', () => {
  beforeEach(async () => {
    await helpers.clearDatabase();
  });

  describe('POST /api/auth/register', () => {
    const registerEndpoint = '/api/auth/register';

    it('should register a new customer successfully', async () => {
      const userData = {
        name: 'Test Customer',
        email: 'customer@test.com',
        password: 'password123',
        phone: '1234567890',
        role: 'customer',
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456'
        }
      };

      const response = await request(app)
        .post(registerEndpoint)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should register a new pharmacy successfully', async () => {
      const pharmacyData = {
        name: 'Test Pharmacy',
        email: 'pharmacy@test.com',
        password: 'password123',
        phone: '9876543210',
        role: 'pharmacy',
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456'
        },
        storeName: 'Test Pharmacy Store',
        licenseNumber: 'TEST123',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.0760]
        }
      };

      const response = await request(app)
        .post(registerEndpoint)
        .send(pharmacyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.email).toBe(pharmacyData.email);
      expect(response.body.data.user.password).toBeUndefined();

      // Verify pharmacy profile was created
      const pharmacy = await Pharmacy.findOne({ user: response.body.data.user.id });
      expect(pharmacy).toBeDefined();
      expect(pharmacy.storeName).toBe(pharmacyData.storeName);
    });

    it('should not register with existing email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@test.com',
        password: 'password123',
        phone: '1234567890',
        role: 'customer'
      };

      // Create first user
      await helpers.createUser('customer', { email: userData.email });

      // Try to create second user with same email
      const response = await request(app)
        .post(registerEndpoint)
        .send(userData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User already exists with this email');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post(registerEndpoint)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    const loginEndpoint = '/api/auth/login';
    let user;

    beforeEach(async () => {
      user = await helpers.createUser('customer');
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post(loginEndpoint)
        .send({
          email: user.email,
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.data.user.email).toBe(user.email);
    });

    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post(loginEndpoint)
        .send({
          email: user.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post(loginEndpoint)
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should not login deactivated user', async () => {
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const response = await request(app)
        .post(loginEndpoint)
        .send({
          email: user.email,
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Your account has been deactivated');
    });
  });

  describe('GET /api/auth/me', () => {
    let user;
    let token;

    beforeEach(async () => {
      user = await helpers.createUser('customer');
      token = helpers.generateToken(user);
    });

    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(helpers.authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not access without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to access this route');
    });

    it('should not access with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set(helpers.authHeader('invalid.token.here'))
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to access this route');
    });
  });

  describe('PUT /api/auth/updatedetails', () => {
    let user;
    let token;

    beforeEach(async () => {
      user = await helpers.createUser('customer');
      token = helpers.generateToken(user);
    });

    it('should update user details', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '9876543210'
      };

      const response = await request(app)
        .put('/api/auth/updatedetails')
        .set(helpers.authHeader(token))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.phone).toBe(updateData.phone);
    });

    it('should not update email', async () => {
      const response = await request(app)
        .put('/api/auth/updatedetails')
        .set(helpers.authHeader(token))
        .send({ email: 'newemail@test.com' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/auth/updatepassword', () => {
    let user;
    let token;

    beforeEach(async () => {
      user = await helpers.createUser('customer');
      token = helpers.generateToken(user);
    });

    it('should update password', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set(helpers.authHeader(token))
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();

      // Try logging in with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should not update with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set(helpers.authHeader(token))
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
    });
  });
});