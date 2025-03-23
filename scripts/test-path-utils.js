/**
 * Test script for shared path utilities
 * This script tests the shared path utilities across different platforms
 */

const { 
  normalizePath, 
  makeRelativePath, 
  basename, 
  dirname, 
  join, 
  extname, 
  arePathsEqual, 
  isSubPath,
  safePathJoin,
  safeRelativePath,
  ensureAbsolutePath,
  isValidPath,
  getPathSeparator,
  isWindows,
  isNode
} = require('../shared/path-utils');

// Test helper function
function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    console.error(`FAILED: ${message}`);
    console.error(`  Expected: "${expected}"`);
    console.error(`  Actual:   "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`PASSED: ${message}`);
  }
}

console.log('---- Testing shared path utilities ----');
console.log(`Running in Node.js: ${isNode}`);
console.log(`Detected Windows environment: ${isWindows}`);
console.log(`Path separator: "${getPathSeparator()}"`);

// Test normalizePath
console.log('\nTesting normalizePath:');
assertEquals(normalizePath('C:\\Users\\test\\file.txt'), 'C:/Users/test/file.txt', 'Windows path normalization');
assertEquals(normalizePath('/usr/local/bin'), '/usr/local/bin', 'Unix path normalization');
assertEquals(normalizePath(''), '', 'Empty path normalization');
assertEquals(normalizePath(null), null, 'Null path normalization');
assertEquals(normalizePath(undefined), undefined, 'Undefined path normalization');

// Test makeRelativePath
console.log('\nTesting makeRelativePath:');
assertEquals(makeRelativePath('C:/Users/test/file.txt'), 'Users/test/file.txt', 'Windows path to relative');
assertEquals(makeRelativePath('/usr/local/bin'), 'usr/local/bin', 'Unix path to relative');
assertEquals(makeRelativePath('file.txt'), 'file.txt', 'Already relative path');
assertEquals(makeRelativePath(''), '', 'Empty path to relative');

// Test basename
console.log('\nTesting basename:');
assertEquals(basename('C:/Users/test/file.txt'), 'file.txt', 'Windows path basename');
assertEquals(basename('/usr/local/bin'), 'bin', 'Unix path basename');
assertEquals(basename('file.txt'), 'file.txt', 'Filename basename');
assertEquals(basename('/'), '', 'Root path basename');
assertEquals(basename(''), '', 'Empty path basename');

// Test dirname
console.log('\nTesting dirname:');
assertEquals(dirname('C:/Users/test/file.txt'), 'C:/Users/test', 'Windows path dirname');
assertEquals(dirname('/usr/local/bin'), '/usr/local', 'Unix path dirname');
assertEquals(dirname('file.txt'), '.', 'Filename dirname');
assertEquals(dirname(''), '.', 'Empty path dirname');

// Test join
console.log('\nTesting join:');
assertEquals(join('usr', 'local', 'bin'), 'usr/local/bin', 'Join multiple segments');
assertEquals(join('/usr', 'local', 'bin'), '/usr/local/bin', 'Join with leading slash');
assertEquals(join('usr', '/local/', '/bin'), 'usr/local/bin', 'Join with mixed slashes');
assertEquals(join('', 'local', 'bin'), 'local/bin', 'Join with empty segment');
assertEquals(join(null, 'local', undefined, 'bin'), 'local/bin', 'Join with null/undefined segments');

// Test extname
console.log('\nTesting extname:');
assertEquals(extname('file.txt'), '.txt', 'Simple extension');
assertEquals(extname('file'), '', 'No extension');
assertEquals(extname('.gitignore'), '', 'Dot file');
assertEquals(extname('file.min.js'), '.js', 'Multiple dots');
assertEquals(extname(''), '', 'Empty path extension');

// Test arePathsEqual
console.log('\nTesting arePathsEqual:');
assertEquals(arePathsEqual('C:\\Users\\test\\file.txt', 'C:/Users/test/file.txt'), true, 'Same Windows paths with different separators');
assertEquals(arePathsEqual('/usr/local/bin', '/usr/local/bin'), true, 'Same Unix paths');
assertEquals(arePathsEqual('/usr/local/bin', '/usr/local/bin/'), true, 'Unix paths with trailing slash');
assertEquals(arePathsEqual('file.txt', 'FILE.TXT'), isWindows, 'Case sensitivity depends on platform');

// Test isSubPath
console.log('\nTesting isSubPath:');
assertEquals(isSubPath('C:/Users', 'C:/Users/test/file.txt'), true, 'Windows parent and child path');
assertEquals(isSubPath('/usr/local', '/usr/local/bin'), true, 'Unix parent and child path');
assertEquals(isSubPath('/usr/local', '/usr/localnot/bin'), false, 'Not a subpath');
assertEquals(isSubPath('/usr/local/', '/usr/local'), true, 'Parent with trailing slash');

// Test safePathJoin
console.log('\nTesting safePathJoin:');
assertEquals(safePathJoin('C:', 'Users', 'test'), 'C:/Users/test', 'Windows path join');
assertEquals(safePathJoin('/usr', 'local', 'bin'), '/usr/local/bin', 'Unix path join');

// Test safeRelativePath
console.log('\nTesting safeRelativePath:');
assertEquals(
  safeRelativePath('/home/user/project', '/home/user/project/src/file.js'),
  'src/file.js',
  'Simple relative path'
);

// Test ensureAbsolutePath
console.log('\nTesting ensureAbsolutePath:');
// This test depends on the current working directory, so we won't test for exact equality
const absPath = ensureAbsolutePath('file.txt');
console.log(`  ensureAbsolutePath('file.txt') → ${absPath}`);
assertEquals(absPath.includes('file.txt'), true, 'Absolute path includes the filename');

// Test isValidPath
console.log('\nTesting isValidPath:');
assertEquals(isValidPath('C:/Users/test/file.txt'), true, 'Valid Windows path');
assertEquals(isValidPath('/usr/local/bin'), true, 'Valid Unix path');
assertEquals(isValidPath('file.txt'), true, 'Valid relative path');
assertEquals(isValidPath(''), false, 'Empty path validity');

console.log('\n---- All tests completed ----');
if (process.exitCode) {
  console.error(`❌ FAILED: Some tests failed!`);
} else {
  console.log(`✅ SUCCESS: All tests passed!`);
} 