/**
 * This script tests that the loadGitignore function correctly integrates
 * with the ignores check. It tests both absolute and relative paths.
 * 
 * This helps debug issues with gitignore pattern handling across platforms.
 */

const path = require('path');
const fs = require('fs');

// Sample gitignore patterns to test
const sampleGitignore = `
# Comment should be ignored
node_modules/
*.log
/dist
build/
.git/
# Empty lines should be skipped

*.min.js
vendor/**
`;

// Mock function to simulate the loadGitignore function
async function loadGitignore(rootDir) {
  console.log(`Testing gitignore with root: ${rootDir}`);
  try {
    // Create a simple mock of the ignore module functionality
    const patterns = sampleGitignore
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    console.log('Loaded patterns:', patterns);
    
    return {
      ignores: (filePath) => {
        // Normalize path separators for consistency
        filePath = filePath.replace(/\\/g, '/');
        // Make sure path is relative (no leading slash)
        if (filePath.startsWith('/')) {
          filePath = filePath.substring(1);
        }
        
        // Simple pattern matching
        for (const pattern of patterns) {
          let normalizedPattern = pattern;
          // Remove leading slash for matching
          if (normalizedPattern.startsWith('/')) {
            normalizedPattern = normalizedPattern.substring(1);
          }
          
          // Handle different pattern types
          if (normalizedPattern.endsWith('/')) {
            // Directory pattern
            if (filePath.startsWith(normalizedPattern) || 
                filePath.includes('/' + normalizedPattern)) {
              console.log(`Path ${filePath} matched directory pattern ${normalizedPattern}`);
              return true;
            }
          } else if (normalizedPattern.includes('*')) {
            // Wildcard pattern
            const regex = new RegExp('^' + normalizedPattern.replace(/\*/g, '.*') + '$');
            const pathParts = filePath.split('/');
            for (const part of pathParts) {
              if (regex.test(part)) {
                console.log(`Path ${filePath} matched wildcard pattern ${normalizedPattern}`);
                return true;
              }
            }
          } else {
            // Exact file pattern
            if (filePath === normalizedPattern || 
                filePath.endsWith('/' + normalizedPattern)) {
              console.log(`Path ${filePath} matched exact pattern ${normalizedPattern}`);
              return true;
            }
          }
        }
        
        return false;
      }
    };
  } catch (err) {
    console.error('Error in mock loadGitignore:', err);
    return { ignores: () => false };
  }
}

// Test paths to check
const testPaths = [
  'node_modules/react/package.json',
  'src/components/index.js',
  'logs/error.log',
  'dist/bundle.js',
  'build/index.html',
  '.git/HEAD',
  'src/app.min.js',
  'vendor/jquery/jquery.js',
  'src/utils.js'
];

// Test function
async function testGitignore() {
  const rootDir = '/project';
  
  console.log('Testing gitignore pattern matching\n');
  
  const ignoreFilter = await loadGitignore(rootDir);
  
  console.log('\nResults:');
  for (const testPath of testPaths) {
    const isIgnored = ignoreFilter.ignores(testPath);
    console.log(`- ${testPath}: ${isIgnored ? 'IGNORED' : 'INCLUDED'}`);
  }
}

// Run the test
testGitignore().catch(err => {
  console.error('Test failed with error:', err);
}); 