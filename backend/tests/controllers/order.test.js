const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const Order = require('../../models/Order');

describe('Order Controller', () => {
  let pharmacyUser;
  let pharmacy;
  let pharmacyToken;
  let customerUser;
  let customerToken;
  let medicine;
  let order;

  beforeEach(async () => {
    await helpers.clearDatabase();
    
    // Create pharmacy user and profile
    pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    pharmacyToken = helpers.generateToken(pharmacyUser);

    // Create customer user
    customerUser = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customerUser);

    // Create medicine
    medicine = await helpers.createMedicine(pharmacy);

    // Create order
    order = await helpers.createOrder(customerUser, pharmacy, [medicine]);
  });

  describe('POST /api/orders', () => {
    it('should create new order', async () => {
      const orderData = {
        pharmacy: pharmacy._id,
        items: [{
          medicine: medicine._id,
          quantity: 2
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
      };

      const response = await request(app)
        .post('/api/orders')
        .set(helpers.authHeader(customerToken))
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending_approval');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(2);
    });

    it('should validate medicine stock', async () => {
      const orderData = {
        pharmacy: pharmacy._id,
        items: [{
          medicine: medicine._id,
          quantity: medicine.stock + 1
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
      };

      const response = await request(app)
        .post('/api/orders')
        .set(helpers.authHeader(customerToken))
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient stock');
    });

    it('should validate delivery slot availability', async () => {
      const orderData = {
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
          date: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past date
          time: '09:00'
        }
      };

      const response = await request(app)
        .post('/api/orders')
        .set(helpers.authHeader(customerToken))
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid delivery slot');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create additional orders
      await helpers.createOrder(customerUser, pharmacy, [medicine], { status: 'delivered' });
      await helpers.createOrder(customerUser, pharmacy, [medicine], { status: 'processing' });
    });

    it('should get customer orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders')
        .query({ status: 'delivered' })
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('delivered');
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/orders')
        .query({ page: 1, limit: 2 })
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by id', async () => {
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(order._id.toString());
    });

    it('should not allow unauthorized access', async () => {
      const unauthorizedUser = await helpers.createUser('customer');
      const unauthorizedToken = helpers.generateToken(unauthorizedUser);

      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(helpers.authHeader(unauthorizedToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to access this order');
    });
  });

  describe('PUT /api/orders/:id/confirm', () => {
    beforeEach(async () => {
      order.status = 'approved';
      await order.save();
    });

    it('should confirm order', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/confirm`)
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('processing');
    });

    it('should not confirm already processed order', async () => {
      order.status = 'processing';
      await order.save();

      const response = await request(app)
        .put(`/api/orders/${order._id}/confirm`)
        .set(helpers.authHeader(customerToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order cannot be confirmed at this stage');
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    it('should cancel order', async () => {
      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set(helpers.authHeader(customerToken))
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
      expect(response.body.data.notes.cancellationNote).toBe('Changed my mind');
    });

    it('should not cancel delivered order', async () => {
      order.status = 'delivered';
      await order.save();

      const response = await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set(helpers.authHeader(customerToken))
        .send({ reason: 'Changed my mind' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Order cannot be cancelled at this stage');
    });

    it('should restore medicine stock on cancellation', async () => {
      order.status = 'processing';
      await order.save();

      const originalStock = medicine.stock;

      await request(app)
        .put(`/api/orders/${order._id}/cancel`)
        .set(helpers.authHeader(customerToken))
        .send({ reason: 'Changed my mind' })
        .expect(200);

      const updatedMedicine = await Medicine.findById(medicine._id);
      expect(updatedMedicine.stock).toBe(originalStock + order.items[0].quantity);
    });
  });

  describe('PUT /api/orders/:id/cart', () => {
    beforeEach(async () => {
      order.status = 'cart';
      await order.save();
    });

    it('should update cart items', async () => {
      const updateData = {
        items: [{
          id: order.items[0]._id,
          selected: false
        }]
      };

      const response = await request(app)
        .put(`/api/orders/${order._id}/cart`)
        .set(helpers.authHeader(customerToken))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].selected).toBe(false);
    });

    it('should recalculate order amounts', async () => {
      const originalAmount = order.finalAmount;
      const updateData = {
        items: [{
          id: order.items[0]._id,
          selected: false
        }]
      };

      const response = await request(app)
        .put(`/api/orders/${order._id}/cart`)
        .set(helpers.authHeader(customerToken))
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.finalAmount).toBeLessThan(originalAmount);
    });
  });
});