/**
 * Shared path utilities for cross-platform compatibility
 * Works in both Node.js and browser environments
 * 
 * This module provides a single source of truth for path handling
 * across the entire application, ensuring consistent behavior
 * between the Electron backend and React frontend.
 */

// Detect environment
const isNode = typeof process !== 'undefined' && 
               process.versions != null && 
               process.versions.node != null;

// Detect Windows platform
const isWindows = isNode 
  ? process.platform === 'win32' 
  : typeof navigator !== 'undefined' && 
    navigator.platform && 
    /win/i.test(navigator.platform);

/**
 * Normalizes file paths to use forward slashes regardless of OS
 * Handles special cases like Windows UNC paths
 * 
 * @param {string} filePath - The file path to normalize
 * @returns {string} - The normalized path
 */
function normalizePath(filePath) {
  if (!filePath) return filePath;

  // Handle Windows UNC paths in Node.js environment
  if (isNode && isWindows && filePath.startsWith('\\\\')) {
    // Preserve the UNC path format but normalize separators
    return '\\\\' + filePath.slice(2).replace(/\\/g, '/');
  }

  // Standard normalization for all other paths
  return filePath.replace(/\\/g, '/');
}

/**
 * Makes a path relative by removing drive letters and leading slashes
 * Useful for gitignore pattern matching
 * 
 * @param {string} filePath - The file path to make relative
 * @returns {string} - The path without drive letter and leading slashes
 */
