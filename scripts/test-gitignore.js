/**
 * Test script to verify gitignore functionality is working correctly
 * This script tests that the loadGitignore function correctly integrates
 * gitignore patterns with the excludedFiles patterns.
 * 
 * It specifically tests cross-platform compatibility by simulating
 * paths with different separators and case.
 */

const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const { excludedFiles } = require('../excluded-files');
const os = require('os');

// Normalize path to use forward slashes for cross-platform compatibility
function normalizePath(filePath) {
  if (!filePath) return filePath;
  return filePath.replace(/\\/g, '/');
}

// Mock function to simulate the loadGitignore function
function loadGitignore(rootDir) {
  let ig;
  
  try {
    ig = ignore();
  } catch (err) {
    console.error("Error creating ignore filter:", err);
    return {
      ignores: (path) => false
    };
  }
  
  try {
    const gitignorePath = path.join(rootDir, ".gitignore");

    if (fs.existsSync(gitignorePath)) {
      try {
        console.log(`Found .gitignore at ${gitignorePath}`);
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
        const normalizedPatterns = gitignoreContent
          .split(/\r?\n/)
          .map(pattern => pattern.trim())
          .filter(pattern => pattern && !pattern.startsWith('#'))
          .map(pattern => normalizePath(pattern));

        console.log('Gitignore patterns:', normalizedPatterns);
        ig.add(normalizedPatterns);
      } catch (err) {
        console.error("Error reading .gitignore:", err);
      }
    } else {
      console.log(`No .gitignore found at ${gitignorePath}`);
    }

    // Add some default ignores that are common
    ig.add([
      ".git",
      "node_modules",
      ".DS_Store",
      "Thumbs.db",
      "desktop.ini",
      ".idea",
      ".vscode",
      "dist",
      "build",
      "out"
    ]);

    // Add the excludedFiles patterns
    if (Array.isArray(excludedFiles)) {
      ig.add(excludedFiles);
    }
  } catch (err) {
    console.error("Error configuring ignore filter:", err);
  }

  // Wrap the ignores function to normalize paths before checking
  const originalIgnores = ig.ignores;
  ig.ignores = (filePath) => {
    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      return false;
    }
    
    try {
      // Normalize path before checking
      const normalizedPath = normalizePath(filePath);
      return originalIgnores.call(ig, normalizedPath);
    } catch (err) {
      console.error(`Error in ignores for path '${filePath}':`, err);
      return false;
    }
  };

  return ig;
}

// Run the test
function runTest() {
  // Get the app root directory
  const rootDir = path.resolve(__dirname, '..');
  console.log('Testing gitignore functionality in directory:', rootDir);
  console.log('Current operating system:', os.platform());
  
  // Load the gitignore patterns
  const ignoreFilter = loadGitignore(rootDir);
  
  // Create a test file list with cross-platform path variants
  const testFiles = [
    'src/App.tsx',
    'src\\App.tsx', // Windows-style path
    'SRC/app.tsx', // Case difference to test case sensitivity
    'node_modules/react/index.js',
    '.git/config',
    'release-builds/app.exe',
    'package.json',
    'dist/index.js',
    '.env.local',
    'README.md',
    '.vscode/settings.json'
  ];
  
  console.log('\nTesting file exclusion:');
  testFiles.forEach(file => {
    const isIgnored = ignoreFilter.ignores(file);
    console.log(`${file} - ${isIgnored ? 'EXCLUDED' : 'INCLUDED'}`);
  });
  
  // Check if .gitignore patterns are being respected
  console.log('\nChecking custom .gitignore patterns:');
  const customTests = [];
  
  // Try to read the actual .gitignore file
  try {
    const gitignorePath = path.join(rootDir, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const patterns = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
        .slice(0, 5); // Take first 5 patterns for testing
      
      patterns.forEach(pattern => {
        // Create different platform variants for each pattern
        const windowsPath = pattern.replace(/\//g, '\\').replace('*', 'testfile').replace('**', 'test\\path');
        const unixPath = pattern.replace('*', 'testfile').replace('**', 'test/path');
        const mixedCasePath = unixPath.replace(/[a-z]/g, (c, i) => i % 2 ? c : c.toUpperCase());
        
        customTests.push({
          pattern,
          testPaths: [
            { path: unixPath, description: 'Unix path' },
            { path: windowsPath, description: 'Windows path' },
            { path: mixedCasePath, description: 'Mixed case path' }
          ]
        });
      });
      
      customTests.forEach(({ pattern, testPaths }) => {
        console.log(`\nTesting pattern: ${pattern}`);
        testPaths.forEach(({ path: testPath, description }) => {
          const isIgnored = ignoreFilter.ignores(testPath);
          console.log(`  ${description}: ${testPath} - ${isIgnored ? 'EXCLUDED' : 'INCLUDED'}`);
        });
      });
    } else {
      console.log('No .gitignore file found for custom pattern testing');
    }
  } catch (err) {
    console.error('Error testing custom patterns:', err);
  }
  
  // Test with paths containing special characters and Unicode
  console.log('\nTesting paths with special characters:');
  const specialPaths = [
    'src/special path with spaces/file.js',
    'src/special-path-with-dashes/file.js',
    'src/special_path_with_underscores/file.js',
    'src/special.path.with.dots/file.js',
    'src/special@path#with$symbols/file.js',
    'src/специальный-путь/файл.js', // Unicode path
  ];
  
  // Add patterns for special paths
  const specialIgnore = ignore().add('**/special*/**');
  specialPaths.forEach(testPath => {
    const isIgnoredByDefault = ignoreFilter.ignores(testPath);
    const isIgnoredBySpecial = specialIgnore.ignores(normalizePath(testPath));
    console.log(`${testPath}:`);
    console.log(`  - By default patterns: ${isIgnoredByDefault ? 'EXCLUDED' : 'INCLUDED'}`);
    console.log(`  - By '**/special*/**': ${isIgnoredBySpecial ? 'EXCLUDED' : 'INCLUDED'}`);
  });
}

runTest(); 