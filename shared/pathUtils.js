/**
 * Shared path utilities for both main and renderer processes
 * This file serves as a bridge between TypeScript path utilities and CommonJS modules
 * It provides a fallback for development environments when the compiled version is not available
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Determine environment
const isDev = process.env.NODE_ENV === 'development';
let compiledUtils = null;

// Try to load the compiled version of pathUtils
try {
  const compiledPath = path.join(__dirname, 'compiled', 'pathUtils.js');
  if (fs.existsSync(compiledPath)) {
    compiledUtils = require('./compiled/pathUtils');
    console.log('Loaded compiled path utilities');
  } else if (!isDev) {
    // Only warn if in production mode, in dev mode this is expected during first run
    console.warn(`Could not find compiled path utilities at ${compiledPath}`);
  }
} catch (err) {
  if (!isDev) {
    // In production, this is more concerning
    console.error('Failed to load compiled path utilities:', err);
  } else {
    // In development, this is less critical
    console.warn('Using fallback path utilities implementation');
  }
}

// Fallback implementations if compiled version is not available
function normalizePath(filePath) {
  if (!filePath) return '';
  
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');
  
  // Handle Windows UNC paths
  if (normalized.startsWith('//')) {
    return normalized;
  }
  
  // Remove duplicate slashes except at the beginning (for UNC paths)
  normalized = normalized.replace(/([^/])\/{2,}/g, '$1/');
  
  return normalized;
}

function makeRelativePath(path) {
  if (!path) return '';
  
  let relativePath = normalizePath(path);
  
  // Remove drive letter for Windows paths
  relativePath = relativePath.replace(/^[a-zA-Z]:/, '');
  
  // Remove leading slash to ensure it's a relative path
  relativePath = relativePath.replace(/^\/+/, '');
  
  return relativePath;
}

function isWindows() {
  return os.platform() === 'win32';
}

function getPathSeparator() {
  return isWindows() ? '\\' : '/';
}

function ensureAbsolutePath(filePath, basePath = process.cwd()) {
  if (!filePath) return basePath;
  
  // Already absolute
  if (path.isAbsolute(filePath)) {
    return normalizePath(filePath);
  }
  
  // Join with base path
  return normalizePath(path.resolve(basePath, filePath));
}

function safePathJoin(...parts) {
  if (!parts || parts.length === 0) return '';
  
  try {
    const joined = path.join(...parts.filter(Boolean).map(String));
    return normalizePath(joined);
  } catch (error) {
    console.error('Error joining paths:', error, parts);
    return normalizePath(parts[0] || '');
  }
}

function safeRelativePath(from, to) {
  if (!from || !to) return to || '';
  
  try {
    const normalizedFrom = normalizePath(from);
    const normalizedTo = normalizePath(to);
    
    // If paths are on different drives (Windows), just return the full target path
    if (isWindows() && 
        normalizedFrom.match(/^[a-zA-Z]:/) && 
        normalizedTo.match(/^[a-zA-Z]:/) && 
        normalizedFrom.charAt(0).toLowerCase() !== normalizedTo.charAt(0).toLowerCase()) {
      return normalizedTo;
    }
    
    const relativePath = path.relative(from, to);
    return normalizePath(relativePath);
  } catch (error) {
    console.error('Error creating relative path:', error, from, to);
    return normalizePath(to);
  }
}

function arePathsEqual(path1, path2) {
  if (!path1 || !path2) return false;
  
  // Normalize both paths
  const normalizedPath1 = normalizePath(path1);
  const normalizedPath2 = normalizePath(path2);
  
  // Case-insensitive comparison for Windows
  if (isWindows()) {
    return normalizedPath1.toLowerCase() === normalizedPath2.toLowerCase();
  }
  
  // Case-sensitive comparison for other platforms
  return normalizedPath1 === normalizedPath2;
}

function isValidPath(pathToCheck) {
  if (!pathToCheck || typeof pathToCheck !== 'string') return false;
  
  try {
    path.parse(pathToCheck);
    return true;
  } catch (e) {
    return false;
  }
}

function isSubPath(parent, child) {
  if (!parent || !child) return false;
  
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  
  // Ensure the parent path ends with a slash for proper subpath checking
  const parentWithSlash = normalizedParent.endsWith('/') 
    ? normalizedParent 
    : normalizedParent + '/';
  
  // Case-insensitive comparison for Windows
  if (isWindows()) {
    // Check for exact match first
    if (normalizedChild.toLowerCase() === normalizedParent.toLowerCase()) {
      return true;
    }
    
    // Special handling for drive letters on Windows
    if (normalizedParent.match(/^[a-zA-Z]:/) && normalizedChild.match(/^[a-zA-Z]:/)) {
      // If on different drives, not a subpath
      if (normalizedParent.charAt(0).toLowerCase() !== normalizedChild.charAt(0).toLowerCase()) {
        return false;
      }
    }
    
    return normalizedChild.toLowerCase().startsWith(parentWithSlash.toLowerCase());
  }
  
  // Case-sensitive comparison for other platforms
  return normalizedChild === normalizedParent || 
         normalizedChild.startsWith(parentWithSlash);
}

// Create utilities object with fallbacks
const utilities = {
  normalizePath: compiledUtils?.normalizePath || normalizePath,
  makeRelativePath: compiledUtils?.makeRelativePath || makeRelativePath,
  isWindows: compiledUtils?.isWindows || isWindows,
  getPathSeparator: compiledUtils?.getPathSeparator || getPathSeparator,
  ensureAbsolutePath: compiledUtils?.ensureAbsolutePath || ensureAbsolutePath,
  safePathJoin: compiledUtils?.safePathJoin || safePathJoin,
  safeRelativePath: compiledUtils?.safeRelativePath || safeRelativePath,
  arePathsEqual: compiledUtils?.arePathsEqual || arePathsEqual,
  isValidPath: compiledUtils?.isValidPath || isValidPath,
  isSubPath: compiledUtils?.isSubPath || isSubPath,
  
  // Also export path functions for convenience
  basename: path.basename,
  dirname: path.dirname,
  join: path.join,
  extname: path.extname
};

// Safety wrapper to ensure all exported functions handle errors gracefully
const safeUtilities = Object.entries(utilities).reduce((safe, [key, fn]) => {
  if (typeof fn === 'function') {
    // Wrap function in try/catch for safety
    safe[key] = function(...args) {
      try {
        return fn(...args);
      } catch (err) {
        console.error(`Error in ${key}:`, err);
        // Return appropriate fallback values based on function
        if (key === 'normalizePath' || key === 'makeRelativePath') return '';
        if (key === 'isWindows' || key === 'isValidPath' || key === 'isSubPath' || key === 'arePathsEqual') return false;
        if (key === 'getPathSeparator') return '/';
        return null;
      }
    };
  } else {
    safe[key] = fn;
  }
  return safe;
}, {});

module.exports = safeUtilities; 