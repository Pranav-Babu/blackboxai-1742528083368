const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Add to cart
 * @route   POST /api/orders/cart
 * @access  Private (Customer)
 */
exports.addToCart = async (req, res, next) => {
  try {
    const { medicineId, quantity } = req.body;

    // Check if medicine exists and is available
    const medicine = await Medicine.findOne({
      _id: medicineId,
      status: 'active',
      stock: { $gte: quantity }
    });

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found or insufficient stock'));
    }

    // Find or create cart order
    let cart = await Order.findOne({
      customer: req.user.id,
      status: 'cart'
    });

    if (!cart) {
      cart = await Order.create({
        customer: req.user.id,
        pharmacy: medicine.pharmacy,
        status: 'cart',
        items: []
      });
    }

    // Check if medicine is from same pharmacy
    if (cart.pharmacy.toString() !== medicine.pharmacy.toString()) {
      return next(ErrorResponse.badRequest('Cannot add items from different pharmacies'));
    }

    // Add or update item in cart
    const existingItem = cart.items.find(
      item => item.medicine.toString() === medicineId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        medicine: medicineId,
        quantity,
        price: medicine.price,
        discountedPrice: medicine.discountedPrice
      });
    }

    // Recalculate amounts
    await cart.calculateAmounts();

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get cart
 * @route   GET /api/orders/cart
 * @access  Private (Customer)
 */
