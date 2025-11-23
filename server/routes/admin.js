const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin, authorize } = require('../middlewares/auth');
const { adminLimiter } = require('../middlewares/rateLimiter');
const auditLogger = require('../middlewares/auditLogger');

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);
router.use(adminLimiter);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserById);
router.post('/users', auditLogger('CREATE_USER'), adminController.createUser);
router.post('/users/:userId/disable', auditLogger('DISABLE_USER'), adminController.disableUser);
router.post('/users/:userId/enable', auditLogger('ENABLE_USER'), adminController.enableUser);
router.delete('/users/:userId', auditLogger('DELETE_USER'), adminController.deleteUser);
router.post('/users/:userId/extend', auditLogger('EXTEND_SUBSCRIPTION'), adminController.extendSubscription);

// Audit logs
router.get('/logs', authorize(['VIEW_AUDIT']), adminController.getAuditLogs);

module.exports = router;
