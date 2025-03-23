#!/usr/bin/env node

/**
 * Test script for path utilities
 * 
 * This script tests the path utilities in both compiled and fallback modes.
 * It verifies that all utilities function correctly across platforms.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Utility function to log test messages
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function successLog(message) {
  log(`✅ ${message}`, colors.green);
}

function errorLog(message) {
  log(`❌ ${message}`, colors.red);
}

function infoLog(message) {
  log(`ℹ️ ${message}`, colors.blue);
}

function warningLog(message) {
  log(`⚠️ ${message}`, colors.yellow);
}

// Get the root directory of the project
const rootDir = path.resolve(__dirname, '..');
const compiledDir = path.join(rootDir, 'shared', 'compiled');
const compiledPathUtils = path.join(compiledDir, 'pathUtils.js');
const adapterPathUtils = path.join(rootDir, 'shared', 'pathUtils.js');

// Test cases
const testPaths = {
  windows: [
    'C:\\Users\\username\\Documents\\file.txt',
    'C:/Users/username/Documents/file.txt',
    '\\\\server\\share\\file.txt',
    'relative\\path\\file.txt',
    './relative/path/file.txt',
    '../parent/path/file.txt',
    'C:\\Users\\username\\..\\username\\Documents\\file.txt'
  ],
  posix: [
    '/Users/username/Documents/file.txt',
    './relative/path/file.txt',
    '../parent/path/file.txt',
    '/Users/username/../username/Documents/file.txt'
  ]
};

// Test paths for comparison functions
const pathPairs = [
  {
    parent: 'C:\\Users\\username',
    child: 'C:\\Users\\username\\Documents\\file.txt',
    isSubPath: true
  },
  {
    parent: '/Users/username',
    child: '/Users/username/Documents/file.txt',
    isSubPath: true
  },
  {
    parent: 'C:\\Users\\username',
    child: 'D:\\Users\\username\\Documents\\file.txt',
    isSubPath: false
  },
  {
    parent: '/Users/username',
    child: '/var/username/Documents/file.txt',
    isSubPath: false
  }
];

// Test phases
async function runTests() {
  log('\n🔍 PATH UTILITIES TEST SUITE', colors.blue);
  log('================================\n');

  // Phase 1: Test compiled path utilities
  await testCompiledPathUtils();

  // Phase 2: Test adapter with compiled utils
  await testAdapterWithCompiled();

  // Phase 3: Test adapter fallback without compiled utils
  await testAdapterFallback();

  // Final report
  log('\n================================');
  log('🎉 ALL TESTS COMPLETED', colors.green);
}

async function testCompiledPathUtils() {
  log('\n📦 PHASE 1: Testing Compiled Path Utilities\n', colors.blue);

  // Ensure compiled path utilities exist
  try {
    // Build path utilities if they don't exist
    if (!fs.existsSync(compiledPathUtils)) {
      infoLog('Compiled path utilities not found. Building now...');
      execSync('npm run build:utils', { stdio: 'inherit', cwd: rootDir });
      
      if (fs.existsSync(compiledPathUtils)) {
        successLog('Successfully built path utilities');
      } else {
        errorLog('Failed to build path utilities');
        return false;
      }
    } else {
      successLog('Compiled path utilities found at ' + compiledPathUtils);
    }

    // Import compiled path utilities
    const pathUtils = require(compiledPathUtils);
    
    // Test all functions
    testPathUtilsFunctionality(pathUtils, 'Compiled');
    
    return true;
  } catch (error) {
    errorLog(`Error testing compiled path utilities: ${error.message}`);
    return false;
  }
}

async function testAdapterWithCompiled() {
  log('\n🔌 PHASE 2: Testing Adapter with Compiled Utils\n', colors.blue);

  try {
    // Ensure adapter exists
    if (!fs.existsSync(adapterPathUtils)) {
      errorLog('Adapter path utilities not found at ' + adapterPathUtils);
      return false;
    }
    
    // Clear require cache to ensure fresh import
    delete require.cache[require.resolve(adapterPathUtils)];
    
    // Import adapter
    const pathUtils = require(adapterPathUtils);
    
    // Test all functions
    testPathUtilsFunctionality(pathUtils, 'Adapter with compiled');
    
    return true;
  } catch (error) {
    errorLog(`Error testing adapter with compiled utils: ${error.message}`);
    return false;
  }
}

async function testAdapterFallback() {
  log('\n🔄 PHASE 3: Testing Adapter Fallback (without compiled utils)\n', colors.blue);

  try {
    // Rename or temporarily remove compiled directory
    const tempDir = path.join(rootDir, 'shared', 'compiled.temp');
    
    if (fs.existsSync(compiledDir)) {
      fs.renameSync(compiledDir, tempDir);
      successLog('Temporarily moved compiled directory for fallback testing');
    } else {
      warningLog('Compiled directory already removed, proceeding with fallback test');
    }
    
    // Clear require cache to ensure fresh import
    delete require.cache[require.resolve(adapterPathUtils)];
    
    // Import adapter, should use fallback
    const pathUtils = require(adapterPathUtils);
    
    // Test all functions
    testPathUtilsFunctionality(pathUtils, 'Adapter fallback');
    
    // Restore compiled directory
    if (fs.existsSync(tempDir)) {
      fs.renameSync(tempDir, compiledDir);
      successLog('Restored compiled directory');
    }
    
    return true;
  } catch (error) {
    errorLog(`Error testing adapter fallback: ${error.message}`);
    
    // Try to restore compiled directory in case of error
    const tempDir = path.join(rootDir, 'shared', 'compiled.temp');
    if (fs.existsSync(tempDir)) {
      fs.renameSync(tempDir, compiledDir);
      warningLog('Restored compiled directory after error');
    }
    
    return false;
  }
}

function testPathUtilsFunctionality(pathUtils, testPhase) {
  // Check if all expected functions exist
  const expectedFunctions = [
    'normalizePath',
    'makeRelativePath',
    'isWindows',
    'getPathSeparator',
    'ensureAbsolutePath',
    'safePathJoin',
    'safeRelativePath',
    'arePathsEqual',
    'isValidPath',
    'isSubPath',
    'basename',
    'dirname',
    'extname',
    'join'
  ];
  
  infoLog(`${testPhase} path utilities functions available:`);
  expectedFunctions.forEach(fn => {
    if (typeof pathUtils[fn] === 'function') {
      successLog(`- ${fn}`);
    } else {
      errorLog(`- ${fn} (missing or not a function)`);
    }
  });
  
  // Test normalizePath
  log('\nTesting normalizePath:', colors.blue);
  testPaths.windows.forEach(testPath => {
    const normalized = pathUtils.normalizePath(testPath);
    log(`  ${testPath} → ${normalized}`);
    
    // Check that all backslashes are converted to forward slashes (except for UNC prefix)
    const isUNC = testPath.startsWith('\\\\');
    const expectedPrefix = isUNC ? '\\\\' : '';
    
    const normalizedWithoutPrefix = isUNC ? normalized.substring(2) : normalized;
    const hasNoBackslashes = !normalizedWithoutPrefix.includes('\\');
    
    if (isUNC && normalized.startsWith('\\\\') && hasNoBackslashes) {
      successLog(`  ✓ UNC path correctly preserved and normalized`);
    } else if (!isUNC && hasNoBackslashes) {
      successLog(`  ✓ Path correctly normalized`);
    } else {
      errorLog(`  ✗ Path not correctly normalized`);
    }
  });
  
  // Test makeRelativePath
  log('\nTesting makeRelativePath:', colors.blue);
  testPaths.windows.concat(testPaths.posix).forEach(testPath => {
    const relative = pathUtils.makeRelativePath(testPath);
    log(`  ${testPath} → ${relative}`);
    
    // Check that drive letters and leading slashes are removed
    const hasNoDriveLetter = !relative.match(/^[a-zA-Z]:/);
    const hasNoLeadingSlash = !relative.match(/^[/\\]/);
    
    if (hasNoDriveLetter && hasNoLeadingSlash) {
      successLog(`  ✓ Path correctly made relative`);
    } else {
      errorLog(`  ✗ Path not correctly made relative`);
    }
  });
  
  // Test isSubPath
  log('\nTesting isSubPath:', colors.blue);
  pathPairs.forEach(({ parent, child, isSubPath }) => {
    const result = pathUtils.isSubPath(parent, child);
    log(`  isSubPath("${parent}", "${child}") → ${result}`);
    
    if (result === isSubPath) {
      successLog(`  ✓ isSubPath returned expected result: ${result}`);
    } else {
      errorLog(`  ✗ isSubPath returned unexpected result: ${result}, expected: ${isSubPath}`);
    }
  });
  
  // Test basename
  log('\nTesting basename:', colors.blue);
  const basenamePaths = [
    { path: '/Users/username/Documents/file.txt', expected: 'file.txt' },
    { path: 'C:\\Users\\username\\Documents\\file.txt', expected: 'file.txt' },
    { path: '/Users/username/Documents/', expected: 'Documents' },
    { path: 'file.txt', expected: 'file.txt' }
  ];
  
  basenamePaths.forEach(({ path: testPath, expected }) => {
    const result = pathUtils.basename(testPath);
    log(`  basename("${testPath}") → ${result}`);
    
    if (result === expected) {
      successLog(`  ✓ basename returned expected result: ${result}`);
    } else {
      errorLog(`  ✗ basename returned unexpected result: ${result}, expected: ${expected}`);
    }
  });
  
  // Test dirname
  log('\nTesting dirname:', colors.blue);
  const dirnamePaths = [
    { path: '/Users/username/Documents/file.txt', expected: '/Users/username/Documents' },
    { path: 'C:\\Users\\username\\Documents\\file.txt', expected: pathUtils.normalizePath('C:\\Users\\username\\Documents') },
    { path: '/Users/username/Documents/', expected: '/Users/username' },
    { path: 'file.txt', expected: '.' }
  ];
  
  dirnamePaths.forEach(({ path: testPath, expected }) => {
    const result = pathUtils.dirname(testPath);
    log(`  dirname("${testPath}") → ${result}`);
    
    // Normalize both for comparison
    const normalizedResult = pathUtils.normalizePath(result);
    const normalizedExpected = pathUtils.normalizePath(expected);
    
    if (normalizedResult === normalizedExpected) {
      successLog(`  ✓ dirname returned expected result: ${result}`);
    } else {
      errorLog(`  ✗ dirname returned unexpected result: ${result}, expected: ${expected}`);
    }
  });
  
  // Test edge cases
  log('\nTesting edge cases:', colors.blue);
  
  // Empty path
  try {
    const normalized = pathUtils.normalizePath('');
    log(`  normalizePath("") → ${normalized}`);
    successLog(`  ✓ Handles empty path`);
  } catch (error) {
    errorLog(`  ✗ Failed on empty path: ${error.message}`);
  }
  
  // Null/undefined
  try {
    const normalized = pathUtils.normalizePath(null);
    log(`  normalizePath(null) → ${normalized}`);
    successLog(`  ✓ Handles null input`);
  } catch (error) {
    errorLog(`  ✗ Failed on null input: ${error.message}`);
  }
  
  // Very long path
  try {
    const longPath = 'C:\\' + 'very\\long\\path\\'.repeat(50) + 'file.txt';
    const normalized = pathUtils.normalizePath(longPath);
    log(`  normalizePath(very long path) → ${normalized.substring(0, 20)}...${normalized.substring(normalized.length - 20)}`);
    successLog(`  ✓ Handles very long path`);
  } catch (error) {
    errorLog(`  ✗ Failed on very long path: ${error.message}`);
  }
  
  // Invalid characters
  try {
    const invalidPath = 'C:\\Users\\*|:<>?\\file.txt';
    const result = pathUtils.isValidPath(invalidPath);
    log(`  isValidPath("${invalidPath}") → ${result}`);
    if (result === false) {
      successLog(`  ✓ Correctly identifies invalid path`);
    } else {
      warningLog(`  ⚠️ isValidPath returned true for path with invalid characters (might be platform-dependent)`);
    }
  } catch (error) {
    errorLog(`  ✗ Failed on path with invalid characters: ${error.message}`);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 