const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// All stats routes require admin access
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/history', statsController.getNowPlayingHistory);

module.exports = router;
