const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Get all medicines
 * @route   GET /api/medicines
 * @access  Public
 */
exports.getMedicines = async (req, res, next) => {
  try {
    const {
      category,
      subCategory,
      pharmacy,
      search,
      minPrice,
      maxPrice,
      inStock,
      sort = '-createdAt',
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    const query = {};

    // Category filter
    if (category) {
      query.category = category;
    }

    // Subcategory filter
    if (subCategory) {
      query.subCategory = subCategory;
    }

    // Pharmacy filter
    if (pharmacy) {
      query.pharmacy = pharmacy;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter - only show active medicines
    query.status = 'active';

    // Execute query with pagination
    const skip = (page - 1) * limit;

    const medicines = await Medicine.find(query)
      .populate('pharmacy', 'storeName address contactInfo ratings')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Medicine.countDocuments(query);

    res.status(200).json({
      success: true,
      count: medicines.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: medicines
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single medicine
 * @route   GET /api/medicines/:id
 * @access  Public
 */
exports.getMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('pharmacy', 'storeName address contactInfo ratings')
      .populate('reviews.user', 'name');

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create medicine
 * @route   POST /api/medicines
 * @access  Private (Pharmacy Only)
 */
exports.createMedicine = async (req, res, next) => {
  try {
    // Add pharmacy to req.body
    req.body.pharmacy = req.pharmacy._id;

    // Check if medicine with same name exists for this pharmacy
    const existingMedicine = await Medicine.findOne({
      name: req.body.name,
      pharmacy: req.pharmacy._id
    });

    if (existingMedicine) {
      return next(ErrorResponse.conflict('Medicine already exists in your inventory'));
    }

    const medicine = await Medicine.create(req.body);

    res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update medicine
 * @route   PUT /api/medicines/:id
 * @access  Private (Pharmacy Only)
 */
exports.updateMedicine = async (req, res, next) => {
  try {
    let medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    // Make sure pharmacy owns medicine
    if (medicine.pharmacy.toString() !== req.pharmacy._id.toString()) {
      return next(ErrorResponse.authorization('Not authorized to update this medicine'));
    }

    // Fields that cannot be updated
    const restrictedFields = ['pharmacy'];
    restrictedFields.forEach(field => delete req.body[field]);

    medicine = await Medicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete medicine
 * @route   DELETE /api/medicines/:id
 * @access  Private (Pharmacy Only)
 */
exports.deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    // Make sure pharmacy owns medicine
    if (medicine.pharmacy.toString() !== req.pharmacy._id.toString()) {
      return next(ErrorResponse.authorization('Not authorized to delete this medicine'));
    }

    // Instead of deleting, mark as inactive
    medicine.status = 'discontinued';
    await medicine.save();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update medicine stock
 * @route   PUT /api/medicines/:id/stock
 * @access  Private (Pharmacy Only)
 */
exports.updateStock = async (req, res, next) => {
  try {
    const { operation, quantity } = req.body;

    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    // Make sure pharmacy owns medicine
    if (medicine.pharmacy.toString() !== req.pharmacy._id.toString()) {
      return next(ErrorResponse.authorization('Not authorized to update this medicine'));
    }

    // Update stock based on operation
    if (operation === 'add') {
      medicine.stock += quantity;
    } else if (operation === 'subtract') {
      if (medicine.stock < quantity) {
        return next(ErrorResponse.badRequest('Insufficient stock'));
      }
      medicine.stock -= quantity;
    } else {
      return next(ErrorResponse.badRequest('Invalid operation'));
    }

    await medicine.save();

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add medicine review
 * @route   POST /api/medicines/:id/reviews
 * @access  Private (Customer Only)
 */
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    // Check if user has purchased this medicine
    const hasPurchased = await Order.exists({
      customer: req.user.id,
      'items.medicine': medicine._id,
      status: 'delivered'
    });

    if (!hasPurchased) {
      return next(ErrorResponse.badRequest('You can only review medicines you have purchased'));
    }

    // Check if user has already reviewed
    const existingReview = medicine.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return next(ErrorResponse.badRequest('You have already reviewed this medicine'));
    }

    // Add review
    await medicine.addReview(req.user.id, rating, comment);

    res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medicine reviews
 * @route   GET /api/medicines/:id/reviews
 * @access  Public
 */
exports.getReviews = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .select('reviews ratings')
      .populate('reviews.user', 'name');

    if (!medicine) {
      return next(ErrorResponse.notFound('Medicine not found'));
    }

    res.status(200).json({
      success: true,
      count: medicine.reviews.length,
      data: {
        ratings: medicine.ratings,
        reviews: medicine.reviews
      }
    });
  } catch (error) {
    next(error);
  }
};