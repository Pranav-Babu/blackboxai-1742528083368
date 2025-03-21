const puppeteer = require('puppeteer');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const helpers = require('../helpers');
const app = require('../../server');

let mongod;
let browser;
let page;
let server;

describe('E2E Tests', () => {
  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    // Start server
    const port = process.env.PORT || 5000;
    server = app.listen(port);

    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
  });

  beforeEach(async () => {
    await helpers.clearDatabase();
  });

  afterAll(async () => {
    await browser.close();
    await mongoose.disconnect();
    await mongod.stop();
    server.close();
  });

  describe('Customer Order Flow', () => {
    it('should complete full order process', async () => {
      // Create test pharmacy and medicines
      const pharmacyUser = await helpers.createUser('pharmacy');
      const pharmacy = await helpers.createPharmacy(pharmacyUser);
      const medicine = await helpers.createMedicine(pharmacy);

      // Customer registration
      await page.goto('http://localhost:5000/register');
      await page.type('#name', 'Test Customer');
      await page.type('#email', 'customer@test.com');
      await page.type('#password', 'password123');
      await page.type('#phone', '1234567890');
      await page.select('#role', 'customer');
      
      await Promise.all([
        page.waitForNavigation(),
        page.click('#register-button')
      ]);

      // Search for medicine
      await page.goto('http://localhost:5000/medicines');
      await page.type('#search', 'Test Medicine');
      await page.click('#search-button');
      
      // Add to cart
      await page.click('#add-to-cart');
      
      // Go to cart
      await page.goto('http://localhost:5000/cart');
      
      // Checkout process
      await page.type('#delivery-street', 'Test Street');
      await page.type('#delivery-city', 'Test City');
      await page.type('#delivery-state', 'Test State');
      await page.type('#delivery-zip', '123456');
      
      await Promise.all([
        page.waitForNavigation(),
        page.click('#checkout-button')
      ]);

      // Verify order success
      const orderSuccessText = await page.$eval('#order-success', el => el.textContent);
      expect(orderSuccessText).toContain('Order placed successfully');

      // Verify order in database
      const orders = await mongoose.model('Order').find({}).populate('customer');
      expect(orders).toHaveLength(1);
      expect(orders[0].customer.email).toBe('customer@test.com');
      expect(orders[0].status).toBe('pending');
    }, 30000);
  });

  describe('Pharmacy Management Flow', () => {
    it('should manage inventory and orders', async () => {
      // Create and login as pharmacy
      const pharmacyUser = await helpers.createUser('pharmacy');
      await helpers.loginUser(page, pharmacyUser.email, 'password123');

      // Add new medicine
      await page.goto('http://localhost:5000/pharmacy/inventory');
      await page.click('#add-medicine');
      await page.type('#medicine-name', 'New Test Medicine');
      await page.type('#generic-name', 'Test Generic');
      await page.type('#manufacturer', 'Test Manufacturer');
      await page.type('#price', '150');
      await page.type('#stock', '100');
      await page.type('#description', 'Test Description');
      await page.select('#category', 'non-prescription');
      
      await Promise.all([
        page.waitForNavigation(),
        page.click('#save-medicine')
      ]);

      // Verify medicine added
      const medicineText = await page.$eval('.medicine-list', el => el.textContent);
      expect(medicineText).toContain('New Test Medicine');

      // Create test order
      const customer = await helpers.createUser('customer');
      const pharmacy = await helpers.createPharmacy(pharmacyUser);
      const medicine = await helpers.createMedicine(pharmacy);
      await helpers.createOrder(customer, pharmacy, [medicine]);

      // Check orders page
      await page.goto('http://localhost:5000/pharmacy/orders');
      const orderText = await page.$eval('.order-list', el => el.textContent);
      expect(orderText).toContain('Test Medicine');
      expect(orderText).toContain('pending');

      // Update order status
      await page.select('#order-status', 'processing');
      await page.click('#update-status');

      // Verify status updated
      const updatedOrderText = await page.$eval('.order-list', el => el.textContent);
      expect(updatedOrderText).toContain('processing');
    }, 30000);
  });
});