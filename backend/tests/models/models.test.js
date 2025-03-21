const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const Medicine = require('../../models/Medicine');
const Order = require('../../models/Order');
const Prescription = require('../../models/Prescription');
const helpers = require('../helpers');

describe('Database Models', () => {
  beforeEach(async () => {
    await helpers.clearDatabase();
  });

  describe('User Model', () => {
    it('should hash password before saving', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890',
        role: 'customer'
      };

      const user = await User.create(userData);
      expect(user.password).not.toBe(userData.password);
      expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
    });

    it('should not save without required fields', async () => {
      const user = new User({});
      let error;

      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    it('should not save duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'password123',
        phone: '1234567890',
        role: 'customer'
      };

      await User.create(userData);
      let error;

      try {
        await User.create(userData);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000);
    });

    it('should validate email format', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123',
        phone: '1234567890',
        role: 'customer'
      };

      let error;

      try {
        await User.create(userData);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.email).toBeDefined();
    });

    it('should match password correctly', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890',
        role: 'customer'
      });

      const isMatch = await user.matchPassword('password123');
      expect(isMatch).toBe(true);

      const isNotMatch = await user.matchPassword('wrongpassword');
      expect(isNotMatch).toBe(false);
    });
  });

  describe('Pharmacy Model', () => {
    let pharmacyUser;

    beforeEach(async () => {
      pharmacyUser = await helpers.createUser('pharmacy');
    });

    it('should create pharmacy with valid data', async () => {
      const pharmacyData = {
        user: pharmacyUser._id,
        storeName: 'Test Pharmacy',
        licenseNumber: 'TEST123',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.0760]
        },
        address: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456'
        }
      };

      const pharmacy = await Pharmacy.create(pharmacyData);
      expect(pharmacy.storeName).toBe(pharmacyData.storeName);
      expect(pharmacy.location.coordinates).toEqual(pharmacyData.location.coordinates);
    });

    it('should calculate average rating correctly', async () => {
      const pharmacy = await helpers.createPharmacy(pharmacyUser);
      
      pharmacy.reviews.push({
        rating: 4,
        comment: 'Good service',
        user: new mongoose.Types.ObjectId()
      });

      pharmacy.reviews.push({
        rating: 5,
        comment: 'Excellent service',
        user: new mongoose.Types.ObjectId()
      });

      await pharmacy.save();
      expect(pharmacy.ratings.average).toBe(4.5);
      expect(pharmacy.ratings.count).toBe(2);
    });
  });

  describe('Medicine Model', () => {
    let pharmacy;

    beforeEach(async () => {
      const pharmacyUser = await helpers.createUser('pharmacy');
      pharmacy = await helpers.createPharmacy(pharmacyUser);
    });

    it('should create medicine with valid data', async () => {
      const medicineData = {
        pharmacy: pharmacy._id,
        name: 'Test Medicine',
        genericName: 'Test Generic',
        category: 'non-prescription',
        manufacturer: 'Test Manufacturer',
        price: 100,
        stock: 50,
        prescriptionRequired: false
      };

      const medicine = await Medicine.create(medicineData);
      expect(medicine.name).toBe(medicineData.name);
      expect(medicine.price).toBe(medicineData.price);
    });

    it('should track stock changes', async () => {
      const medicine = await helpers.createMedicine(pharmacy);
      const initialStock = medicine.stock;

      medicine.stock += 10;
      await medicine.save();

      expect(medicine.stockHistory).toHaveLength(1);
      expect(medicine.stockHistory[0].change).toBe(10);
    });

    it('should calculate discounted price', async () => {
      const medicine = await helpers.createMedicine(pharmacy, {
        price: 100,
        discount: {
          percentage: 10,
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      expect(medicine.discountedPrice).toBe(90);
    });
  });

  describe('Order Model', () => {
    let customer;
    let pharmacy;
    let medicine;

    beforeEach(async () => {
      customer = await helpers.createUser('customer');
      const pharmacyUser = await helpers.createUser('pharmacy');
      pharmacy = await helpers.createPharmacy(pharmacyUser);
      medicine = await helpers.createMedicine(pharmacy);
    });

    it('should create order with valid data', async () => {
      const orderData = {
        customer: customer._id,
        pharmacy: pharmacy._id,
        items: [{
          medicine: medicine._id,
          quantity: 2,
          price: medicine.price
        }],
        deliveryAddress: {
          street: 'Test Street',
          city: 'Test City',
          state: 'Test State',
          zipCode: '123456'
        }
      };

      const order = await Order.create(orderData);
      expect(order.status).toBe('pending_approval');
      expect(order.items).toHaveLength(1);
    });

    it('should calculate order amounts', async () => {
      const order = await helpers.createOrder(customer, pharmacy, [medicine]);
      
      expect(order.totalAmount).toBe(medicine.price);
      expect(order.finalAmount).toBe(medicine.price + order.deliveryCharge);
    });

    it('should track status changes', async () => {
      const order = await helpers.createOrder(customer, pharmacy, [medicine]);
      
      order.status = 'approved';
      await order.save();

      expect(order.statusHistory).toHaveLength(2); // Including initial status
      expect(order.statusHistory[1].status).toBe('approved');
    });
  });

  describe('Prescription Model', () => {
    let customer;
    let pharmacy;

    beforeEach(async () => {
      customer = await helpers.createUser('customer');
      const pharmacyUser = await helpers.createUser('pharmacy');
      pharmacy = await helpers.createPharmacy(pharmacyUser);
    });

    it('should create prescription with valid data', async () => {
      const prescriptionData = {
        customer: customer._id,
        pharmacy: pharmacy._id,
        images: ['test-prescription.jpg'],
        doctorDetails: {
          name: 'Dr. Test',
          registrationNumber: 'REG123'
        },
        patientDetails: {
          name: customer.name,
          age: 30,
          gender: 'male'
        }
      };

      const prescription = await Prescription.create(prescriptionData);
      expect(prescription.status).toBe('pending');
      expect(prescription.images).toHaveLength(1);
    });

    it('should handle recurring prescriptions', async () => {
      const prescription = await helpers.createPrescription(customer, pharmacy, {
        isRecurring: true,
        recurringDetails: {
          interval: 30,
          totalRefills: 3
        }
      });

      expect(prescription.isRecurring).toBe(true);
      expect(prescription.recurringDetails.remainingRefills).toBe(3);
    });

    it('should track verification details', async () => {
      const prescription = await helpers.createPrescription(customer, pharmacy);
      
      prescription.status = 'verified';
      prescription.verificationDetails = {
        verifiedBy: new mongoose.Types.ObjectId(),
        verifiedAt: new Date(),
        notes: 'Prescription verified'
      };
      await prescription.save();

      expect(prescription.verificationDetails).toBeDefined();
      expect(prescription.verificationDetails.notes).toBe('Prescription verified');
    });
  });
});