const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');

const helpers = {
  // Database cleanup
  async clearDatabase() {
    await User.deleteMany({});
    await Pharmacy.deleteMany({});
    await Medicine.deleteMany({});
    await Order.deleteMany({});
  },

  // Create test user
  async createUser(role = 'customer') {
    const user = await User.create({
      name: `Test ${role}`,
      email: `${role}@test.com`,
      password: 'password123',
      phone: '1234567890',
      role: role
    });
    return user;
  },

  // Create test pharmacy
  async createPharmacy(user) {
    const pharmacy = await Pharmacy.create({
      user: user._id,
      storeName: 'Test Pharmacy Store',
      licenseNumber: 'TEST123',
      address: {
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '123456'
      },
      status: 'verified'
    });
    return pharmacy;
  },

  // Create test medicine
  async createMedicine(pharmacy) {
    const medicine = await Medicine.create({
      name: 'Test Medicine',
      genericName: 'Test Generic',
      pharmacy: pharmacy._id,
      category: 'non-prescription',
      manufacturer: 'Test Manufacturer',
      price: 100,
      stock: 50,
      description: 'Test medicine description'
    });
    return medicine;
  },

  // Create test order
  async createOrder(customer, pharmacy, medicines) {
    const order = await Order.create({
      customer: customer._id,
      pharmacy: pharmacy._id,
      items: medicines.map(medicine => ({
        medicine: medicine._id,
        quantity: 1,
        price: medicine.price
      })),
      deliveryAddress: {
        street: 'Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '123456'
      },
      status: 'pending'
    });
    return order;
  },

  // Browser login helper
  async loginUser(page, email, password) {
    await page.goto(`http://localhost:${process.env.PORT || 5000}/login`);
    await page.type('#email', email);
    await page.type('#password', password);
    await Promise.all([
      page.waitForNavigation(),
      page.click('#login-button')
    ]);
  }
};

module.exports = helpers;