const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const Medicine = require('../../models/Medicine');

describe('Medicine Controller', () => {
  let pharmacyUser;
  let pharmacy;
  let pharmacyToken;
  let customerUser;
  let customerToken;
  let medicine;

  beforeEach(async () => {
    await helpers.clearDatabase();
    
    // Create pharmacy user and profile
    pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    pharmacyToken = helpers.generateToken(pharmacyUser);

    // Create customer user
    customerUser = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customerUser);

    // Create a test medicine
    medicine = await helpers.createMedicine(pharmacy);
  });

  describe('GET /api/medicines', () => {
    beforeEach(async () => {
      // Create additional medicines for testing
      await helpers.createMedicine(pharmacy, {
        name: 'Paracetamol',
        category: 'non-prescription',
        price: 50
      });
      await helpers.createMedicine(pharmacy, {
        name: 'Amoxicillin',
        category: 'prescription',
        price: 100
      });
    });

    it('should get all medicines', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data[0].name).toBeDefined();
    });

    it('should filter medicines by category', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .query({ category: 'prescription' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].category).toBe('prescription');
    });

    it('should filter medicines by price range', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .query({ minPrice: 75, maxPrice: 150 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].price).toBe(100);
    });

    it('should search medicines by name', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .query({ search: 'Para' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Paracetamol');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .query({ page: 1, limit: 2 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(3);
    });
  });

  describe('GET /api/medicines/:id', () => {
    it('should get medicine by id', async () => {
      const response = await request(app)
        .get(`/api/medicines/${medicine._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(medicine.name);
    });

    it('should return 404 for non-existent medicine', async () => {
      const fakeId = helpers.generateObjectId();
      const response = await request(app)
        .get(`/api/medicines/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Medicine not found');
    });
  });

  describe('POST /api/medicines', () => {
    it('should create new medicine', async () => {
      const medicineData = {
        name: 'New Medicine',
        genericName: 'Generic Name',
        category: 'non-prescription',
        manufacturer: 'Test Manufacturer',
        description: 'Test description',
        price: 150,
        stock: 100,
        prescriptionRequired: false
      };

      const response = await request(app)
        .post('/api/medicines')
        .set(helpers.authHeader(pharmacyToken))
        .send(medicineData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(medicineData.name);
      expect(response.body.data.pharmacy).toBe(pharmacy._id.toString());
    });

    it('should not allow duplicate medicine names for same pharmacy', async () => {
      const medicineData = {
        name: medicine.name,
        genericName: 'Generic Name',
        category: 'non-prescription',
        price: 150,
        stock: 100
      };

      const response = await request(app)
        .post('/api/medicines')
        .set(helpers.authHeader(pharmacyToken))
        .send(medicineData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Medicine already exists in your inventory');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/medicines')
        .set(helpers.authHeader(pharmacyToken))
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/medicines/:id', () => {
    it('should update medicine', async () => {
      const updateData = {
        name: 'Updated Medicine Name',
        price: 200,
        stock: 150
      };

      const response = await request(app)
        .put(`/api/medicines/${medicine._id}`)
        .set(helpers.authHeader(pharmacyToken))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.price).toBe(updateData.price);
    });

    it('should not allow unauthorized update', async () => {
      const response = await request(app)
        .put(`/api/medicines/${medicine._id}`)
        .set(helpers.authHeader(customerToken))
        .send({ price: 200 })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to update this medicine');
    });
  });

  describe('PUT /api/medicines/:id/stock', () => {
    it('should update medicine stock', async () => {
      const response = await request(app)
        .put(`/api/medicines/${medicine._id}/stock`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          operation: 'add',
          quantity: 50
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stock).toBe(medicine.stock + 50);
    });

    it('should not allow stock below 0', async () => {
      const response = await request(app)
        .put(`/api/medicines/${medicine._id}/stock`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          operation: 'subtract',
          quantity: medicine.stock + 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Insufficient stock');
    });
  });

  describe('POST /api/medicines/:id/reviews', () => {
    let order;

    beforeEach(async () => {
      order = await helpers.createOrder(customerUser, pharmacy, [medicine]);
      order.status = 'delivered';
      await order.save();
    });

    it('should add review to medicine', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Excellent medicine!'
      };

      const response = await request(app)
        .post(`/api/medicines/${medicine._id}/reviews`)
        .set(helpers.authHeader(customerToken))
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].rating).toBe(reviewData.rating);
    });

    it('should not allow review without purchase', async () => {
      const newCustomer = await helpers.createUser('customer');
      const newToken = helpers.generateToken(newCustomer);

      const response = await request(app)
        .post(`/api/medicines/${medicine._id}/reviews`)
        .set(helpers.authHeader(newToken))
        .send({ rating: 4, comment: 'Test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('You can only review medicines you have purchased');
    });
  });
});