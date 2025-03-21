const Prescription = require('../models/Prescription');
const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const ErrorResponse = require('../utils/errorResponse');
const multer = require('multer');
const path = require('path');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/prescriptions');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `prescription-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
  }
};

exports.upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * @desc    Upload prescription
 * @route   POST /api/prescriptions
 * @access  Private (Customer)
 */
exports.uploadPrescription = async (req, res, next) => {
  try {
    const {
      pharmacy,
      doctorDetails,
      patientDetails,
      validity,
      isRecurring,
      recurringDetails
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return next(ErrorResponse.badRequest('Please upload prescription images'));
    }

    // Create prescription record
    const prescription = await Prescription.create({
      customer: req.user.id,
      pharmacy,
      images: req.files.map(file => ({
        url: file.path
      })),
      doctorDetails,
      patientDetails,
      validity: new Date(validity),
      isRecurring: isRecurring || false,
      recurringDetails: isRecurring ? recurringDetails : undefined
    });

    // Add initial history entry
    prescription.history.push({
      action: 'uploaded',
      performedBy: req.user.id,
      notes: 'Prescription uploaded by customer'
    });

    await prescription.save();

    res.status(201).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get customer prescriptions
 * @route   GET /api/prescriptions
 * @access  Private (Customer)
 */
exports.getCustomerPrescriptions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { customer: req.user.id };
    if (status) {
      query.status = status;
    }

    const prescriptions = await Prescription.find(query)
      .populate('pharmacy', 'storeName contactInfo')
      .populate('history.performedBy', 'name role')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Prescription.countDocuments(query);

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get pharmacy prescriptions
 * @route   GET /api/prescriptions/pharmacy
 * @access  Private (Pharmacy)
 */
exports.getPharmacyPrescriptions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { pharmacy: req.pharmacy._id };
    if (status) {
      query.status = status;
    }

    const prescriptions = await Prescription.find(query)
      .populate('customer', 'name email phone')
      .populate('history.performedBy', 'name role')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Prescription.countDocuments(query);

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single prescription
 * @route   GET /api/prescriptions/:id
 * @access  Private
 */
exports.getPrescription = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('pharmacy', 'storeName contactInfo')
      .populate('history.performedBy', 'name role');

    if (!prescription) {
      return next(ErrorResponse.notFound('Prescription not found'));
    }

    // Check authorization
    if (
      prescription.customer.toString() !== req.user.id &&
      prescription.pharmacy.toString() !== req.pharmacy?._id
    ) {
      return next(ErrorResponse.authorization('Not authorized to view this prescription'));
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify prescription
 * @route   PUT /api/prescriptions/:id/verify
 * @access  Private (Pharmacy)
 */
exports.verifyPrescription = async (req, res, next) => {
  try {
    const {
      status,
      notes,
      medicines,
      validityPeriod
    } = req.body;

    const prescription = await Prescription.findOne({
      _id: req.params.id,
      pharmacy: req.pharmacy._id
    });

    if (!prescription) {
      return next(ErrorResponse.notFound('Prescription not found'));
    }

    // Update prescription status and details
    prescription.status = status;
    prescription.verificationDetails = {
      verifiedBy: req.user.id,
      verifiedAt: new Date(),
      notes,
      validityPeriod
    };

    // Update medicines information
    if (medicines && medicines.length > 0) {
      prescription.medicines = medicines;
    }

    // Add to history
    prescription.history.push({
      action: status === 'verified' ? 'verified' : 'rejected',
      performedBy: req.user.id,
      notes
    });

    await prescription.save();

    // If prescription is verified, create or update order
    if (status === 'verified' && prescription.order) {
      const order = await Order.findById(prescription.order);
      if (order) {
        order.status = 'approved';
        await order.save();
      }
    }

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forward prescription to another pharmacy
 * @route   POST /api/prescriptions/:id/forward
 * @access  Private (Customer)
 */
exports.forwardPrescription = async (req, res, next) => {
  try {
    const { newPharmacy } = req.body;

    const prescription = await Prescription.findOne({
      _id: req.params.id,
      customer: req.user.id
    });

    if (!prescription) {
      return next(ErrorResponse.notFound('Prescription not found'));
    }

    // Check if prescription can be forwarded
    if (!['rejected', 'pending'].includes(prescription.status)) {
      return next(ErrorResponse.badRequest('Prescription cannot be forwarded at this stage'));
    }

    // Forward to new pharmacy
    await prescription.forwardToPharmacy(newPharmacy);

    // Update prescription details
    prescription.pharmacy = newPharmacy;
    prescription.status = 'pending';

    // Add to history
    prescription.history.push({
      action: 'forwarded',
      performedBy: req.user.id,
      notes: `Forwarded to new pharmacy`
    });

    await prescription.save();

    res.status(200).json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Process prescription refill
 * @route   POST /api/prescriptions/:id/refill
 * @access  Private (Customer)
 */
exports.requestRefill = async (req, res, next) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      customer: req.user.id
    });

    if (!prescription) {
      return next(ErrorResponse.notFound('Prescription not found'));
    }

    // Check if prescription is eligible for refill
    if (!prescription.isRecurring || !prescription.checkRefillStatus()) {
      return next(ErrorResponse.badRequest('Prescription is not eligible for refill'));
    }

    // Process refill
    await prescription.processRefill();

    // Create new order for refill
    const order = await Order.create({
      customer: req.user.id,
      pharmacy: prescription.pharmacy,
      prescription: prescription._id,
      status: 'pending_approval'
    });

    // Add to history
    prescription.history.push({
      action: 'refill_requested',
      performedBy: req.user.id,
      notes: `Refill requested`
    });

    await prescription.save();

    res.status(200).json({
      success: true,
      data: {
        prescription,
        order
      }
    });
  } catch (error) {
    next(error);
  }
};