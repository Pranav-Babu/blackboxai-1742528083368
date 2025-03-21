const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const Pharmacy = require('../../models/Pharmacy');
const Medicine = require('../../models/Medicine');

describe('Pharmacy Controller', () => {
  let pharmacyUser;
  let pharmacy;
  let token;
  let customerUser;
  let customerToken;

  beforeEach(async () => {
    await helpers.clearDatabase();
    
    // Create pharmacy user and profile
    pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    token = helpers.generateToken(pharmacyUser);

    // Create customer user
    customerUser = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customerUser);
  });

  describe('GET /api/pharmacies', () => {
    beforeEach(async () => {
      // Create additional pharmacies for testing
      const pharmacyUser2 = await helpers.createUser('pharmacy');
      await helpers.createPharmacy(pharmacyUser2, {
        location: {
          type: 'Point',
          coordinates: [72.9777, 19.1760]
        }
      });
    });

    it('should get all pharmacies', async () => {
      const response = await request(app)
        .get('/api/pharmacies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.data[0].storeName).toBeDefined();
    });

    it('should filter pharmacies by location', async () => {
      const response = await request(app)
        .get('/api/pharmacies')
        .query({
          latitude: 19.0760,
          longitude: 72.8777,
          radius: 5000 // 5km radius
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should search pharmacies by name', async () => {
      const response = await request(app)
        .get('/api/pharmacies')
        .query({
          search: pharmacy.storeName
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].storeName).toBe(pharmacy.storeName);
    });
  });

  describe('GET /api/pharmacies/:id', () => {
    it('should get pharmacy by id', async () => {
      const response = await request(app)
        .get(`/api/pharmacies/${pharmacy._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.storeName).toBe(pharmacy.storeName);
    });

    it('should return 404 for non-existent pharmacy', async () => {
      const fakeId = helpers.generateObjectId();
      const response = await request(app)
        .get(`/api/pharmacies/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Pharmacy not found');
    });
  });

  describe('PUT /api/pharmacies/profile', () => {
    it('should update pharmacy profile', async () => {
      const updateData = {
        storeName: 'Updated Pharmacy Name',
        contactInfo: {
          phone: '9876543210',
          email: 'updated@pharmacy.com'
        },
        operatingHours: [
          { day: 'Monday', open: '08:00', close: '22:00', isOpen: true }
        ]
      };

      const response = await request(app)
        .put('/api/pharmacies/profile')
        .set(helpers.authHeader(token))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.storeName).toBe(updateData.storeName);
      expect(response.body.data.contactInfo.phone).toBe(updateData.contactInfo.phone);
    });

    it('should not allow unauthorized access', async () => {
      const response = await request(app)
        .put('/api/pharmacies/profile')
        .set(helpers.authHeader(customerToken))
        .send({ storeName: 'Updated Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to access this route');
    });
  });

  describe('GET /api/pharmacies/dashboard/stats', () => {
    beforeEach(async () => {
      // Create some medicines
      await helpers.createMedicine(pharmacy);
      await helpers.createMedicine(pharmacy, { stock: 5 }); // Low stock
    });

    it('should get dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/pharmacies/dashboard/stats')
        .set(helpers.authHeader(token))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lowStockMedicines).toBeDefined();
      expect(response.body.data.lowStockMedicines.length).toBe(1);
    });

    it('should not allow unauthorized access', async () => {
      const response = await request(app)
        .get('/api/pharmacies/dashboard/stats')
        .set(helpers.authHeader(customerToken))
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/pharmacies/:id/reviews', () => {
    let order;

    beforeEach(async () => {
      // Create medicine and order
      const medicine = await helpers.createMedicine(pharmacy);
      order = await helpers.createOrder(customerUser, pharmacy, [medicine]);
      order.status = 'delivered';
      await order.save();
    });

    it('should add review to pharmacy', async () => {
      const reviewData = {
        rating: 4,
        comment: 'Great service!'
      };

      const response = await request(app)
        .post(`/api/pharmacies/${pharmacy._id}/reviews`)
        .set(helpers.authHeader(customerToken))
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].rating).toBe(reviewData.rating);
    });

    it('should not allow review without order', async () => {
      const newCustomer = await helpers.createUser('customer');
      const newToken = helpers.generateToken(newCustomer);

      const response = await request(app)
        .post(`/api/pharmacies/${pharmacy._id}/reviews`)
        .set(helpers.authHeader(newToken))
        .send({ rating: 4, comment: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('You can only review pharmacies you have ordered from');
    });

    it('should not allow multiple reviews', async () => {
      // Add first review
      await request(app)
        .post(`/api/pharmacies/${pharmacy._id}/reviews`)
        .set(helpers.authHeader(customerToken))
        .send({ rating: 4, comment: 'First review' });

      // Try to add second review
      const response = await request(app)
        .post(`/api/pharmacies/${pharmacy._id}/reviews`)
        .set(helpers.authHeader(customerToken))
        .send({ rating: 5, comment: 'Second review' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('You have already reviewed this pharmacy');
    });
  });

  describe('GET /api/pharmacies/:id/reviews', () => {
    beforeEach(async () => {
      // Add some reviews
      const medicine = await helpers.createMedicine(pharmacy);
      const order = await helpers.createOrder(customerUser, pharmacy, [medicine]);
      order.status = 'delivered';
      await order.save();

      await request(app)
        .post(`/api/pharmacies/${pharmacy._id}/reviews`)
        .set(helpers.authHeader(customerToken))
        .send({ rating: 4, comment: 'Great service!' });
    });

    it('should get pharmacy reviews', async () => {
      const response = await request(app)
        .get(`/api/pharmacies/${pharmacy._id}/reviews`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.ratings).toBeDefined();
    });
  });
});