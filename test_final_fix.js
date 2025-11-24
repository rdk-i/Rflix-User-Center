// Final test to verify the exact fix
const fs = require('fs');
const path = require('path');

console.log('Testing final fix for usageLimits middleware...');

try {
  const middlewarePath = path.join(__dirname, 'server/middlewares/usageLimits.js');
  const content = fs.readFileSync(middlewarePath, 'utf8');
  
  // Look for the specific problematic pattern
  const hasMalformedLine = content.includes('  usageLimitsMiddleware\n');
  const hasProperClosing = content.match(/}\s*;\s*$/);
  
  console.log('Detailed Analysis:');
  console.log(`✗ Has malformed "usageLimitsMiddleware" line: ${hasMalformedLine}`);
  console.log(`✓ Has proper module closing: ${!!hasProperClosing}`);
  
  // Check the exact last few lines
  const lines = content.split('\n');
  const lastLines = lines.slice(-5);
  
  console.log('\nLast 5 lines of the file:');
  lastLines.forEach((line, i) => {
    console.log(`${lines.length - 5 + i + 1}: ${line}`);
  });
  
  // Check if the problematic line is still there
  const problematicLineIndex = lines.findIndex(line => line.trim() === 'usageLimitsMiddleware');
  if (problematicLineIndex !== -1) {
    console.log(`\n❌ Found problematic line at line ${problematicLineIndex + 1}: "${lines[problematicLineIndex]}"`);
  } else {
    console.log('\n✅ SUCCESS: The problematic "usageLimitsMiddleware" line has been removed!');
  }
  
  // Test if we can parse it as valid JavaScript
  try {
    // Create a minimal test that doesn't require database
    const testContent = content
      .replace("const db = require('../config/database');", "const db = { prepare: () => ({ get: () => ({}), run: () => ({}) }) };")
      .replace("const logger = require('../utils/logger');", "const logger = { error: () => {}, info: () => {} };")
      .replace("const notificationService = require('../services/notificationService');", "const notificationService = {};")
      .replace(/notificationService\.\w+/g, '() => Promise.resolve()');
    
    // Test if it's syntactically valid
    new Function(testContent);
    console.log('✅ JavaScript syntax is valid!');
  } catch (syntaxError) {
    console.log('❌ JavaScript syntax error:', syntaxError.message);
  }
  
} catch (error) {
  console.error('✗ Test failed:', error.message);
}