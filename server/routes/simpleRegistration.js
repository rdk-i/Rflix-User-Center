const express = require('express');
const router = express.Router();
const simpleRegistrationController = require('../controllers/simpleRegistrationController');

// Public registration route
router.post('/register', simpleRegistrationController.register);

// Admin routes for pending registrations
router.get('/pending', simpleRegistrationController.getPendingRegistrations);
router.post('/approve/:userId', simpleRegistrationController.approveRegistration);
router.post('/reject/:userId', simpleRegistrationController.rejectRegistration);

module.exports = router;