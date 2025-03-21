const mongoose = require('mongoose');
const seeder = require('../../utils/seeder');
const User = require('../../models/User');
const Pharmacy = require('../../models/Pharmacy');
const Medicine = require('../../models/Medicine');
const config = require('../../config/config');
const logger = require('../../utils/logger');

describe('Database Seeder', () => {
  beforeAll(async () => {
    // Disable logging during tests
    logger.transports.forEach(t => {
      t.silent = true;
    });
  });

  beforeEach(async () => {
    await mongoose.disconnect();
    const mongoUri = process.env.MONGODB_URI || config.mongodb.uri;
    await mongoose.connect(mongoUri, config.mongodb.options);
  });

  afterEach(async () => {
    await mongoose.disconnect();
  });

  describe('Seeding Process', () => {
    it('should clear existing data before seeding', async () => {
      // Insert some test data
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'customer'
      });

      // Run seeder
      await seeder.clearDatabase();

      // Check if data was cleared
      const users = await User.find();
      expect(users).toHaveLength(0);
    });

    it('should not clear data in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(seeder.clearDatabase()).rejects.toThrow(
        'Database seeding not allowed in production'
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should seed admin user', async () => {
      await seeder.seedAdminUser();

      const admin = await User.findOne({ role: 'admin' });
      expect(admin).toBeDefined();
      expect(admin.email).toBe('admin@example.com');
    });

    it('should seed pharmacies', async () => {
      await seeder.seedPharmacies();

      const pharmacies = await Pharmacy.find().populate('user');
      expect(pharmacies).toHaveLength(2);
      expect(pharmacies[0].storeName).toBeDefined();
      expect(pharmacies[0].user.role).toBe('pharmacy');
    });

    it('should seed medicines for each pharmacy', async () => {
      await seeder.seedPharmacies();
      await seeder.seedMedicines();

      const medicines = await Medicine.find();
      const pharmacies = await Pharmacy.find();

      expect(medicines.length).toBe(pharmacies.length * 3); // 3 medicines per pharmacy
      expect(medicines[0].name).toBeDefined();
      expect(medicines[0].pharmacy).toBeDefined();
    });

    it('should seed all data successfully', async () => {
      await seeder.seedAll();

      const [users, pharmacies, medicines] = await Promise.all([
        User.find(),
        Pharmacy.find(),
        Medicine.find()
      ]);

      expect(users).toHaveLength(3); // Admin + 2 pharmacy users
      expect(pharmacies).toHaveLength(2);
      expect(medicines).toHaveLength(6); // 3 medicines * 2 pharmacies
    });
  });

  describe('Seeded Data Validation', () => {
    beforeEach(async () => {
      await seeder.seedAll();
    });

    it('should create valid admin user', async () => {
      const admin = await User.findOne({ role: 'admin' });
      expect(admin.name).toBe('Admin User');
      expect(admin.isActive).toBe(true);
    });

    it('should create valid pharmacy profiles', async () => {
      const pharmacies = await Pharmacy.find().populate('user');

      pharmacies.forEach(pharmacy => {
        expect(pharmacy.storeName).toBeDefined();
        expect(pharmacy.licenseNumber).toMatch(/^LIC[A-Z0-9]+$/);
        expect(pharmacy.location.type).toBe('Point');
        expect(pharmacy.location.coordinates).toHaveLength(2);
        expect(pharmacy.operatingHours).toHaveLength(7);
        expect(pharmacy.verificationStatus).toBe('verified');
      });
    });

    it('should create valid medicines', async () => {
      const medicines = await Medicine.find();

      medicines.forEach(medicine => {
        expect(medicine.name).toBeDefined();
        expect(medicine.price).toBeGreaterThan(0);
        expect(medicine.stock).toBeGreaterThan(0);
        expect(medicine.status).toBe('active');
        expect(medicine.pharmacy).toBeDefined();
      });
    });

    it('should maintain proper relationships', async () => {
      const pharmacy = await Pharmacy.findOne();
      const pharmacyMedicines = await Medicine.find({ pharmacy: pharmacy._id });
      const pharmacyUser = await User.findById(pharmacy.user);

      expect(pharmacyMedicines).toHaveLength(3);
      expect(pharmacyUser.role).toBe('pharmacy');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      await mongoose.disconnect();
      await expect(seeder.seedAll()).rejects.toThrow();
    });

    it('should handle validation errors', async () => {
      // Mock User.create to simulate validation error
      jest.spyOn(User, 'create').mockRejectedValueOnce(new mongoose.Error.ValidationError());

      await expect(seeder.seedAdminUser()).rejects.toThrow();
    });

    it('should handle duplicate key errors', async () => {
      // Create admin user first
      await seeder.seedAdminUser();

      // Try to create admin user again
      await expect(seeder.seedAdminUser()).rejects.toThrow();
    });
  });

  describe('Data Retrieval', () => {
    it('should return seeded data', async () => {
      await seeder.seedAll();
      const seededData = seeder.getSeededData();

      expect(seededData.adminUser).toBeDefined();
      expect(seededData.pharmacies).toHaveLength(2);
      expect(seededData.medicines).toHaveLength(6);
    });
  });

  describe('Geospatial Data', () => {
    it('should create valid geospatial data for pharmacies', async () => {
      await seeder.seedAll();
      const pharmacies = await Pharmacy.find();

      pharmacies.forEach(pharmacy => {
        expect(pharmacy.location.coordinates[0]).toBeGreaterThan(72); // Longitude
        expect(pharmacy.location.coordinates[0]).toBeLessThan(73);
        expect(pharmacy.location.coordinates[1]).toBeGreaterThan(19); // Latitude
        expect(pharmacy.location.coordinates[1]).toBeLessThan(20);
      });
    });
  });

  describe('Operating Hours', () => {
    it('should create valid operating hours for pharmacies', async () => {
      await seeder.seedAll();
      const pharmacy = await Pharmacy.findOne();

      expect(pharmacy.operatingHours).toHaveLength(7);
      expect(pharmacy.operatingHours[0]).toMatchObject({
        day: expect.any(String),
        open: expect.any(String),
        close: expect.any(String),
        isOpen: expect.any(Boolean)
      });
    });
  });
});