const express = require('express');
const router = express.Router();
const simplePackageController = require('../controllers/simplePackageController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const auditLogger = require('../middlewares/auditLogger');

// Public routes (for registration form)
router.get('/packages', simplePackageController.getAllPackages);
router.get('/packages/:id', simplePackageController.getPackageById);

// Admin routes
router.post('/packages', authenticateToken, requireAdmin, auditLogger('CREATE_PACKAGE'), simplePackageController.createPackage);
router.put('/packages/:id', authenticateToken, requireAdmin, auditLogger('UPDATE_PACKAGE'), simplePackageController.updatePackage);
router.patch('/packages/:id/toggle', authenticateToken, requireAdmin, auditLogger('TOGGLE_PACKAGE_STATUS'), simplePackageController.togglePackageStatus);
router.delete('/packages/:id', authenticateToken, requireAdmin, auditLogger('DELETE_PACKAGE'), simplePackageController.deletePackage);

module.exports = router;