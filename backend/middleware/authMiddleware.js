const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      // Check if user still exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User no longer exists'
        });
      }

      // Check if user is active
      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User account is deactivated'
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Verify pharmacy registration
exports.verifyPharmacy = async (req, res, next) => {
  try {
    if (req.user.role !== 'pharmacy') {
      return res.status(403).json({
        success: false,
        error: 'Only registered pharmacies can access this route'
      });
    }

    const pharmacy = await Pharmacy.findOne({ user: req.user._id });

    if (!pharmacy) {
      return res.status(403).json({
        success: false,
        error: 'Pharmacy profile not found'
      });
    }

    if (pharmacy.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Pharmacy is not verified yet'
      });
    }

    if (pharmacy.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Pharmacy account is not active'
      });
    }

    req.pharmacy = pharmacy;
    next();
  } catch (error) {
    next(error);
  }
};

// Track last activity
exports.trackActivity = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.lastLogin = new Date();
      await req.user.save({ validateBeforeSave: false });
    }
    next();
  } catch (error) {
    next(error);
  }
};

// Rate limiting middleware
exports.rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};

// Validate device token
exports.validateDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        error: 'Device token is required'
      });
    }

    // Add device token to user's tokens if not already present
    if (!req.user.deviceTokens.includes(deviceToken)) {
      req.user.deviceTokens.push(deviceToken);
      await req.user.save({ validateBeforeSave: false });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Remove device token on logout
exports.removeDeviceToken = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;

    if (deviceToken && req.user) {
      req.user.deviceTokens = req.user.deviceTokens.filter(token => token !== deviceToken);
      await req.user.save({ validateBeforeSave: false });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Error handler middleware
exports.errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({
      success: false,
      error: messages
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: 'Duplicate field value entered'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Server Error'
  });
};