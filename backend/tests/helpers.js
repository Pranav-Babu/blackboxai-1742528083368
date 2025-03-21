const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

/**
 * Test Helper Utilities
 */
const helpers = {
  /**
   * Create a test user with given role and custom data
   * @param {string} role 
   * @param {Object} customData 
   * @returns {Promise<Object>}
   */
  createUser: async (role = 'customer', customData = {}) => {
    const User = require('../models/User');
    const defaultData = {
      name: `Test ${role}`,
      email: `test.${role}.${Date.now()}@example.com`,
      password: await bcrypt.hash('password123', 10),
      phone: `${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role,
      isActive: true
    };

    return await User.create({ ...defaultData, ...customData });
  },

  /**
   * Create a test pharmacy with custom data
   * @param {Object} user 
   * @param {Object} customData 
   * @returns {Promise<Object>}
   */
  createPharmacy: async (user, customData = {}) => {
    const Pharmacy = require('../models/Pharmacy');
    const defaultData = {
      user: user._id,
      storeName: `Test Pharmacy ${Date.now()}`,
      licenseNumber: `LIC${Date.now()}`,
      location: {
        type: 'Point',
        coordinates: [72.8777 + Math.random() * 0.1, 19.0760 + Math.random() * 0.1]
      },
      address: {
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '123456'
      },
      contactInfo: {
        phone: user.phone,
        email: user.email
      },
      operatingHours: [
        { day: 'Monday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Tuesday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Wednesday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Thursday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Friday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Saturday', open: '09:00', close: '21:00', isOpen: true },
        { day: 'Sunday', open: '10:00', close: '18:00', isOpen: true }
      ],
      services: ['Home Delivery', 'Online Consultation'],
      verificationStatus: 'verified',
      status: 'active'
    };

    return await Pharmacy.create({ ...defaultData, ...customData });
  },

  /**
   * Create a test medicine with custom data
   * @param {Object} pharmacy 
   * @param {Object} customData 
   * @returns {Promise<Object>}
   */
  createMedicine: async (pharmacy, customData = {}) => {
    const Medicine = require('../models/Medicine');
    const defaultData = {
      pharmacy: pharmacy._id,
      name: `Test Medicine ${Date.now()}`,
      genericName: 'Test Generic Name',
      category: 'non-prescription',
      subCategory: 'pain-relief',
      manufacturer: 'Test Manufacturer',
      description: 'Test description',
      price: 100,
      discountedPrice: 90,
      stock: 100,
      unit: 'tablet',
      packageSize: '10 tablets',
      prescriptionRequired: false,
      images: ['default-medicine.jpg'],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      batchNumber: `BATCH${Date.now()}`,
      status: 'active'
    };

    return await Medicine.create({ ...defaultData, ...customData });
  },

  /**
   * Create a test order with custom data
   * @param {Object} customer 
   * @param {Object} pharmacy 
   * @param {Array} medicines 
   * @param {Object} customData 
   * @returns {Promise<Object>}
   */
  createOrder: async (customer, pharmacy, medicines = [], customData = {}) => {
    const Order = require('../models/Order');
    const items = medicines.map(medicine => ({
      medicine: medicine._id,
      quantity: 1,
      price: medicine.price,
      discountedPrice: medicine.discountedPrice
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountedAmount = items.reduce((sum, item) => sum + (item.discountedPrice || item.price) * item.quantity, 0);

    const defaultData = {
      customer: customer._id,
      pharmacy: pharmacy._id,
      items,
      totalAmount,
      discountedAmount,
      deliveryCharge: 50,
      finalAmount: discountedAmount + 50,
      deliveryAddress: {
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '123456'
      },
      deliverySlot: {
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        time: '09:00'
      },
      status: 'pending_approval'
    };

    return await Order.create({ ...defaultData, ...customData });
  },

  /**
   * Create a test prescription with custom data
   * @param {Object} customer 
   * @param {Object} pharmacy 
   * @param {Object} customData 
   * @returns {Promise<Object>}
   */
  createPrescription: async (customer, pharmacy, customData = {}) => {
    const Prescription = require('../models/Prescription');
    const defaultData = {
      customer: customer._id,
      pharmacy: pharmacy._id,
      images: ['test-prescription.jpg'],
      doctorDetails: {
        name: 'Dr. Test Doctor',
        registrationNumber: 'REG123'
      },
      patientDetails: {
        name: customer.name,
        age: 30,
        gender: 'male'
      },
      validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'pending'
    };

    return await Prescription.create({ ...defaultData, ...customData });
  },

  /**
   * Generate JWT token for a user
   * @param {Object} user 
   * @returns {string}
   */
  generateToken: (user) => {
    return jwt.sign({ id: user._id }, config.jwt.secret, {
      expiresIn: config.jwt.expire
    });
  },

  /**
   * Create auth header with token
   * @param {string} token 
   * @returns {Object}
   */
  authHeader: (token) => ({
    Authorization: `Bearer ${token}`
  }),

  /**
   * Generate random MongoDB ObjectId
   * @returns {string}
   */
  generateObjectId: () => new mongoose.Types.ObjectId().toString(),

  /**
   * Clear all collections in the database
   * @returns {Promise<void>}
   */
  clearDatabase: async () => {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  },

  /**
   * Mock date for testing
   * @param {string|Date} date 
   */
  mockDate: (date) => {
    const RealDate = Date;
    const mockDate = new RealDate(date);
    global.Date = class extends RealDate {
      constructor() {
        super();
        return mockDate;
      }
    };
    global.Date.now = () => mockDate.getTime();
  },

  /**
   * Restore real date after mocking
   */
  restoreDate: () => {
    global.Date = RealDate;
  },

  /**
   * Wait for a specified time
   * @param {number} ms 
   * @returns {Promise<void>}
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

module.exports = helpers;