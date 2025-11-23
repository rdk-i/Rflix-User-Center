const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { registrationLimiter } = require('../middlewares/rateLimiter');
const auditLogger = require('../middlewares/auditLogger');

// Public registration endpoint
router.post('/', registrationLimiter, registrationController.register);

// Admin endpoints for managing registrations
router.get(
  '/pending',
  authenticateToken,
  requireAdmin,
  registrationController.getPendingRegistrations
);

router.post(
  '/:userId/approve',
  authenticateToken,
  requireAdmin,
  auditLogger('APPROVE_REGISTRATION'),
  registrationController.approveRegistration
);

router.post(
  '/:userId/reject',
  authenticateToken,
  requireAdmin,
  auditLogger('REJECT_REGISTRATION'),
  registrationController.rejectRegistration
);

module.exports = router;
