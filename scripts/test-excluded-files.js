/**
 * Simple test for excluded-files.js
 */

const excludedFiles = require('../excluded-files');

console.log('Testing excluded-files.js exports:');
console.log('--------------------------------');

// Check exports
console.log('1. Available exports:');
for (const key in excludedFiles) {
  const value = excludedFiles[key];
  let description = '';
  
  if (Array.isArray(value)) {
    description = `Array with ${value.length} items`;
  } else if (typeof value === 'object') {
    description = `Object with ${Object.keys(value).length} keys`;
  } else {
    description = `${typeof value}`;
  }
  
  console.log(`   - ${key}: ${description}`);
}

// Sample values
console.log('\n2. Sample values:');

// excludedFiles (first 5)
console.log('\n   excludedFiles (first 5):');
for (let i = 0; i < 5 && i < excludedFiles.excludedFiles.length; i++) {
  console.log(`   - ${excludedFiles.excludedFiles[i]}`);
}

// skipDirectories (first 5)
console.log('\n   skipDirectories (first 5):');
for (let i = 0; i < 5 && i < excludedFiles.skipDirectories.length; i++) {
  console.log(`   - ${excludedFiles.skipDirectories[i]}`);
}

// binaryExtensions (first 5)
console.log('\n   binaryExtensions (first 5):');
for (let i = 0; i < 5 && i < excludedFiles.binaryExtensions.length; i++) {
  console.log(`   - ${excludedFiles.binaryExtensions[i]}`);
}

// Check reference equality
console.log('\n3. Reference checks:');
console.log(`   - defaultIgnorePatterns === excludedFiles: ${excludedFiles.defaultIgnorePatterns === excludedFiles.excludedFiles}`);

console.log('\nTest completed successfully.'); 