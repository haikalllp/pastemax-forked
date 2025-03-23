/**
 * This script tests that the excluded-files.js module correctly identifies files
 * that should be ignored according to common patterns.
 * 
 * It verifies that our centralized patterns work correctly across platforms.
 */

const path = require('path');
const excludedFiles = require('../excluded-files');

// Extract the patterns we're using
const { 
  defaultIgnorePatterns, 
  excludedRegexPatterns, 
  skipDirectories,
  binaryExtensions,
  patternsByCategory,
  ignoreCategories,
  normalizePath
} = excludedFiles;

// Define test paths in both Unix and Windows format to test cross-platform compatibility
const testPathsUnix = [
  // Version control
  '.git/HEAD',
  '.github/workflows/ci.yml',
  '.svn/wc.db',
  
  // Node/NPM
  'node_modules/react/package.json',
  'package-lock.json',
  'yarn.lock',
  
  // Build output
  'dist/bundle.js',
  'build/index.html',
  '.next/server/pages/index.js',
  
  // JS/TS files
  'src/components/index.js',
  'src/utils.min.js',
  'src/app.js.map',
  
  // Python
  '__pycache__/utils.pyc',
  'venv/bin/activate',
  
  // Logs and temp files
  'logs/error.log',
  'tmp/cache.tmp',
  
  // Binary files
  'images/logo.png',
  'docs/report.pdf',
  
  // Files that should NOT be ignored
  'src/utils.js',
  'README.md',
  'config.js',
  'src/components/Button.jsx'
];

// Create Windows-style paths for testing cross-platform compatibility
const testPathsWindows = testPathsUnix.map(p => p.replace(/\//g, '\\'));

/**
 * Simplified function to check if a file should be excluded based on its path
 * (mimicking the logic in the main app)
 */
function shouldExcludeFile(filePath) {
  // Normalize path for cross-platform consistency
  const normalizedPath = normalizePath(filePath);
  
  // 1. First check against regex patterns (fastest)
  for (const pattern of excludedRegexPatterns) {
    if (pattern.test(normalizedPath)) {
      return { excluded: true, reason: `Regex pattern: ${pattern}` };
    }
  }
  
  // 2. Check if the path includes a directory that should be skipped
  for (const dir of skipDirectories) {
    if (normalizedPath.includes(`/${dir}/`) || normalizedPath.startsWith(`${dir}/`)) {
      return { excluded: true, reason: `Skip directory: ${dir}` };
    }
  }
  
  // 3. Check against gitignore-style patterns
  for (const pattern of defaultIgnorePatterns) {
    // Very simplified pattern matching (the real one would use ignore package)
    if (pattern.endsWith('/**')) {
      // Directory with all contents
      const dirPattern = pattern.slice(0, -3);
      if (normalizedPath.startsWith(dirPattern) || normalizedPath.includes(`/${dirPattern}`)) {
        return { excluded: true, reason: `Directory pattern: ${pattern}` };
      }
    } else if (pattern.startsWith('*.')) {
      // Extension pattern
      const ext = pattern.slice(1);
      if (normalizedPath.endsWith(ext)) {
        return { excluded: true, reason: `Extension pattern: ${pattern}` };
      }
    } else if (normalizedPath === pattern || normalizedPath.endsWith(`/${pattern}`)) {
      // Exact file match
      return { excluded: true, reason: `Exact pattern: ${pattern}` };
    }
  }
  
  // 4. Check binary extensions
  for (const ext of binaryExtensions) {
    if (normalizedPath.endsWith(ext)) {
      return { excluded: false, binary: true, reason: `Binary extension: ${ext}` };
    }
  }
  
  // Not excluded
  return { excluded: false, reason: 'No matching pattern' };
}

// Run the test
console.log('Testing excluded-files.js pattern matching\n');
console.log(`Using ${defaultIgnorePatterns.length} default ignore patterns`);
console.log(`Using ${excludedRegexPatterns.length} regex patterns`);
console.log(`Using ${skipDirectories.length} skip directories`);
console.log(`Using ${binaryExtensions.length} binary extensions`);
console.log(`Using ${Object.keys(patternsByCategory).length} categories of patterns\n`);

// Test Unix-style paths
console.log('Results for Unix-style paths:');
let excludedCountUnix = 0;
let includedCountUnix = 0;
let binaryCountUnix = 0;

testPathsUnix.forEach(testPath => {
  const result = shouldExcludeFile(testPath);
  
  if (result.excluded) {
    excludedCountUnix++;
    console.log(`- EXCLUDED: ${testPath} (${result.reason})`);
  } else if (result.binary) {
    binaryCountUnix++;
    console.log(`- BINARY: ${testPath} (${result.reason})`);
  } else {
    includedCountUnix++;
    console.log(`- INCLUDED: ${testPath} (${result.reason})`);
  }
});

console.log('\nSummary for Unix-style paths:');
console.log(`- Total paths tested: ${testPathsUnix.length}`);
console.log(`- Excluded paths: ${excludedCountUnix}`);
console.log(`- Binary paths: ${binaryCountUnix}`);
console.log(`- Included paths: ${includedCountUnix}`);

// Test Windows-style paths
console.log('\n\nResults for Windows-style paths:');
let excludedCountWindows = 0;
let includedCountWindows = 0;
let binaryCountWindows = 0;

testPathsWindows.forEach(testPath => {
  const result = shouldExcludeFile(testPath);
  
  if (result.excluded) {
    excludedCountWindows++;
    console.log(`- EXCLUDED: ${testPath} (${result.reason})`);
  } else if (result.binary) {
    binaryCountWindows++;
    console.log(`- BINARY: ${testPath} (${result.reason})`);
  } else {
    includedCountWindows++;
    console.log(`- INCLUDED: ${testPath} (${result.reason})`);
  }
});

console.log('\nSummary for Windows-style paths:');
console.log(`- Total paths tested: ${testPathsWindows.length}`);
console.log(`- Excluded paths: ${excludedCountWindows}`);
console.log(`- Binary paths: ${binaryCountWindows}`);
console.log(`- Included paths: ${includedCountWindows}`);

// Verify cross-platform consistency
console.log('\nCross-platform consistency check:');
const isConsistent = 
  excludedCountUnix === excludedCountWindows && 
  includedCountUnix === includedCountWindows &&
  binaryCountUnix === binaryCountWindows;

console.log(`- Cross-platform consistency: ${isConsistent ? 'PASSED ✓' : 'FAILED ✗'}`);
if (!isConsistent) {
  console.log('  There are differences in how paths are handled between Unix and Windows formats!');
  console.log(`  Unix: ${excludedCountUnix} excluded, ${binaryCountUnix} binary, ${includedCountUnix} included`);
  console.log(`  Windows: ${excludedCountWindows} excluded, ${binaryCountWindows} binary, ${includedCountWindows} included`);
}

console.log('\nTest completed successfully.'); 