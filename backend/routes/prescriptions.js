const express = require('express');
const router = express.Router();
const {
  uploadPrescription,
  getCustomerPrescriptions,
  getPharmacyPrescriptions,
  getPrescription,
  verifyPrescription,
  getPrescriptionMedicines,
  requestRefill
} = require('../controllers/prescriptionController');

const { protect, authorize } = require('../middleware/authMiddleware');
const fileHandler = require('../utils/fileHandler');

// Protect all routes
router.use(protect);

// Customer routes
router.post(
  '/upload',
  authorize('customer'),
  fileHandler.upload.array('images', 5),
  uploadPrescription
);

router.get('/', authorize('customer'), getCustomerPrescriptions);
router.post('/:id/refill', authorize('customer'), requestRefill);

// Pharmacy routes
router.get('/pharmacy', authorize('pharmacy'), getPharmacyPrescriptions);
router.put('/:id/verify', authorize('pharmacy'), verifyPrescription);

// Shared routes (accessible by both customer and pharmacy)
router.get('/:id', getPrescription);
router.get('/:id/medicines', getPrescriptionMedicines);

module.exports = router;