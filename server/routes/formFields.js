const express = require('express');
const router = express.Router();
const formFieldController = require('../controllers/formFieldController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// Public: Get fields for registration form
router.get('/', formFieldController.getFields);

// Admin: Manage fields
router.post('/', authenticateToken, requireAdmin, formFieldController.addField);
router.put('/:id', authenticateToken, requireAdmin, formFieldController.updateField);
router.delete('/:id', authenticateToken, requireAdmin, formFieldController.deleteField);

module.exports = router;
