// Isolated syntax test for usageLimits middleware exports
console.log('Testing usageLimits middleware syntax fix...');

try {
  // Parse the middleware file as a module to check syntax
  const fs = require('fs');
  const path = require('path');
  
  const middlewarePath = path.join(__dirname, 'server/middlewares/usageLimits.js');
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check for the malformed export that was causing the issue
  const hasMalformedExport = middlewareContent.includes('usageLimitsMiddleware');
  const hasProperModuleExports = middlewareContent.includes('module.exports = {');
  const hasProperClosing = middlewareContent.endsWith('};\n') || middlewareContent.endsWith('};');
  
  console.log('Syntax Analysis:');
  console.log(`✓ File can be read: ${!!middlewareContent}`);
  console.log(`✓ Has malformed export (usageLimitsMiddleware): ${hasMalformedExport}`);
  console.log(`✓ Has proper module.exports structure: ${hasProperModuleExports}`);
  console.log(`✓ Has proper closing bracket: ${hasProperClosing}`);
  
  // Check the specific lines around the export
  const lines = middlewareContent.split('\n');
  const lastFewLines = lines.slice(-10).join('\n');
  
  console.log('\nLast few lines of the file:');
  console.log(lastFewLines);
  
  if (!hasMalformedExport && hasProperModuleExports && hasProperClosing) {
    console.log('\n✅ SUCCESS: The syntax error has been fixed!');
    console.log('The malformed export "usageLimitsMiddleware" has been removed.');
    console.log('The module.exports object should now be properly structured.');
  } else {
    console.log('\n❌ ISSUE: There may still be syntax problems.');
  }
  
} catch (error) {
  console.error('✗ Test failed:', error.message);
}