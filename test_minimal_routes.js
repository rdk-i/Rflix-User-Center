console.log('Testing minimal routes file...\n');

const express = require('express');
const router = express.Router();

// Absolute minimum - just one simple route
router.get('/test', (req, res) => {
  res.json({ success: true });
});

console.log('✓ Minimal routes file created successfully');
console.log('Router type:', typeof router);
console.log('Router has get method:', typeof router.get);

// Test exporting
module.exports = router;
console.log('✓ Router exported successfully');