function makeRelativePath(filePath) {
  if (!filePath) return filePath;
  
  // Normalize first
  let normalizedPath = normalizePath(filePath);
  
  // Remove drive letter (e.g., C:/) if present (Windows-specific)
  normalizedPath = normalizedPath.replace(/^[a-zA-Z]:\//, '');
  
  // Remove leading slash if present
  normalizedPath = normalizedPath.replace(/^\//, '');
  
  return normalizedPath;
}

/**
 * Extract the basename from a path string
 * 
 * @param {string} path - The path to extract the basename from
 * @returns {string} - The basename (last part of the path)
 */
function basename(path) {
  if (!path) return "";

  // Handle both forward and backslashes
  const normalizedPath = normalizePath(path);
  // Remove trailing slashes
  const trimmedPath = normalizedPath.endsWith("/")
    ? normalizedPath.slice(0, -1)
    : normalizedPath;
  // Get the last part after the final slash
  const parts = trimmedPath.split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Extract the directory name from a path string
 * 
 * @param {string} path - The path to extract the directory from
 * @returns {string} - The directory (everything except the last part)
 */
function dirname(path) {
  if (!path) return ".";

  // Handle both forward and backslashes
  const normalizedPath = normalizePath(path);
  // Remove trailing slashes
  const trimmedPath = normalizedPath.endsWith("/")
    ? normalizedPath.slice(0, -1)
    : normalizedPath;
  // Get everything before the final slash
  const lastSlashIndex = trimmedPath.lastIndexOf("/");
  return lastSlashIndex === -1 ? "." : trimmedPath.slice(0, lastSlashIndex);
}

/**
 * Join path segments together
 * @param {...string} segments The path segments to join
 * @returns {string} The joined path
 */
function join(...segments) {
  // Filter out null/undefined/empty segments
  const filteredSegments = segments
    .filter(segment => segment != null)
    .map(segment => String(segment));
  
  if (filteredSegments.length === 0) return '';
  
  // Check if the first segment starts with a slash to preserve absolute paths
  const isAbsolute = filteredSegments[0].startsWith('/');
  
  // Process each segment
  const processedSegments = filteredSegments
    .map(segment => segment.replace(/^\/|\/$/g, '')) // Remove leading/trailing slashes
    .filter(segment => segment !== ''); // Skip empty segments after processing
  
  // Add back the leading slash if the original path was absolute
  const joinedPath = processedSegments.join('/');
  return isAbsolute ? '/' + joinedPath : joinedPath;
}

/**
 * Get the file extension
 * 
 * @param {string} path - The path to get the extension from
 * @returns {string} - The file extension including the dot
 */
function extname(path) {
  if (!path) return "";

  const basenameValue = basename(path);
  const dotIndex = basenameValue.lastIndexOf(".");
  return dotIndex === -1 || dotIndex === 0 ? "" : basenameValue.slice(dotIndex);
}

/**
 * Compares two paths for equality, handling different OS path separators
 * and platform-specific case sensitivity
 * 
 * @param {string} path1 First path to compare
 * @param {string} path2 Second path to compare
 * @returns {boolean} True if the paths are equivalent, false otherwise
 */
function arePathsEqual(path1, path2) {
  // Handle null/undefined cases
  if (!path1 && !path2) return true;
  if (!path1 || !path2) return false;
  
  // Normalize both paths
  let norm1 = normalizePath(path1);
  let norm2 = normalizePath(path2);
  
  // Remove trailing slashes
  norm1 = norm1.replace(/\/+$/, '');
  norm2 = norm2.replace(/\/+$/, '');
  
  // Make both paths relative to handle drive letter differences
  const relativePath1 = makeRelativePath(norm1);
  const relativePath2 = makeRelativePath(norm2);
  
  // On Windows, paths are case-insensitive
  if (isWindows) {
    return relativePath1.toLowerCase() === relativePath2.toLowerCase();
  }
  
  // On other systems (Mac, Linux), paths are case-sensitive
  return relativePath1 === relativePath2;
}

/**
 * Checks if one path is a subpath of another, handling platform-specific
 * path separators and case sensitivity
 * 
 * @param {string} parent The potential parent path
 * @param {string} child The potential child path
 * @returns {boolean} True if child is a subpath of parent
 */
function isSubPath(parent, child) {
  // Handle null/undefined cases
  if (!parent || !child) return false;
  
  // Normalize paths
  let normalizedParent = normalizePath(parent);
  let normalizedChild = normalizePath(child);
  
  // Remove trailing slashes
  normalizedParent = normalizedParent.replace(/\/+$/, '');
  normalizedChild = normalizedChild.replace(/\/+$/, '');
  
  // Make both paths relative to handle drive letter differences
  normalizedParent = makeRelativePath(normalizedParent);
  normalizedChild = makeRelativePath(normalizedChild);
  
  // Same path check
  if (arePathsEqual(normalizedParent, normalizedChild)) {
    return true;
  }
  
  // Ensure parent path ends with a slash for proper subpath checking
  // This prevents '/foo/bar' from matching '/foo/bart'
  const parentWithSlash = normalizedParent.endsWith('/') 
    ? normalizedParent 
    : normalizedParent + '/';
  
  if (isWindows) {
    // Case-insensitive comparison for Windows
    return normalizedChild.toLowerCase().startsWith(parentWithSlash.toLowerCase());
  }
  
  // Case-sensitive comparison for other platforms
  return normalizedChild.startsWith(parentWithSlash);
}

/**
 * Safely joins paths across different platforms
 * 
 * @param {...string} paths - Path segments to join
 * @returns {string} - Normalized joined path
 */
function safePathJoin(...paths) {
  // Use Node.js path.join if available, otherwise fallback to custom join
  if (isNode) {
    try {
      // Use Node.js path module when available
      const path = require('path');
      const joined = path.join(...paths);
      return normalizePath(joined);
    } catch (e) {
      // Fallback to custom join if path module is not available
      return join(...paths);
    }
  }
  
  // In browser environment, use custom join
  return join(...paths);
}

/**
 * Safely calculates relative path between two paths
 * Handles different OS path formats and edge cases
 * 
 * @param {string} from - Base path
 * @param {string} to - Target path
 * @returns {string} - Normalized relative path
 */
function safeRelativePath(from, to) {
  // Normalize both paths to use the same separator format
  from = normalizePath(from);
  to = normalizePath(to);
  
  // Handle Windows drive letter case-insensitivity
  if (isWindows) {
    from = from.toLowerCase();
    to = to.toLowerCase();
  }
  
  // Use Node.js path.relative if available
  if (isNode) {
    try {
      const path = require('path');
      let relativePath = path.relative(from, to);
      return normalizePath(relativePath);
    } catch (e) {
      // Fallback to simple path calculation if path module unavailable
    }
  }
  
  // Simple relative path calculation for browser environment
  // This is a basic implementation that only works for simple cases
  if (to.startsWith(from)) {
    return to.slice(from.length).replace(/^\//, '');
  }
  
  // For more complex cases, we would need a full-featured path.relative implementation
  // That's beyond the scope of this basic fallback
  return to;
}

/**
 * Ensures a path is absolute and normalized
 * 
 * @param {string} inputPath - The path to normalize
 * @returns {string} - Normalized absolute path
 */
function ensureAbsolutePath(inputPath) {
  if (isNode) {
    try {
      // Use Node.js path module when available
      const path = require('path');
      if (!path.isAbsolute(inputPath)) {
        inputPath = path.resolve(inputPath);
      }
      return normalizePath(inputPath);
    } catch (e) {
      // Fallback if path module is not available
      return normalizePath(inputPath);
    }
  }
  
  // In browser environment, we can't reliably make paths absolute
  return normalizePath(inputPath);
}

/**
 * Checks if a path is a valid path for the current OS
 * @param {string} pathToCheck Path to validate
 * @returns {boolean} True if path is valid
 */
function isValidPath(pathToCheck) {
  // Empty paths are considered invalid
  if (!pathToCheck || (typeof pathToCheck === 'string' && pathToCheck.trim() === '')) {
    return false;
  }
  
  if (isNode) {
    try {
      const path = require('path');
      path.parse(pathToCheck);
      return true;
    } catch (err) {
      return false;
    }
  }
  
  // In browser, basic validation - reject obvious invalid characters
  // This is a basic check, not comprehensive
  return typeof pathToCheck === 'string' && 
         pathToCheck.trim() !== '' &&
         !pathToCheck.includes('*') && 
         !pathToCheck.includes('?') && 
         !pathToCheck.includes('<') && 
         !pathToCheck.includes('>') && 
         !pathToCheck.includes('|');
}

/**
 * Gets the path separator for the current platform
 * 
 * @returns {string} - The path separator (/ or \)
 */
function getPathSeparator() {
  if (isNode) {
    const path = require('path');
    return path.sep;
  }
  return isWindows ? '\\' : '/';
}

// Export all utilities
module.exports = {
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
  isNode,
}; 