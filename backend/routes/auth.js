const express = require('express');
const router = express.Router();
const { validate, validationRules } = require('../utils/validator');
const {
  register,
  login,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');
const { protect, validateDeviceToken, removeDeviceToken } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', validate(validationRules.user.register), register);
router.post('/login', validate(validationRules.user.login), login);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// Protected routes
router.use(protect); // All routes below this middleware will be protected

router.get('/me', getMe);
router.post('/logout', removeDeviceToken, logout);
router.put('/updatedetails', validate(validationRules.user.updateDetails), updateDetails);
router.put('/updatepassword', validate(validationRules.user.updatePassword), updatePassword);
router.post('/devicetoken', validateDeviceToken);

module.exports = router;