const express = require('express');
const router = express.Router();
const { validate, validationRules } = require('../utils/validator');
const {
  getPharmacies,
  getPharmacy,
  updatePharmacyProfile,
  getDashboardStats,
  getPharmacyOrders,
  updateOrderStatus,
  reviewPharmacy,
  getPharmacyReviews
} = require('../controllers/pharmacyController');
const {
  protect,
  authorize,
  verifyPharmacy
} = require('../middleware/authMiddleware');

// Public routes
router.get('/', getPharmacies);
router.get('/:id', getPharmacy);
router.get('/:id/reviews', getPharmacyReviews);

// Protected routes - Customer only
router.use(protect);
router.post('/:id/reviews', authorize('customer'), validate(validationRules.pharmacy.review), reviewPharmacy);

// Protected routes - Pharmacy only
router.use(protect, authorize('pharmacy'), verifyPharmacy);

// Pharmacy profile management
router.put('/profile', validate(validationRules.pharmacy.update), updatePharmacyProfile);

// Dashboard and statistics
router.get('/dashboard/stats', getDashboardStats);

// Order management
router.get('/orders', getPharmacyOrders);
router.put('/orders/:orderId', validate(validationRules.order.updateStatus), updateOrderStatus);

// Advanced routes
router
  .route('/dashboard/analytics')
  .get((req, res) => {
    // TODO: Implement analytics endpoint
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/inventory/low-stock')
  .get((req, res) => {
    // TODO: Implement low stock alert endpoint
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/customers/frequent')
  .get((req, res) => {
    // TODO: Implement frequent customers endpoint
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Nested routes
router.use('/:pharmacyId/medicines', require('./medicines'));
router.use('/:pharmacyId/prescriptions', require('./prescriptions'));

// Error handling for pharmacy-specific routes
router.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map(val => val.message)
    });
  }
  next(err);
});

module.exports = router;