exports.getCart = async (req, res, next) => {
  try {
    const cart = await Order.findOne({
      customer: req.user.id,
      status: 'cart'
    }).populate('items.medicine', 'name manufacturer price images');

    res.status(200).json({
      success: true,
      data: cart || { items: [] }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private (Customer)
 */
exports.createOrder = async (req, res, next) => {
  try {
    const {
      pharmacy,
      items,
      deliverySlot,
      deliveryAddress,
      prescription,
      notes
    } = req.body;

    // Check if pharmacy exists and is active
    const pharmacyExists = await Pharmacy.findOne({
      _id: pharmacy,
      status: 'active',
      verificationStatus: 'verified'
    });

    if (!pharmacyExists) {
      return next(ErrorResponse.notFound('Pharmacy not found or inactive'));
    }

    // Validate delivery slot
    const isSlotAvailable = pharmacyExists.isDeliverySlotAvailable(deliverySlot.time);
    if (!isSlotAvailable) {
      return next(ErrorResponse.badRequest('Selected delivery slot is not available'));
    }

    // Validate and calculate items
    let totalAmount = 0;
    let discountedAmount = 0;

    const validatedItems = await Promise.all(items.map(async (item) => {
      const medicine = await Medicine.findById(item.medicine);
      
      if (!medicine) {
        throw new ErrorResponse.notFound(`Medicine with ID ${item.medicine} not found`);
      }

      if (medicine.pharmacy.toString() !== pharmacy) {
        throw new ErrorResponse.badRequest(`Medicine ${medicine.name} is not available from selected pharmacy`);
      }

      if (medicine.stock < item.quantity) {
        throw new ErrorResponse.badRequest(`Insufficient stock for ${medicine.name}`);
      }

      totalAmount += medicine.price * item.quantity;
      discountedAmount += (medicine.discountedPrice || medicine.price) * item.quantity;

      return {
        medicine: item.medicine,
        quantity: item.quantity,
        price: medicine.price,
        discountedPrice: medicine.discountedPrice,
        selected: true
      };
    }));

    // Calculate delivery charge
    const deliveryCharge = calculateDeliveryCharge(totalAmount, deliveryAddress);

    // Create order
    const order = await Order.create({
      customer: req.user.id,
      pharmacy,
      items: validatedItems,
      prescription,
      totalAmount,
      discountedAmount,
      deliveryCharge,
      finalAmount: discountedAmount + deliveryCharge,
      deliverySlot,
      deliveryAddress,
      notes: {
        customerNote: notes
      },
      status: prescription ? 'pending_approval' : 'approved'
    });

    // If prescription is not required, directly update medicine stock
    if (!prescription) {
      await updateMedicineStock(order.items);
    }

    // Start approval timer if needed
    if (order.status === 'pending_approval') {
      await order.startPharmacyApprovalTimer();
    }

    // Increment slot order count
    await pharmacyExists.incrementSlotOrderCount(deliverySlot.time);

    // Add initial timeline event
    await order.addTimelineEvent(order.status, 'Order created');

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get customer orders
 * @route   GET /api/orders
 * @access  Private (Customer)
 */
exports.getCustomerOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer: req.user.id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('pharmacy', 'storeName contactInfo')
      .populate('items.medicine', 'name manufacturer price images')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('pharmacy', 'storeName contactInfo')
      .populate('items.medicine', 'name manufacturer price images')
      .populate('prescription');

    if (!order) {
      return next(ErrorResponse.notFound('Order not found'));
    }

    // Check authorization
    if (
      order.customer.toString() !== req.user.id &&
      order.pharmacy.toString() !== req.user.id
    ) {
      return next(ErrorResponse.authorization('Not authorized to access this order'));
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update cart items
 * @route   PUT /api/orders/:id/cart
 * @access  Private (Customer)
 */
exports.updateCart = async (req, res, next) => {
  try {
    const { items } = req.body;

    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user.id,
      status: 'cart'
    });

    if (!order) {
      return next(ErrorResponse.notFound('Cart not found'));
    }

    // Update selected status of items
    items.forEach(updateItem => {
      const item = order.items.id(updateItem.id);
      if (item) {
        item.selected = updateItem.selected;
        if (updateItem.quantity) {
          item.quantity = updateItem.quantity;
        }
      }
    });

    // Recalculate order amounts
    await order.calculateAmounts();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm order
 * @route   PUT /api/orders/:id/confirm
 * @access  Private (Customer)
 */
exports.confirmOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user.id,
      status: 'approved'
    });

    if (!order) {
      return next(ErrorResponse.notFound('Order not found or cannot be confirmed'));
    }

    // Check if customer confirmation timer is still valid
    if (order.customerConfirmationTimeRemaining <= 0) {
      order.status = 'cancelled';
      await order.save();
      return next(ErrorResponse.badRequest('Order confirmation time expired'));
    }

    // Update order status
    order.status = 'processing';
    await order.addTimelineEvent('processing', 'Order confirmed by customer');

    // Update medicine stock
    await updateMedicineStock(order.items);

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return next(ErrorResponse.notFound('Order not found'));
    }

    // Check authorization
    if (
      order.customer.toString() !== req.user.id &&
      order.pharmacy.toString() !== req.user.id
    ) {
      return next(ErrorResponse.authorization('Not authorized to cancel this order'));
    }

    // Check if order can be cancelled
    const cancellableStatuses = ['pending_approval', 'approved', 'processing'];
    if (!cancellableStatuses.includes(order.status)) {
      return next(ErrorResponse.badRequest('Order cannot be cancelled at this stage'));
    }

    // Update order status
    order.status = 'cancelled';
    order.notes.cancellationNote = req.body.reason;
    await order.addTimelineEvent('cancelled', req.body.reason);

    // Restore medicine stock if already deducted
    if (order.status === 'processing') {
      await restoreMedicineStock(order.items);
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Utility functions

/**
 * Calculate delivery charge based on order amount and delivery address
 * @param {Number} orderAmount 
 * @param {Object} deliveryAddress 
 * @returns {Number}
 */
const calculateDeliveryCharge = (orderAmount, deliveryAddress) => {
  // Basic implementation - can be enhanced based on business rules
  const baseCharge = 50;
  return orderAmount > 500 ? 0 : baseCharge;
};

/**
 * Update medicine stock after order confirmation
 * @param {Array} items 
 */
const updateMedicineStock = async (items) => {
  for (const item of items) {
    if (item.selected) {
      await Medicine.findByIdAndUpdate(item.medicine, {
        $inc: { stock: -item.quantity }
      });
    }
  }
};

/**
 * Restore medicine stock after order cancellation
 * @param {Array} items 
 */
const restoreMedicineStock = async (items) => {
  for (const item of items) {
    if (item.selected) {
      await Medicine.findByIdAndUpdate(item.medicine, {
        $inc: { stock: item.quantity }
      });
    }
  }
};

module.exports = exports;