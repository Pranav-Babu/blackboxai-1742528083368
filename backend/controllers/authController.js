const User = require('../models/User');
const Pharmacy = require('../models/Pharmacy');
const ErrorResponse = require('../utils/errorResponse');

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      address,
      // Pharmacy specific fields
      storeName,
      licenseNumber,
      location,
      operatingHours,
      services
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(ErrorResponse.conflict('User already exists with this email'));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
      address
    });

    // If registering as pharmacy, create pharmacy profile
    if (role === 'pharmacy') {
      if (!storeName || !licenseNumber || !location) {
        await user.remove(); // Rollback user creation
        return next(ErrorResponse.badRequest('Pharmacy details are required'));
      }

      // Check if pharmacy license already exists
      const existingPharmacy = await Pharmacy.findOne({ licenseNumber });
      if (existingPharmacy) {
        await user.remove(); // Rollback user creation
        return next(ErrorResponse.conflict('Pharmacy already exists with this license number'));
      }

      // Create pharmacy profile
      await Pharmacy.create({
        user: user._id,
        storeName,
        licenseNumber,
        location,
        address: user.address,
        contactInfo: {
          phone: user.phone,
          email: user.email
        },
        operatingHours,
        services
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    // Update last login
    await user.updateLastLogin();

    res.status(201).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password, deviceToken } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return next(ErrorResponse.badRequest('Please provide email and password'));
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(ErrorResponse.authentication('Invalid credentials'));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(ErrorResponse.authentication('Your account has been deactivated'));
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return next(ErrorResponse.authentication('Invalid credentials'));
    }

    // Add device token if provided
    if (deviceToken) {
      await user.addDeviceToken(deviceToken);
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = user.getSignedJwtToken();

    // Get additional data based on role
    let additionalData = {};
    if (user.role === 'pharmacy') {
      const pharmacy = await Pharmacy.findOne({ user: user._id });
      if (pharmacy) {
        additionalData = {
          pharmacy: {
            id: pharmacy._id,
            storeName: pharmacy.storeName,
            licenseNumber: pharmacy.licenseNumber,
            verificationStatus: pharmacy.verificationStatus
          }
        };
      }
    }

    res.status(200).json({
      success: true,
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        ...additionalData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    const { deviceToken } = req.body;

    // Remove device token if provided
    if (deviceToken) {
      await req.user.removeDeviceToken(deviceToken);
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    let additionalData = {};
    if (user.role === 'pharmacy') {
      const pharmacy = await Pharmacy.findOne({ user: user._id });
      if (pharmacy) {
        additionalData = {
          pharmacy: {
            id: pharmacy._id,
            storeName: pharmacy.storeName,
            licenseNumber: pharmacy.licenseNumber,
            verificationStatus: pharmacy.verificationStatus,
            statistics: pharmacy.statistics
          }
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          lastLogin: user.lastLogin
        },
        ...additionalData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user details
 * @route   PUT /api/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      phone: req.body.phone,
      address: req.body.address
    };

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    // Update pharmacy details if user is a pharmacy
    if (user.role === 'pharmacy' && (req.body.storeName || req.body.operatingHours)) {
      const pharmacyFields = {};
      if (req.body.storeName) pharmacyFields.storeName = req.body.storeName;
      if (req.body.operatingHours) pharmacyFields.operatingHours = req.body.operatingHours;
      if (req.body.address) {
        pharmacyFields['contactInfo.phone'] = req.body.phone;
        pharmacyFields.address = req.body.address;
      }

      await Pharmacy.findOneAndUpdate({ user: user._id }, pharmacyFields, {
        new: true,
        runValidators: true
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(ErrorResponse.authentication('Current password is incorrect'));
    }

    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return next(ErrorResponse.notFound('User not found'));
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with reset token
    // For now, just return the token
    res.status(200).json({
      success: true,
      data: {
        resetToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return next(ErrorResponse.badRequest('Invalid or expired token'));
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      token
    });
  } catch (error) {
    next(error);
  }
};