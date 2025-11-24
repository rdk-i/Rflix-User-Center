const express = require('express');
const router = express.Router();

// Placeholder
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: { message: 'Notification routes placeholder' },
  });
});

module.exports = router;
