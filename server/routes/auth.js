const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { loginLimiter } = require('../middlewares/rateLimiter');

// Login route with rate limiting
router.post('/login', loginLimiter, authController.login);

// Refresh token route
router.post('/refresh', authController.refresh);

// Logout route
router.post('/logout', authController.logout);

module.exports = router;
