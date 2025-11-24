const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const auditLogger = require('../middlewares/auditLogger');

// Public routes (for registration form)
router.get('/packages', packageController.getAllPackages);
router.get('/packages/:id', packageController.getPackageById);

// Admin routes
router.post('/packages', authenticateToken, requireAdmin, auditLogger('CREATE_PACKAGE'), packageController.createPackage);
router.put('/packages/:id', authenticateToken, requireAdmin, auditLogger('UPDATE_PACKAGE'), packageController.updatePackage);
router.delete('/packages/:id', authenticateToken, requireAdmin, auditLogger('DELETE_PACKAGE'), packageController.deletePackage);

module.exports = router;
