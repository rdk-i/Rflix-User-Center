const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

// Public config routes (no authentication required)
router.get('/captcha-provider', configController.getCaptchaProvider);
router.get('/captcha-sitekey', configController.getCaptchaSiteKey);

module.exports = router;
