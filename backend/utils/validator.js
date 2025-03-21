const { body, param, query, validationResult } = require('express-validator');
const ErrorResponse = require('./errorResponse');

/**
 * Validation rules for different entities and operations
 */
const validationRules = {
  // User validation rules
  user: {
    register: [
      body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please enter a valid email')
        .normalizeEmail(),
      body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'),
      body('role')
        .trim()
        .notEmpty()
        .withMessage('Role is required')
        .isIn(['customer', 'pharmacy'])
        .withMessage('Invalid role specified'),
      body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required')
        .matches(/^[0-9]{10}$/)
        .withMessage('Please enter a valid 10-digit phone number')
    ],
    login: [
      body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please enter a valid email'),
      body('password')
        .trim()
        .notEmpty()
        .withMessage('Password is required')
    ]
  },

  // Pharmacy validation rules
  pharmacy: {
    register: [
      body('storeName')
        .trim()
        .notEmpty()
        .withMessage('Store name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Store name must be between 3 and 100 characters'),
      body('licenseNumber')
        .trim()
        .notEmpty()
        .withMessage('License number is required')
        .matches(/^[A-Z0-9-]+$/)
        .withMessage('Please enter a valid license number'),
      body('location.coordinates')
        .isArray()
        .withMessage('Location coordinates must be an array')
        .custom((value) => {
          if (!Array.isArray(value) || value.length !== 2) {
            throw new Error('Location must contain latitude and longitude');
          }
          const [longitude, latitude] = value;
          if (longitude < -180 || longitude > 180) {
            throw new Error('Invalid longitude');
          }
          if (latitude < -90 || latitude > 90) {
            throw new Error('Invalid latitude');
          }
          return true;
        }),
      body('address.street').trim().notEmpty().withMessage('Street address is required'),
      body('address.city').trim().notEmpty().withMessage('City is required'),
      body('address.state').trim().notEmpty().withMessage('State is required'),
      body('address.zipCode')
        .trim()
        .notEmpty()
        .withMessage('Zip code is required')
        .matches(/^[0-9]{6}$/)
        .withMessage('Please enter a valid 6-digit zip code')
    ]
  },

  // Medicine validation rules
  medicine: {
    create: [
      body('name')
        .trim()
        .notEmpty()
        .withMessage('Medicine name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
      body('category')
        .trim()
        .notEmpty()
        .withMessage('Category is required')
        .isIn(['prescription', 'non-prescription', 'daily-needs'])
        .withMessage('Invalid category'),
      body('manufacturer')
        .trim()
        .notEmpty()
        .withMessage('Manufacturer name is required'),
      body('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
      body('stock')
        .isInt({ min: 0 })
        .withMessage('Stock must be a positive integer'),
      body('expiryDate')
        .isISO8601()
        .withMessage('Please enter a valid date')
        .custom((value) => {
          if (new Date(value) <= new Date()) {
            throw new Error('Expiry date must be in the future');
          }
          return true;
        })
    ],
    update: [
      param('id').isMongoId().withMessage('Invalid medicine ID'),
      body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
      body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Stock must be a positive integer')
    ]
  },

  // Order validation rules
  order: {
    create: [
      body('items')
        .isArray()
        .withMessage('Items must be an array')
        .notEmpty()
        .withMessage('Order must contain at least one item'),
      body('items.*.medicine')
        .isMongoId()
        .withMessage('Invalid medicine ID'),
      body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
      body('deliverySlot.date')
        .isISO8601()
        .withMessage('Please enter a valid delivery date')
        .custom((value) => {
          if (new Date(value) < new Date()) {
            throw new Error('Delivery date must be in the future');
          }
          return true;
        }),
      body('deliverySlot.time')
        .isIn(['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'])
        .withMessage('Invalid delivery time slot')
    ]
  },

  // Prescription validation rules
  prescription: {
    upload: [
      body('doctorDetails.name')
        .trim()
        .notEmpty()
        .withMessage('Doctor name is required'),
      body('patientDetails.name')
        .trim()
        .notEmpty()
        .withMessage('Patient name is required'),
      body('validity')
        .isISO8601()
        .withMessage('Please enter a valid prescription validity date')
        .custom((value) => {
          if (new Date(value) <= new Date()) {
            throw new Error('Validity date must be in the future');
          }
          return true;
        })
    ]
  },

  // Search and filter validation rules
  search: {
    medicines: [
      query('category')
        .optional()
        .isIn(['prescription', 'non-prescription', 'daily-needs'])
        .withMessage('Invalid category'),
      query('minPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum price must be a positive number'),
      query('maxPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum price must be a positive number'),
      query('sort')
        .optional()
        .isIn(['price', '-price', 'name', '-name'])
        .withMessage('Invalid sort parameter')
    ]
  }
};

/**
 * Middleware to validate request data
 * @param {Array} validations - Array of validation rules
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format errors for response
      const formattedErrors = errors.array().reduce((acc, error) => {
        if (!acc[error.param]) {
          acc[error.param] = [];
        }
        acc[error.param].push(error.msg);
        return acc;
      }, {});

      return next(ErrorResponse.validation('Validation failed', formattedErrors));
    }

    next();
  };
};

module.exports = {
  validationRules,
  validate
};