const Prescription = require('../models/Prescription');
const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const ErrorResponse = require('../utils/errorResponse');
const fileHandler = require('../utils/fileHandler');

/**
 * @desc    Upload prescription
 * @route   POST /api/prescriptions/upload
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

    // Handle file upload
    if (!req.files || !req.files.images) {
      return next(ErrorResponse.badRequest('Please upload prescription images'));
    }

    // Upload images
    const uploadedImages = await Promise.all(
      req.files.images.map(async (file) => {
        const uploadedFile = await fileHandler.uploadFile(file, 'prescriptions');
        return {
          url: uploadedFile.url,
          uploadedAt: new Date()
        };
      })
    );

    // Create prescription record
    const prescription = await Prescription.create({
      customer: req.user.id,
      pharmacy,
      images: uploadedImages,
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
      // Check medicine availability and suggest alternatives if needed
      const processedMedicines = await Promise.all(medicines.map(async (med) => {
        const medicine = await Medicine.findOne({
          name: { $regex: new RegExp(`^${med.name}$`, 'i') },
          pharmacy: req.pharmacy._id
        });

        if (medicine && medicine.stock >= (med.quantity || 1)) {
          return {
            ...med,
            status: 'approved',
            medicine: medicine._id
          };
        } else {
          // Find alternative medicine
          const alternative = await Medicine.findOne({
            genericName: medicine?.genericName,
            pharmacy: req.pharmacy._id,
            stock: { $gte: med.quantity || 1 }
          });

          return {
            ...med,
            status: alternative ? 'alternative_suggested' : 'unavailable',
            alternative: alternative ? {
              medicine: alternative._id,
              reason: 'Original medicine out of stock, suggesting alternative with same composition'
            } : undefined
          };
        }
      }));

      prescription.medicines = processedMedicines;
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
 * @desc    Get prescription medicines
 * @route   GET /api/prescriptions/:id/medicines
 * @access  Private
 */
exports.getPrescriptionMedicines = async (req, res, next) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('medicines.medicine', 'name manufacturer price stock')
      .populate('medicines.alternative.medicine', 'name manufacturer price stock');

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
      data: prescription.medicines
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Request prescription refill
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
      notes: 'Refill requested'
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

module.exports = exports;