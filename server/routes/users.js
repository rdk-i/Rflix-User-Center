const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/auth');

// All user routes require authentication
router.use(authenticateToken);

// User profile
router.get('/me', userController.getCurrentUser);

// Notification preferences
router.put('/notifications', userController.updateNotificationPreferences);

// Change password
router.post('/change-password', userController.changePassword);

module.exports = router;
