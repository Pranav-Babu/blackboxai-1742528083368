const express = require('express');
const router = express.Router();
const {
  createOrder,
  getCustomerOrders,
  getOrder,
  updateCart,
  confirmOrder,
  cancelOrder,
  addToCart,
  getCart
} = require('../controllers/orderController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Protect all routes
router.use(protect);

// Cart routes (Customer only)
router.post('/cart', authorize('customer'), addToCart);
router.get('/cart', authorize('customer'), getCart);
router.put('/cart/:id', authorize('customer'), updateCart);

// Order routes
router.route('/')
  .post(authorize('customer'), createOrder)
  .get(authorize('customer'), getCustomerOrders);

router.route('/:id')
  .get(getOrder)
  .put(authorize('customer'), updateCart);

router.put('/:id/confirm', authorize('customer'), confirmOrder);
router.put('/:id/cancel', cancelOrder);

module.exports = router;