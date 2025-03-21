const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable access to parent router params
const { validate, validationRules } = require('../utils/validator');
const {
  upload,
  uploadPrescription,
  getCustomerPrescriptions,
  getPharmacyPrescriptions,
  getPrescription,
  verifyPrescription,
  forwardPrescription,
  requestRefill
} = require('../controllers/prescriptionController');
const {
  protect,
  authorize,
  verifyPharmacy
} = require('../middleware/authMiddleware');

// Protected routes - all routes require authentication
router.use(protect);

// Customer routes
router
  .route('/')
  .post(
    authorize('customer'),
    upload.array('prescriptionImages', 5), // Allow up to 5 prescription images
    validate(validationRules.prescription.upload),
    uploadPrescription
  )
  .get(
    authorize('customer'),
    getCustomerPrescriptions
  );

// Get single prescription - accessible by both customer and pharmacy
router
  .route('/:id')
  .get(getPrescription);

// Customer-specific prescription actions
router
  .route('/:id/forward')
  .post(
    authorize('customer'),
    validate(validationRules.prescription.forward),
    forwardPrescription
  );

router
  .route('/:id/refill')
  .post(
    authorize('customer'),
    validate(validationRules.prescription.refill),
    requestRefill
  );

// Pharmacy routes
router
  .route('/pharmacy')
  .get(
    authorize('pharmacy'),
    verifyPharmacy,
    getPharmacyPrescriptions
  );

router
  .route('/:id/verify')
  .put(
    authorize('pharmacy'),
    verifyPharmacy,
    validate(validationRules.prescription.verify),
    verifyPrescription
  );

// Prescription history routes
router
  .route('/:id/history')
  .get((req, res) => {
    // TODO: Implement prescription history retrieval
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Prescription analytics routes
router
  .route('/analytics/customer')
  .get(
    authorize('customer'),
    (req, res) => {
      // TODO: Implement customer prescription analytics
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/analytics/pharmacy')
  .get(
    authorize('pharmacy'),
    verifyPharmacy,
    (req, res) => {
      // TODO: Implement pharmacy prescription analytics
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Recurring prescription management
router
  .route('/:id/recurring/schedule')
  .put(
    authorize('customer'),
    validate(validationRules.prescription.updateRecurring),
    (req, res) => {
      // TODO: Implement recurring prescription schedule update
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/:id/recurring/cancel')
  .put(
    authorize('customer'),
    (req, res) => {
      // TODO: Implement recurring prescription cancellation
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Prescription reminder routes
router
  .route('/reminders')
  .get(
    authorize('customer'),
    (req, res) => {
      // TODO: Implement prescription reminders retrieval
      res.status(501).json({ message: 'Not implemented yet' });
    }
  )
  .post(
    authorize('customer'),
    validate(validationRules.prescription.createReminder),
    (req, res) => {
      // TODO: Implement prescription reminder creation
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/reminders/:reminderId')
  .put(
    authorize('customer'),
    validate(validationRules.prescription.updateReminder),
    (req, res) => {
      // TODO: Implement prescription reminder update
      res.status(501).json({ message: 'Not implemented yet' });
    }
  )
  .delete(
    authorize('customer'),
    (req, res) => {
      // TODO: Implement prescription reminder deletion
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Error handling middleware
router.use((err, req, res, next) => {
  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File size cannot exceed 5MB'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected field in file upload'
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map(val => val.message)
    });
  }

  // Handle invalid ObjectId errors
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: 'Invalid prescription ID'
    });
  }

  next(err);
});

module.exports = router;