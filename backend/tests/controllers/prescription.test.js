const request = require('supertest');
const app = require('../../server');
const helpers = require('../helpers');
const Prescription = require('../../models/Prescription');

describe('Prescription Controller', () => {
  let pharmacyUser;
  let pharmacy;
  let pharmacyToken;
  let customerUser;
  let customerToken;
  let prescription;

  beforeEach(async () => {
    await helpers.clearDatabase();
    
    // Create pharmacy user and profile
    pharmacyUser = await helpers.createUser('pharmacy');
    pharmacy = await helpers.createPharmacy(pharmacyUser);
    pharmacyToken = helpers.generateToken(pharmacyUser);

    // Create customer user
    customerUser = await helpers.createUser('customer');
    customerToken = helpers.generateToken(customerUser);

    // Create prescription
    prescription = await helpers.createPrescription(customerUser, pharmacy);
  });

  describe('POST /api/prescriptions', () => {
    it('should upload new prescription', async () => {
      const prescriptionData = {
        pharmacy: pharmacy._id,
        doctorDetails: {
          name: 'Dr. Test Doctor',
          registrationNumber: 'REG123'
        },
        patientDetails: {
          name: customerUser.name,
          age: 30,
          gender: 'male'
        },
        validity: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isRecurring: false
      };

      // Mock file upload
      const response = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(customerToken))
        .field('data', JSON.stringify(prescriptionData))
        .attach('prescriptionImages', Buffer.from('fake-image'), 'prescription.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.images).toBeDefined();
    });

    it('should validate file types', async () => {
      const response = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(customerToken))
        .field('pharmacy', pharmacy._id)
        .attach('prescriptionImages', Buffer.from('fake-doc'), 'doc.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid file type');
    });

    it('should handle recurring prescriptions', async () => {
      const prescriptionData = {
        pharmacy: pharmacy._id,
        doctorDetails: {
          name: 'Dr. Test Doctor',
          registrationNumber: 'REG123'
        },
        patientDetails: {
          name: customerUser.name,
          age: 30,
          gender: 'male'
        },
        validity: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isRecurring: true,
        recurringDetails: {
          interval: 30,
          totalRefills: 3
        }
      };

      const response = await request(app)
        .post('/api/prescriptions')
        .set(helpers.authHeader(customerToken))
        .field('data', JSON.stringify(prescriptionData))
        .attach('prescriptionImages', Buffer.from('fake-image'), 'prescription.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isRecurring).toBe(true);
      expect(response.body.data.recurringDetails.remainingRefills).toBe(3);
    });
  });

  describe('GET /api/prescriptions', () => {
    beforeEach(async () => {
      // Create additional prescriptions
      await helpers.createPrescription(customerUser, pharmacy, { status: 'verified' });
      await helpers.createPrescription(customerUser, pharmacy, { status: 'rejected' });
    });

    it('should get customer prescriptions', async () => {
      const response = await request(app)
        .get('/api/prescriptions')
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter prescriptions by status', async () => {
      const response = await request(app)
        .get('/api/prescriptions')
        .query({ status: 'verified' })
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('verified');
    });

    it('should get pharmacy prescriptions', async () => {
      const response = await request(app)
        .get('/api/prescriptions/pharmacy')
        .set(helpers.authHeader(pharmacyToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('GET /api/prescriptions/:id', () => {
    it('should get prescription by id', async () => {
      const response = await request(app)
        .get(`/api/prescriptions/${prescription._id}`)
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(prescription._id.toString());
    });

    it('should not allow unauthorized access', async () => {
      const unauthorizedUser = await helpers.createUser('customer');
      const unauthorizedToken = helpers.generateToken(unauthorizedUser);

      const response = await request(app)
        .get(`/api/prescriptions/${prescription._id}`)
        .set(helpers.authHeader(unauthorizedToken))
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Not authorized to view this prescription');
    });
  });

  describe('PUT /api/prescriptions/:id/verify', () => {
    it('should verify prescription', async () => {
      const verificationData = {
        status: 'verified',
        notes: 'Prescription verified',
        medicines: [{
          name: 'Test Medicine',
          dosage: '1 tablet daily',
          duration: '7 days'
        }],
        validityPeriod: 30
      };

      const response = await request(app)
        .put(`/api/prescriptions/${prescription._id}/verify`)
        .set(helpers.authHeader(pharmacyToken))
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('verified');
      expect(response.body.data.verificationDetails).toBeDefined();
    });

    it('should reject prescription', async () => {
      const rejectionData = {
        status: 'rejected',
        notes: 'Invalid prescription'
      };

      const response = await request(app)
        .put(`/api/prescriptions/${prescription._id}/verify`)
        .set(helpers.authHeader(pharmacyToken))
        .send(rejectionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('rejected');
    });

    it('should not verify already verified prescription', async () => {
      prescription.status = 'verified';
      await prescription.save();

      const response = await request(app)
        .put(`/api/prescriptions/${prescription._id}/verify`)
        .set(helpers.authHeader(pharmacyToken))
        .send({ status: 'verified' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prescription has already been processed');
    });
  });

  describe('POST /api/prescriptions/:id/forward', () => {
    it('should forward prescription to another pharmacy', async () => {
      const newPharmacyUser = await helpers.createUser('pharmacy');
      const newPharmacy = await helpers.createPharmacy(newPharmacyUser);

      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/forward`)
        .set(helpers.authHeader(customerToken))
        .send({ newPharmacy: newPharmacy._id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pharmacy.toString()).toBe(newPharmacy._id.toString());
      expect(response.body.data.status).toBe('pending');
    });

    it('should not forward verified prescription', async () => {
      prescription.status = 'verified';
      await prescription.save();

      const newPharmacyUser = await helpers.createUser('pharmacy');
      const newPharmacy = await helpers.createPharmacy(newPharmacyUser);

      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/forward`)
        .set(helpers.authHeader(customerToken))
        .send({ newPharmacy: newPharmacy._id })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prescription cannot be forwarded at this stage');
    });
  });

  describe('POST /api/prescriptions/:id/refill', () => {
    beforeEach(async () => {
      prescription.isRecurring = true;
      prescription.status = 'verified';
      prescription.recurringDetails = {
        interval: 30,
        totalRefills: 3,
        remainingRefills: 2,
        lastRefillDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      };
      await prescription.save();
    });

    it('should process prescription refill', async () => {
      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set(helpers.authHeader(customerToken))
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prescription.recurringDetails.remainingRefills).toBe(1);
      expect(response.body.data.order).toBeDefined();
    });

    it('should not refill when no refills remaining', async () => {
      prescription.recurringDetails.remainingRefills = 0;
      await prescription.save();

      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set(helpers.authHeader(customerToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prescription is not eligible for refill');
    });

    it('should not refill too early', async () => {
      prescription.recurringDetails.lastRefillDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      await prescription.save();

      const response = await request(app)
        .post(`/api/prescriptions/${prescription._id}/refill`)
        .set(helpers.authHeader(customerToken))
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Prescription is not eligible for refill');
    });
  });
});