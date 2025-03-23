/**
 * Cross-platform test script for gitignore functionality
 * 
 * Tests various path formats and scenarios to ensure consistent behavior
 * across Windows, macOS, and Linux platforms.
 */

const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const os = require('os');

// Simulated gitignore patterns commonly found in projects
const commonGitignorePatterns = [
  '.DS_Store',
  'node_modules/',
  '*.log',
  'dist/',
  'build/',
  '.env*',
  '*.min.js',
  'coverage/',
  '.idea/',
  '.vscode/',
  '# Comment line that should be ignored',
  '',  // Empty line that should be ignored
  'temp/',
  'logs/*.txt',
  '**/test-results',
  'archive/**/*.zip'
];

// Function to normalize paths - converts backslashes to forward slashes
function normalizePath(path) {
  if (!path) return path;
  return path.replace(/\\/g, '/');
}

// Function to make paths relative by removing drive letters and leading slashes
function makeRelativePath(path) {
  if (!path) return path;
  
  // Normalize first
  let normalizedPath = normalizePath(path);
  
  // Remove drive letter (e.g., C:/) if present
  normalizedPath = normalizedPath.replace(/^[a-zA-Z]:\//, '');
  
  // Remove leading slash if present
  normalizedPath = normalizedPath.replace(/^\//, '');
  
  return normalizedPath;
}

// Detect current platform
console.log(`Current platform: ${os.platform()}`);
console.log(`Path separator: ${path.sep}\n`);

// Create ignore filter
const ig = ignore().add(commonGitignorePatterns);

// Wrap the ignores function with additional logging and normalization
const originalIgnores = ig.ignores;
ig.ignores = (testPath) => {
  if (!testPath) return false;
  
  // Make the path relative and normalize it
  const relativePath = makeRelativePath(testPath);
  const result = originalIgnores.call(ig, relativePath);
  
  return result;
};

// Create test cases with platform-specific variations
const testCases = [
  // Unix-style paths
  'src/components/App.js',
  'src/components/App.min.js',
  'node_modules/react/index.js',
  'dist/index.js',
  '.env.local',
  '.DS_Store',
  
  // Windows-style paths
  'src\\components\\App.js',
  'src\\components\\App.min.js',
  'node_modules\\react\\index.js',
  'dist\\index.js',
  '.env.local',
  
  // Mixed separators
  'src/components\\App.js',
  'src\\components/App.min.js',
  
  // Case sensitivity tests
  'SRC/components/app.js',
  'SRC\\COMPONENTS\\APP.JS',
  'NODE_MODULES/react/index.js',
  '.ENV.local',
  
  // Path with spaces and special characters
  'src/my documents/Important File.js',
  'src/special-characters/file(1).js',
  'src/data & analysis/results.json',
  
  // Nested paths for glob pattern testing
  'logs/error.txt',
  'logs/debug.log',
  'test-results/unit/report.xml',
  'deep/path/test-results/report.xml',
  'archive/2023/backup.zip',
  'archive/temp/file.js'
];

// Run the tests
console.log('Testing cross-platform gitignore path handling:');
console.log('---------------------------------------------');

testCases.forEach(testPath => {
  const isIgnored = ig.ignores(testPath);
  console.log(`Path: ${testPath}`);
  console.log(`  Normalized: ${normalizePath(testPath)}`);
  console.log(`  Relative: ${makeRelativePath(testPath)}`);
  console.log(`  Result: ${isIgnored ? 'EXCLUDED' : 'INCLUDED'}`);
  console.log('---------------------------------------------');
});

// Windows drive letter specific tests (only relevant on Windows)
if (os.platform() === 'win32') {
  console.log('\nWindows drive letter tests:');
  console.log('---------------------------------------------');
  
  const driveLetterTests = [
    'C:\\dist\\main.js',
    'c:\\dist\\main.js',
    'C:/dist/main.js',
    'c:/dist/main.js',
    'C:\\node_modules\\module.js',
    'c:\\NODE_MODULES\\module.js'
  ];
  
  driveLetterTests.forEach(testPath => {
    const isIgnored = ig.ignores(testPath);
    console.log(`Path: ${testPath}`);
    console.log(`  Normalized: ${normalizePath(testPath)}`);
    console.log(`  Relative: ${makeRelativePath(testPath)}`);
    console.log(`  Result: ${isIgnored ? 'EXCLUDED' : 'INCLUDED'}`);
    console.log('---------------------------------------------');
  });
}

// Test matching on relative paths
console.log('\nRelative path tests:');
console.log('---------------------------------------------');

// Using paths without drive letters for cross-platform compatibility
const baseDir = 'project';
const testFiles = [
  'project/dist/main.js',
  'project/src/App.js',
  'project/node_modules/react.js'
];

testFiles.forEach(fullPath => {
  // Get the relative path
  const relPath = fullPath.substring(baseDir.length + 1);
  const isIgnored = ig.ignores(relPath);
  
  console.log(`Full path: ${fullPath}`);
  console.log(`Relative path: ${relPath}`);
  console.log(`Result: ${isIgnored ? 'EXCLUDED' : 'INCLUDED'}`);
  console.log('---------------------------------------------');
});

console.log('\nTest complete! ✅'); 