const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const cache = require('../../utils/cache');
const Medicine = require('../../models/Medicine');
const Order = require('../../models/Order');

describe('Performance Tests', () => {
  let customer;
  let customerToken;
  let pharmacy;
  let pharmacyToken;
  let medicine;

  beforeEach(async () => {
    await helpers.clearDatabase();
    cache.flush();

    // Create test data
    customer = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customer);

    const pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    pharmacyToken = helpers.generateToken(pharmacyUser);

    medicine = await helpers.createMedicine(pharmacy);

    // Create multiple medicines for search testing
    const medicines = Array(100).fill().map((_, index) => ({
      name: `Test Medicine ${index}`,
      genericName: `Generic ${index}`,
      category: index % 2 === 0 ? 'prescription' : 'non-prescription',
      manufacturer: `Manufacturer ${index}`,
      price: 100 + index,
      stock: 100,
      pharmacy: pharmacy._id
    }));

    await Medicine.insertMany(medicines);
  });

  describe('Load Testing', () => {
    it('should handle multiple concurrent medicine searches', async () => {
      const startTime = Date.now();
      const requests = Array(50).fill().map(() =>
        request(app)
          .get('/api/medicines')
          .query({ search: 'Test' })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Average response time should be under 200ms
      const averageTime = (endTime - startTime) / requests.length;
      expect(averageTime).toBeLessThan(200);
    });

    it('should handle multiple concurrent orders', async () => {
      const startTime = Date.now();
      const requests = Array(20).fill().map(() =>
        request(app)
          .post('/api/orders')
          .set(helpers.authHeader(customerToken))
          .send({
            pharmacy: pharmacy._id,
            items: [{
              medicine: medicine._id,
              quantity: 1
            }],
            deliveryAddress: {
              street: 'Test Street',
              city: 'Test City',
              state: 'Test State',
              zipCode: '123456'
            },
            deliverySlot: {
              date: new Date(Date.now() + 24 * 60 * 60 * 1000),
              time: '09:00'
            }
          })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Average response time should be under 500ms
      const averageTime = (endTime - startTime) / requests.length;
      expect(averageTime).toBeLessThan(500);
    });
  });

  describe('Caching Performance', () => {
    it('should improve response time with caching', async () => {
      // First request - no cache
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get('/api/medicines')
        .query({ category: 'non-prescription' });
      const time1 = Date.now() - startTime1;

      // Second request - should use cache
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get('/api/medicines')
        .query({ category: 'non-prescription' });
      const time2 = Date.now() - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(time2).toBeLessThan(time1);
    });
  });

  describe('Database Query Performance', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      // Create test orders
      const orders = Array(50).fill().map(() => ({
        customer: customer._id,
        pharmacy: pharmacy._id,
        items: [{
          medicine: medicine._id,
          quantity: Math.floor(Math.random() * 5) + 1,
          price: medicine.price
        }],
        status: 'delivered',
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000)
      }));

      await Order.insertMany(orders);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/pharmacies/dashboard/stats')
        .set(helpers.authHeader(pharmacyToken));
      const queryTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(queryTime).toBeLessThan(1000);
    });
  });

  describe('Search Performance', () => {
    it('should handle fuzzy search efficiently', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/medicines')
        .query({
          search: 'Test Med',
          fuzzy: true
        });
      const searchTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(searchTime).toBeLessThan(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should handle geospatial search efficiently', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/api/pharmacies')
        .query({
          latitude: 19.0760,
          longitude: 72.8777,
          radius: 5000
        });
      const searchTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(searchTime).toBeLessThan(200);
    });
  });

  describe('File Upload Performance', () => {
    it('should handle multiple concurrent file uploads', async () => {
      const requests = Array(5).fill().map(() =>
        request(app)
          .post('/api/prescriptions')
          .set(helpers.authHeader(customerToken))
          .field('pharmacy', pharmacy._id)
          .field('doctorDetails', JSON.stringify({
            name: 'Dr. Test',
            registrationNumber: 'REG123'
          }))
          .attach('prescriptionImages', Buffer.from('fake-image'), 'prescription.jpg')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const uploadTime = Date.now() - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Average upload time should be under 1 second
      expect(uploadTime / requests.length).toBeLessThan(1000);
    });
  });

  describe('API Rate Limiting', () => {
    it('should handle rate limiting correctly', async () => {
      const requests = Array(150).fill().map(() =>
        request(app)
          .get('/api/medicines')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      // Some requests should be rate limited
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      await Promise.all([
        // Multiple concurrent searches
        ...Array(20).fill().map(() =>
          request(app).get('/api/medicines').query({ search: 'Test' })
        ),
        // Multiple concurrent orders
        ...Array(10).fill().map(() =>
          request(app)
            .post('/api/orders')
            .set(helpers.authHeader(customerToken))
            .send({
              pharmacy: pharmacy._id,
              items: [{ medicine: medicine._id, quantity: 1 }]
            })
        ),
        // Multiple concurrent file uploads
        ...Array(5).fill().map(() =>
          request(app)
            .post('/api/prescriptions')
            .set(helpers.authHeader(customerToken))
            .field('pharmacy', pharmacy._id)
            .attach('prescriptionImages', Buffer.from('fake-image'), 'prescription.jpg')
        )
      ]);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});