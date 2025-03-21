const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const Medicine = require('../../models/Medicine');
const Order = require('../../models/Order');
const Prescription = require('../../models/Prescription');

describe('Integration Tests', () => {
  let customer;
  let customerToken;
  let pharmacyUser;
  let pharmacy;
  let pharmacyToken;
  let medicine;
  let prescription;
  let order;

  beforeEach(async () => {
    await helpers.clearDatabase();

    // Create customer
    customer = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customer);

    // Create pharmacy
    pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    pharmacyToken = helpers.generateToken(pharmacyUser);

    // Create medicine
    medicine = await helpers.createMedicine(pharmacy);
  });

  describe('Complete Order Flow', () => {
    it('should handle complete order flow from prescription to delivery', async () => {
      // Step 1: Upload prescription
      const prescriptionResponse = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(customerToken))
        .field('pharmacy', pharmacy._id)
        .field('doctorDetails', JSON.stringify({
          name: 'Dr. Test',
          registrationNumber: 'REG123'
        }))
        .field('patientDetails', JSON.stringify({
          name: customer.name,
          age: 30,
          gender: 'male'
        }))
        .attach('prescriptionImages', Buffer.from('fake-image'), 'prescription.jpg')
        .expect(201);

      expect(prescriptionResponse.body.success).toBe(true);
      prescription = prescriptionResponse.body.data;

      // Step 2: Pharmacy verifies prescription
      const verificationResponse = await request(app)
        .put(`/api/prescriptions/${prescription._id}/verify`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          status: 'verified',
          medicines: [{
            medicine: medicine._id,
            dosage: '1 tablet daily',
            duration: '7 days',
            quantity: 7
          }]
        })
        .expect(200);

      expect(verificationResponse.body.success).toBe(true);
      expect(verificationResponse.body.data.status).toBe('verified');

      // Step 3: Create order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set(helpers.authHeader(customerToken))
        .send({
          pharmacy: pharmacy._id,
          prescription: prescription._id,
          items: [{
            medicine: medicine._id,
            quantity: 7
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
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      order = orderResponse.body.data;

      // Step 4: Pharmacy approves order
      const approvalResponse = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          status: 'approved'
        })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);
      expect(approvalResponse.body.data.status).toBe('approved');

      // Step 5: Customer confirms order
      const confirmationResponse = await request(app)
        .put(`/api/orders/${order._id}/confirm`)
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(confirmationResponse.body.success).toBe(true);
      expect(confirmationResponse.body.data.status).toBe('processing');

      // Step 6: Process payment
      const paymentResponse = await request(app)
        .post(`/api/orders/${order._id}/payment`)
        .set(helpers.authHeader(customerToken))
        .send({
          paymentMethod: 'card',
          paymentDetails: {
            cardNumber: '4111111111111111',
            expiryMonth: '12',
            expiryYear: '2025',
            cvv: '123'
          }
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data.paymentStatus).toBe('completed');

      // Step 7: Mark order as delivered
      const deliveryResponse = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          status: 'delivered'
        })
        .expect(200);

      expect(deliveryResponse.body.success).toBe(true);
      expect(deliveryResponse.body.data.status).toBe('delivered');

      // Verify final state
      const finalOrder = await Order.findById(order._id)
        .populate('items.medicine')
        .populate('prescription');

      expect(finalOrder.status).toBe('delivered');
      expect(finalOrder.paymentStatus).toBe('completed');
      expect(finalOrder.items[0].medicine._id.toString()).toBe(medicine._id.toString());
      expect(finalOrder.prescription._id.toString()).toBe(prescription._id.toString());
    });
  });

  describe('Cart and Order Management', () => {
    it('should handle cart operations and order placement', async () => {
      // Step 1: Add item to cart
      const cartResponse = await request(app)
        .post('/api/orders/cart')
        .set(helpers.authHeader(customerToken))
        .send({
          pharmacy: pharmacy._id,
          items: [{
            medicine: medicine._id,
            quantity: 2
          }]
        })
        .expect(201);

      expect(cartResponse.body.success).toBe(true);
      const cart = cartResponse.body.data;

      // Step 2: Update cart quantity
      const updateResponse = await request(app)
        .put(`/api/orders/${cart._id}/cart`)
        .set(helpers.authHeader(customerToken))
        .send({
          items: [{
            id: cart.items[0]._id,
            quantity: 3
          }]
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.items[0].quantity).toBe(3);

      // Step 3: Place order from cart
      const orderResponse = await request(app)
        .post(`/api/orders/${cart._id}/checkout`)
        .set(helpers.authHeader(customerToken))
        .send({
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
        .expect(200);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.data.status).toBe('pending_approval');
    });
  });

  describe('Pharmacy Management', () => {
    it('should handle pharmacy inventory and order management', async () => {
      // Step 1: Add medicine to inventory
      const medicineResponse = await request(app)
        .post('/api/medicines')
        .set(helpers.authHeader(pharmacyToken))
        .send({
          name: 'New Medicine',
          genericName: 'Generic Name',
          category: 'non-prescription',
          manufacturer: 'Test Manufacturer',
          price: 100,
          stock: 50
        })
        .expect(201);

      expect(medicineResponse.body.success).toBe(true);
      const newMedicine = medicineResponse.body.data;

      // Step 2: Update medicine stock
      const stockResponse = await request(app)
        .put(`/api/medicines/${newMedicine._id}/stock`)
        .set(helpers.authHeader(pharmacyToken))
        .send({
          operation: 'add',
          quantity: 25
        })
        .expect(200);

      expect(stockResponse.body.success).toBe(true);
      expect(stockResponse.body.data.stock).toBe(75);

      // Step 3: Get pharmacy analytics
      const analyticsResponse = await request(app)
        .get('/api/pharmacies/dashboard/stats')
        .set(helpers.authHeader(pharmacyToken))
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(analyticsResponse.body.data.inventory).toBeDefined();
    });
  });

  describe('Search and Filtering', () => {
    it('should handle medicine search and filtering', async () => {
      // Create additional medicines
      await helpers.createMedicine(pharmacy, {
        name: 'Paracetamol',
        category: 'non-prescription',
        price: 50
      });

      await helpers.createMedicine(pharmacy, {
        name: 'Amoxicillin',
        category: 'prescription',
        price: 150
      });

      // Search by name
      const searchResponse = await request(app)
        .get('/api/medicines')
        .query({ search: 'Para' })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data).toHaveLength(1);
      expect(searchResponse.body.data[0].name).toBe('Paracetamol');

      // Filter by category and price
      const filterResponse = await request(app)
        .get('/api/medicines')
        .query({
          category: 'prescription',
          minPrice: 100,
          maxPrice: 200
        })
        .expect(200);

      expect(filterResponse.body.success).toBe(true);
      expect(filterResponse.body.data).toHaveLength(1);
      expect(filterResponse.body.data[0].name).toBe('Amoxicillin');
    });
  });
});