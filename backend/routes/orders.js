const express = require('express');
const router = express.Router();
const { validate, validationRules } = require('../utils/validator');
const {
  createOrder,
  getCustomerOrders,
  getOrder,
  updateCart,
  confirmOrder,
  cancelOrder
} = require('../controllers/orderController');
const {
  protect,
  authorize
} = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Customer routes
router
  .route('/')
  .post(
    authorize('customer'),
    validate(validationRules.order.create),
    createOrder
  )
  .get(
    authorize('customer'),
    getCustomerOrders
  );

router
  .route('/:id')
  .get(getOrder);

router
  .route('/:id/cart')
  .put(
    authorize('customer'),
    validate(validationRules.order.updateCart),
    updateCart
  );

router
  .route('/:id/confirm')
  .put(
    authorize('customer'),
    validate(validationRules.order.confirm),
    confirmOrder
  );

router
  .route('/:id/cancel')
  .put(
    validate(validationRules.order.cancel),
    cancelOrder
  );

// Cart management routes
router
  .route('/:id/cart/add')
  .post(
    authorize('customer'),
    validate(validationRules.order.addToCart),
    (req, res) => {
      // TODO: Implement add to cart functionality
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/:id/cart/remove')
  .post(
    authorize('customer'),
    validate(validationRules.order.removeFromCart),
    (req, res) => {
      // TODO: Implement remove from cart functionality
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/:id/cart/move-to-wishlist')
  .post(
    authorize('customer'),
    validate(validationRules.order.moveToWishlist),
    (req, res) => {
      // TODO: Implement move to wishlist functionality
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Order tracking routes
router
  .route('/:id/track')
  .get((req, res) => {
    // TODO: Implement order tracking functionality
    res.status(501).json({ message: 'Not implemented yet' });
  });

router
  .route('/:id/timeline')
  .get((req, res) => {
    // TODO: Implement order timeline functionality
    res.status(501).json({ message: 'Not implemented yet' });
  });

// Delivery slot management
router
  .route('/delivery-slots')
  .get((req, res) => {
    // Return available delivery slots
    res.json({
      success: true,
      data: {
        slots: [
          { time: '6 AM', available: true },
          { time: '9 AM', available: true },
          { time: '12 PM', available: true },
          { time: '3 PM', available: true },
          { time: '6 PM', available: true },
          { time: '9 PM', available: true },
          { time: '12 AM', available: true }
        ]
      }
    });
  });

router
  .route('/:id/delivery-slot')
  .put(
    authorize('customer'),
    validate(validationRules.order.updateDeliverySlot),
    (req, res) => {
      // TODO: Implement delivery slot update functionality
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Payment routes
router
  .route('/:id/payment')
  .post(
    authorize('customer'),
    validate(validationRules.order.initiatePayment),
    (req, res) => {
      // TODO: Implement payment initiation
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

router
  .route('/:id/payment/verify')
  .post(
    authorize('customer'),
    validate(validationRules.order.verifyPayment),
    (req, res) => {
      // TODO: Implement payment verification
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Order analytics routes
router
  .route('/analytics/customer')
  .get(
    authorize('customer'),
    (req, res) => {
      // TODO: Implement customer order analytics
      res.status(501).json({ message: 'Not implemented yet' });
    }
  );

// Error handling middleware
router.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: Object.values(err.errors).map(val => val.message)
    });
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: 'Invalid order ID'
    });
  }

  next(err);
});

module.exports = router;