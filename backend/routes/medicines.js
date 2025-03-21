const express = require('express');
const router = express.Router({ mergeParams: true }); // Enable access to parent router params
const { validate, validationRules } = require('../utils/validator');
const {
  getMedicines,
  getMedicine,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
  addReview,
  getReviews
} = require('../controllers/medicineController');
const {
  protect,
  authorize,
  verifyPharmacy
} = require('../middleware/authMiddleware');

// Public routes
router
  .route('/')
  .get(validate(validationRules.search.medicines), getMedicines);

router
  .route('/:id')
  .get(getMedicine);

router
  .route('/:id/reviews')
  .get(getReviews);

// Protected routes - Customer only
router.use(protect);
router.post(
  '/:id/reviews',
  authorize('customer'),
  validate(validationRules.medicine.review),
  addReview
);

// Protected routes - Pharmacy only
router.use(protect, authorize('pharmacy'), verifyPharmacy);

router
  .route('/')
  .post(validate(validationRules.medicine.create), createMedicine);

router
  .route('/:id')
  .put(validate(validationRules.medicine.update), updateMedicine)
  .delete(deleteMedicine);

router
  .route('/:id/stock')
  .put(validate(validationRules.medicine.updateStock), updateStock);

// Bulk operations
router
  .route('/bulk/create')
  .post(validate(validationRules.medicine.bulkCreate), (req, res) => {
    // TODO: Implement bulk medicine creation
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/bulk/update')
  .put(validate(validationRules.medicine.bulkUpdate), (req, res) => {
    // TODO: Implement bulk medicine update
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Category management
router
  .route('/categories')
  .get((req, res) => {
    // Return predefined categories
    res.json({
      success: true,
      data: {
        categories: [
          {
            name: 'prescription',
            subCategories: [
              'tablets',
              'capsules',
              'syrups',
              'injections',
              'topical',
              'drops',
              'inhalers'
            ]
          },
          {
            name: 'non-prescription',
            subCategories: [
              'pain-relief',
              'cold-and-flu',
              'digestive-health',
              'first-aid',
              'vitamins-supplements'
            ]
          },
          {
            name: 'daily-needs',
            subCategories: [
              'personal-care',
              'baby-care',
              'health-supplements',
              'skin-care',
              'health-devices',
              'ayurvedic'
            ]
          }
        ]
      }
    });
  });

// Search and filter endpoints
router
  .route('/search/advanced')
  .get(validate(validationRules.search.advanced), (req, res) => {
    // TODO: Implement advanced search with multiple filters
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/filter/price-range')
  .get((req, res) => {
    // TODO: Implement price range aggregation
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Analytics endpoints
router
  .route('/analytics/popular')
  .get((req, res) => {
    // TODO: Implement popular medicines analytics
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/analytics/low-stock')
  .get((req, res) => {
    // TODO: Implement low stock analytics
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Error handling middleware
router.use((err, req, res, next) => {
  // Handle medicine-specific errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map(val => val.message)
    });
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate medicine entry'
    });
  }

  next(err);
});

module.exports = router;