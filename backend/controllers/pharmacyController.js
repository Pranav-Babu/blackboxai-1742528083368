const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Get all pharmacies
 * @route   GET /api/pharmacies
 * @access  Public
 */
exports.getPharmacies = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 10000 } = req.query; // radius in meters

    let query = {};

    // If coordinates are provided, find pharmacies within radius
    if (latitude && longitude) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: radius
        }
      };
    }

    // Add status filter
    query.status = 'active';
    query.verificationStatus = 'verified';

    const pharmacies = await Pharmacy.find(query)
      .populate('user', 'name email phone')
      .select('-documents -statistics');

    res.status(200).json({
      success: true,
      count: pharmacies.length,
      data: pharmacies
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single pharmacy
 * @route   GET /api/pharmacies/:id
 * @access  Public
 */
exports.getPharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('reviews.user', 'name');

    if (!pharmacy) {
      return next(ErrorResponse.notFound('Pharmacy not found'));
    }

    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update pharmacy profile
 * @route   PUT /api/pharmacies/profile
 * @access  Private (Pharmacy Only)
 */
exports.updatePharmacyProfile = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'storeName',
      'address',
      'contactInfo',
      'operatingHours',
      'deliverySlots',
      'services'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const pharmacy = await Pharmacy.findOneAndUpdate(
      { user: req.user.id },
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!pharmacy) {
      return next(ErrorResponse.notFound('Pharmacy profile not found'));
    }

    res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pharmacy dashboard stats
 * @route   GET /api/pharmacies/dashboard
 * @access  Private (Pharmacy Only)
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findOne({ user: req.user.id });

    if (!pharmacy) {
      return next(ErrorResponse.notFound('Pharmacy profile not found'));
    }

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get orders statistics
    const orderStats = await Order.aggregate([
      {
        $match: {
          pharmacy: pharmacy._id,
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Get low stock medicines
    const lowStockMedicines = await Medicine.find({
      pharmacy: pharmacy._id,
      stock: { $lt: 10 },
      status: 'active'
    }).select('name stock');

    // Get pending prescriptions count
    const pendingPrescriptions = await Prescription.countDocuments({
      pharmacy: pharmacy._id,
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      data: {
        orderStats,
        lowStockMedicines,
        pendingPrescriptions,
        statistics: pharmacy.statistics
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pharmacy orders
 * @route   GET /api/pharmacies/orders
 * @access  Private (Pharmacy Only)
 */
exports.getPharmacyOrders = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;

    let query = {
      pharmacy: req.pharmacy._id
    };

    if (status) {
      query.status = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone')
      .populate('items.medicine', 'name manufacturer price')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/pharmacies/orders/:orderId
 * @access  Private (Pharmacy Only)
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    const order = await Order.findOne({
      _id: req.params.orderId,
      pharmacy: req.pharmacy._id
    });

    if (!order) {
      return next(ErrorResponse.notFound('Order not found'));
    }

    // Validate status transition
    const validTransitions = {
      pending_approval: ['approved', 'rejected'],
      approved: ['processing', 'cancelled'],
      processing: ['ready_for_delivery', 'cancelled'],
      ready_for_delivery: ['out_for_delivery', 'cancelled'],
      out_for_delivery: ['delivered', 'cancelled']
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return next(ErrorResponse.badRequest('Invalid status transition'));
    }

    // Update order status
    order.status = status;
    if (note) {
      order.notes.pharmacyNote = note;
    }

    // Add timeline event
    await order.addTimelineEvent(status, note);

    // Update pharmacy statistics
    if (status === 'delivered') {
      await req.pharmacy.updateStatistics('completed');
    } else if (status === 'cancelled') {
      await req.pharmacy.updateStatistics('cancelled');
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

/**
 * @desc    Review pharmacy
 * @route   POST /api/pharmacies/:id/reviews
 * @access  Private (Customer Only)
 */
exports.reviewPharmacy = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const pharmacy = await Pharmacy.findById(req.params.id);

    if (!pharmacy) {
      return next(ErrorResponse.notFound('Pharmacy not found'));
    }

    // Check if user has ordered from this pharmacy
    const hasOrdered = await Order.exists({
      customer: req.user.id,
      pharmacy: pharmacy._id,
      status: 'delivered'
    });

    if (!hasOrdered) {
      return next(ErrorResponse.badRequest('You can only review pharmacies you have ordered from'));
    }

    // Check if user has already reviewed
    const existingReview = pharmacy.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return next(ErrorResponse.badRequest('You have already reviewed this pharmacy'));
    }

    // Add review
    pharmacy.reviews.push({
      user: req.user.id,
      rating,
      comment
    });

    // Update average rating
    await pharmacy.updateRating(rating);

    res.status(201).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pharmacy reviews
 * @route   GET /api/pharmacies/:id/reviews
 * @access  Public
 */
exports.getPharmacyReviews = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id)
      .select('reviews ratings')
      .populate('reviews.user', 'name');

    if (!pharmacy) {
      return next(ErrorResponse.notFound('Pharmacy not found'));
    }

    res.status(200).json({
      success: true,
      count: pharmacy.reviews.length,
      data: {
        ratings: pharmacy.ratings,
        reviews: pharmacy.reviews
      }
    });
  } catch (error) {
    next(error);
  }
};