const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../config/config');
const logger = require('../utils/logger');

let mongoServer;

// Setup before all tests
module.exports = async () => {
  try {
    // Create an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRE = '1h';

    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('Connected to in-memory MongoDB instance');

    // Disable logging during tests
    logger.transports.forEach(t => {
      t.silent = true;
    });

    // Clear all collections before tests
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }

    // Set up global test utilities
    global.testUtils = {
      // Helper function to create test user
      createTestUser: async (userData = {}) => {
        const User = require('../models/User');
        const defaultUser = {
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          role: 'customer',
          phone: '1234567890'
        };

        return await User.create({ ...defaultUser, ...userData });
      },

      // Helper function to create test pharmacy
      createTestPharmacy: async (pharmacyData = {}) => {
        const Pharmacy = require('../models/Pharmacy');
        const defaultPharmacy = {
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
          },
          contactInfo: {
            phone: '9876543210',
            email: 'pharmacy@test.com'
          }
        };

        return await Pharmacy.create({ ...defaultPharmacy, ...pharmacyData });
      },

      // Helper function to create test medicine
      createTestMedicine: async (medicineData = {}) => {
        const Medicine = require('../models/Medicine');
        const defaultMedicine = {
          name: 'Test Medicine',
          genericName: 'Test Generic',
          category: 'non-prescription',
          manufacturer: 'Test Manufacturer',
          price: 100,
          stock: 50,
          prescriptionRequired: false
        };

        return await Medicine.create({ ...defaultMedicine, ...medicineData });
      },

      // Helper function to create test order
      createTestOrder: async (orderData = {}) => {
        const Order = require('../models/Order');
        const defaultOrder = {
          status: 'pending_approval',
          items: [],
          totalAmount: 0,
          deliveryAddress: {
            street: 'Test Street',
            city: 'Test City',
            state: 'Test State',
            zipCode: '123456'
          }
        };

        return await Order.create({ ...defaultOrder, ...orderData });
      },

      // Helper function to generate JWT token
      generateToken: async (user) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRE
        });
      },

      // Helper function to clear database
      clearDatabase: async () => {
        const collections = await mongoose.connection.db.collections();
        for (const collection of collections) {
          await collection.deleteMany({});
        }
      },

      // Helper function to close database connection
      closeDatabase: async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
      }
    };

    logger.info('Test setup completed successfully');
  } catch (error) {
    logger.error('Test setup failed:', error);
    throw error;
  }
};

// Cleanup after all tests
process.on('SIGTERM', async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    logger.info('Test cleanup completed successfully');
  } catch (error) {
    logger.error('Test cleanup failed:', error);
    process.exit(1);
  }
});