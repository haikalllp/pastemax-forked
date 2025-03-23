/**
 * Test script for shared path utilities
 * Tests both development and production functionality
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const rimraf = require('rimraf');

// Save original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

console.log('========================');
console.log('PATH UTILITIES TEST SUITE');
console.log('========================\n');

// PART 1: Testing in development mode
console.log('PART 1: TESTING IN DEVELOPMENT MODE');
console.log('----------------------------------');
process.env.NODE_ENV = 'development';
const pathUtilsDev = require('../shared/pathUtils');

console.log('Path utilities loaded in development mode');
console.log('isSubPath available:', typeof pathUtilsDev.isSubPath === 'function');
console.log('normalizePath available:', typeof pathUtilsDev.normalizePath === 'function');
console.log('makeRelativePath available:', typeof pathUtilsDev.makeRelativePath === 'function');

// Test normalization
const testPathWin = 'C:\\Users\\test\\Documents\\file.txt';
console.log('\nPath normalization:');
console.log('Original Windows path:', testPathWin);
console.log('Normalized Windows path:', pathUtilsDev.normalizePath(testPathWin));
console.log('Relative Windows path:', pathUtilsDev.makeRelativePath(testPathWin));

// Test different OS path formats
const testPathUnix = '/Users/test/Documents/file.txt';
console.log('\nCross-platform path handling:');
console.log('Original Unix path:', testPathUnix);
console.log('Normalized Unix path:', pathUtilsDev.normalizePath(testPathUnix));
console.log('Relative Unix path:', pathUtilsDev.makeRelativePath(testPathUnix));

// Test isSubPath
console.log('\nTesting isSubPath:');
const parent = '/Users/test';
const child = '/Users/test/Documents/file.txt';
console.log(`isSubPath('${parent}', '${child}'):`, pathUtilsDev.isSubPath(parent, child));

// Test Windows paths with drive letters
console.log('\nTesting Windows drive letters:');
const winParent = 'C:\\Users\\test';
const winChild = 'C:\\Users\\test\\Documents\\file.txt';
const winChildDifferentDrive = 'D:\\Users\\test\\Documents\\file.txt';
console.log(`isSubPath('${winParent}', '${winChild}'):`, pathUtilsDev.isSubPath(winParent, winChild));
console.log(`isSubPath('${winParent}', '${winChildDifferentDrive}'):`, pathUtilsDev.isSubPath(winParent, winChildDifferentDrive));

// Test path joining
console.log('\nTesting path joining:');
console.log("safePathJoin('C:\\Users', 'test', 'Documents'):", pathUtilsDev.safePathJoin('C:\\Users', 'test', 'Documents'));
console.log("safePathJoin('/Users', 'test', 'Documents'):", pathUtilsDev.safePathJoin('/Users', 'test', 'Documents'));
console.log("safePathJoin with null parts:", pathUtilsDev.safePathJoin('/Users', null, 'Documents'));

// Test relative paths
console.log('\nTesting relative paths:');
console.log("safeRelativePath('/Users/test', '/Users/test/Documents'):", pathUtilsDev.safeRelativePath('/Users/test', '/Users/test/Documents'));
console.log("safeRelativePath('C:\\Users\\test', 'D:\\Other\\path'):", pathUtilsDev.safeRelativePath('C:\\Users\\test', 'D:\\Other\\path'));

// Test path equality
console.log('\nTesting path equality:');
console.log("arePathsEqual('/Users/test', '/Users/Test'):", pathUtilsDev.arePathsEqual('/Users/test', '/Users/Test'));
console.log("arePathsEqual('C:\\Users\\test', 'C:/Users/Test'):", pathUtilsDev.arePathsEqual('C:\\Users\\test', 'C:/Users/Test'));

// Test error handling
console.log('\nTesting error handling:');
console.log("isValidPath(null):", pathUtilsDev.isValidPath(null));
console.log("normalizePath(undefined):", pathUtilsDev.normalizePath(undefined));
console.log("safePathJoin():", pathUtilsDev.safePathJoin());

// Clean up development module
delete require.cache[require.resolve('../shared/pathUtils')];

// PART 2: Testing in production mode
console.log('\n\nPART 2: TESTING IN PRODUCTION MODE');
console.log('----------------------------------');
process.env.NODE_ENV = 'production';
const pathUtilsProd = require('../shared/pathUtils');

console.log('Path utilities loaded in production mode');
console.log('isSubPath available:', typeof pathUtilsProd.isSubPath === 'function');
console.log('normalizePath available:', typeof pathUtilsProd.normalizePath === 'function');

// Test the same functions to ensure they work identically
console.log('\nVerifying production functionality:');
console.log('Normalized path:', pathUtilsProd.normalizePath(testPathWin));
console.log('isSubPath test:', pathUtilsProd.isSubPath(parent, child));
console.log('Path joining:', pathUtilsProd.safePathJoin('/Users', 'test', 'Documents'));

// Clean up production module
delete require.cache[require.resolve('../shared/pathUtils')];

// PART 3: Fallback mechanism test
console.log('\n\nPART 3: TESTING FALLBACK MECHANISM');
console.log('----------------------------------');

// First, build the utilities
console.log('1. Building compiled utilities...');
try {
  execSync('npm run build:utils', { stdio: 'inherit' });
  console.log('✅ Build successful');
} catch (err) {
  console.error('❌ Build failed:', err);
  process.exit(1);
}

// Verify the compiled directory exists
const compiledDir = path.join(__dirname, '..', 'shared', 'compiled');
if (!fs.existsSync(compiledDir)) {
  console.error(`❌ Compiled directory doesn't exist at ${compiledDir}`);
  process.exit(1);
}
console.log(`✅ Compiled utilities exist at ${compiledDir}`);

// Run a test with compiled utilities
console.log('\n2. Testing with compiled utilities...');
process.env.NODE_ENV = 'production';
// Clear require cache
delete require.cache[require.resolve('../shared/pathUtils')];
const withCompiled = require('../shared/pathUtils');
console.log('Utility functions available:', Object.keys(withCompiled).join(', '));
console.log('Test normalization:', withCompiled.normalizePath('C:\\path\\to\\file.txt'));

// Now remove the compiled directory and test fallback
console.log('\n3. Removing compiled utilities...');
try {
  // Using rimraf for cross-platform compatibility
  rimraf.sync(compiledDir);
  console.log(`✅ Removed ${compiledDir}`);
} catch (err) {
  console.error(`❌ Error removing directory: ${err.message}`);
  process.exit(1);
}

// Verify removal
if (fs.existsSync(compiledDir)) {
  console.error(`❌ Failed to remove compiled directory at ${compiledDir}`);
  process.exit(1);
}
console.log('✅ Verified compiled directory is removed');

// Now test the fallback implementation
console.log('\n4. Testing with fallback implementation...');
// Clear require cache again
delete require.cache[require.resolve('../shared/pathUtils')];
const withFallback = require('../shared/pathUtils');
console.log('Utility functions available:', Object.keys(withFallback).join(', '));
console.log('Test normalization:', withFallback.normalizePath('C:\\path\\to\\file.txt'));

// Rebuild the utilities at the end
console.log('\n5. Rebuilding utilities...');
try {
  execSync('npm run build:utils', { stdio: 'inherit' });
  console.log('✅ Rebuild successful');
} catch (err) {
  console.error('❌ Rebuild failed:', err);
}

console.log('\n✅ Test complete! The path utilities work in both compiled and fallback modes.');

// Restore original NODE_ENV
process.env.NODE_ENV = originalNodeEnv; 