const express = require('express');
const router = express.Router();
const {
  getMedicines,
  getMedicine,
  searchMedicines,
  getDailyNeeds,
  getMedicineSuggestions,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  updateStock,
  addReview,
  getReviews
} = require('../controllers/medicineController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getMedicines);
router.get('/search', searchMedicines);
router.get('/daily-needs', getDailyNeeds);
router.get('/suggestions', getMedicineSuggestions);
router.get('/:id', getMedicine);
router.get('/:id/reviews', getReviews);

// Protected routes
router.use(protect);

// Customer routes
router.post('/:id/reviews', authorize('customer'), addReview);

// Pharmacy routes
router.post('/', authorize('pharmacy'), createMedicine);
router.put('/:id', authorize('pharmacy'), updateMedicine);
router.delete('/:id', authorize('pharmacy'), deleteMedicine);
router.put('/:id/stock', authorize('pharmacy'), updateStock);

module.exports = router;