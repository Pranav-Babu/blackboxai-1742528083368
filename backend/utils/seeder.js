const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const config = require('../config/config');
const logger = require('./logger');

class DatabaseSeeder {
  /**
   * Initialize seeder
   */
  constructor() {
    this.adminUser = null;
    this.pharmacies = [];
    this.medicines = [];
  }

  /**
   * Run all seeders
   * @returns {Promise<void>}
   */
  async seedAll() {
    try {
      logger.info('Starting database seeding...');

      // Clear existing data
      await this.clearDatabase();

      // Seed in sequence
      await this.seedAdminUser();
      await this.seedPharmacies();
      await this.seedMedicines();

      logger.info('Database seeding completed successfully');
    } catch (error) {
      logger.error('Database seeding failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Clear all collections
   * @returns {Promise<void>}
   */
  async clearDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database seeding not allowed in production');
    }

    logger.info('Clearing existing database data...');

    await Promise.all([
      User.deleteMany(),
      Pharmacy.deleteMany(),
      Medicine.deleteMany()
    ]);
  }

  /**
   * Seed admin user
   * @returns {Promise<void>}
   */
  async seedAdminUser() {
    logger.info('Seeding admin user...');

    this.adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      phone: '1234567890',
      isActive: true
    });
  }

  /**
   * Seed pharmacies
   * @returns {Promise<void>}
   */
  async seedPharmacies() {
    logger.info('Seeding pharmacies...');

    const pharmacyData = [
      {
        name: 'City Pharmacy',
        email: 'city@pharmacy.com',
        password: 'pharmacy123',
        phone: '9876543210',
        role: 'pharmacy',
        address: {
          street: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001'
        }
      },
      {
        name: 'Health Plus',
        email: 'health@plus.com',
        password: 'pharmacy123',
        phone: '9876543211',
        role: 'pharmacy',
        address: {
          street: '456 Park Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400002'
        }
      }
    ];

    for (const data of pharmacyData) {
      // Create pharmacy user
      const user = await User.create({
        name: data.name,
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        role: data.role,
        phone: data.phone,
        address: data.address,
        isActive: true
      });

      // Create pharmacy profile
      const pharmacy = await Pharmacy.create({
        user: user._id,
        storeName: data.name,
        licenseNumber: `LIC${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        location: {
          type: 'Point',
          coordinates: [72.8777 + Math.random() * 0.1, 19.0760 + Math.random() * 0.1]
        },
        address: data.address,
        contactInfo: {
          phone: data.phone,
          email: data.email
        },
        operatingHours: [
          {
            day: 'Monday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Tuesday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Wednesday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Thursday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Friday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Saturday',
            open: '09:00',
            close: '21:00',
            isOpen: true
          },
          {
            day: 'Sunday',
            open: '10:00',
            close: '18:00',
            isOpen: true
          }
        ],
        services: ['Home Delivery', '24x7', 'Online Consultation'],
        verificationStatus: 'verified',
        status: 'active'
      });

      this.pharmacies.push(pharmacy);
    }
  }

  /**
   * Seed medicines
   * @returns {Promise<void>}
   */
  async seedMedicines() {
    logger.info('Seeding medicines...');

    const medicineData = [
      {
        name: 'Paracetamol 500mg',
        genericName: 'Paracetamol',
        category: 'non-prescription',
        subCategory: 'pain-relief',
        manufacturer: 'GSK',
        description: 'Pain relief and fever reduction',
        price: 30,
        stock: 100,
        unit: 'tablet',
        packageSize: '10 tablets',
        prescriptionRequired: false
      },
      {
        name: 'Amoxicillin 250mg',
        genericName: 'Amoxicillin',
        category: 'prescription',
        subCategory: 'tablets',
        manufacturer: 'Cipla',
        description: 'Antibiotic for bacterial infections',
        price: 150,
        stock: 50,
        unit: 'capsule',
        packageSize: '10 capsules',
        prescriptionRequired: true
      },
      {
        name: 'Vitamin C 500mg',
        genericName: 'Ascorbic Acid',
        category: 'non-prescription',
        subCategory: 'vitamins-supplements',
        manufacturer: 'HealthVit',
        description: 'Vitamin C supplement',
        price: 80,
        stock: 75,
        unit: 'tablet',
        packageSize: '30 tablets',
        prescriptionRequired: false
      }
    ];

    for (const pharmacy of this.pharmacies) {
      for (const data of medicineData) {
        const medicine = await Medicine.create({
          ...data,
          pharmacy: pharmacy._id,
          images: ['default-medicine.jpg'],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          batchNumber: `BATCH${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          status: 'active'
        });

        this.medicines.push(medicine);
      }
    }
  }

  /**
   * Get seeded data
   * @returns {Object}
   */
  getSeededData() {
    return {
      adminUser: this.adminUser,
      pharmacies: this.pharmacies,
      medicines: this.medicines
    };
  }
}

module.exports = new DatabaseSeeder();