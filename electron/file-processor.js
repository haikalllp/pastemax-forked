const fs = require('fs').promises;
const path = require('path');
let encoder;
try {
    const tiktoken = require('tiktoken');
    encoder = tiktoken.get_encoding('cl100k_base');
} catch (error) {
    console.error('Failed to load tiktoken:', error);
    console.log('Proceeding without token counting. Token counts will be reported as 0.');
    encoder = null; // Ensure encoder is null if loading fails
}
const { normalizePath, ensureAbsolutePath, safeRelativePath, isValidPath } = require('./utils.js');
const { MAX_FILE_SIZE, binaryExtensions } = require('./config.js');

const fileCache = new Map();
const fileTypeCache = new Map();

/**
 * Checks if a file is likely a binary file based on its extension.
 * Uses a cache to avoid repeated checks for the same extension.
 * @param {string} filePath - The full path to the file.
 * @returns {boolean} - True if the file is likely binary, false otherwise.
 */
function isBinary(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (fileTypeCache.has(ext)) {
    return fileTypeCache.get(ext);
  }

  const isBinary = binaryExtensions.includes(ext);
  fileTypeCache.set(ext, isBinary);
  return isBinary;
}

/**
 * Counts the number of tokens in a given text string using the loaded tiktoken encoder.
 * Provides a fallback character-based estimation if the encoder is not available.
 * @param {string} text - The text content to count tokens for.
 * @returns {number} - The estimated number of tokens.
 */
function countFileTokens(text) {
  if (!encoder) {
    // Fallback: Estimate tokens based on characters (average 4 chars per token)
    return Math.ceil(text.length / 4);
  }

  try {
    // Remove potential end-of-text tokens before encoding
    const cleanText = text.replace(/<\|endoftext\|>/g, '');
    const tokens = encoder.encode(cleanText);
    return tokens.length;
  } catch (err) {
    console.error('Error counting tokens:', err);
    // Fallback in case of encoding error
    return Math.ceil(text.length / 4);
  }
}

/**
 * @typedef {Object} FileMetadata
 * @property {string} path - Absolute normalized path
 * @property {string} relativePath - Path relative to the root directory
 * @property {string} name - Base file name
 * @property {number} size - File size in bytes
 * @property {boolean} isDirectory - False for files (though directories are filtered out before this stage usually)
 * @property {string} extension - Lowercase file extension (e.g., '.js')
 * @property {boolean} excluded - Whether the file matches default exclusion patterns (from shouldExcludeByDefault)
 * @property {string} [content] - File content (for non-binary, non-skipped files)
 * @property {number} tokenCount - Calculated token count
 * @property {boolean} isBinary - Flag indicating if file is considered binary (by extension or detection)
 * @property {boolean} isSkipped - Flag indicating if file processing was skipped (e.g., too large, error)
 * @property {string} [error] - Error message if skipped due to an error
 * @property {string} [fileType] - Uppercase extension for binary files (e.g., 'PNG')
 */

/**
 * Processes a single file, reads its content (if not binary/too large),
 * counts tokens, and returns FileMetadata. Uses a cache.
 * Assumes ignore checks have been performed by the caller.
 * @param {string} fullPath - The absolute path to the file.
 * @param {string} rootDir - The absolute path to the root directory being scanned.
 * @returns {Promise<FileMetadata>} - A promise resolving with the file metadata.
 */
async function processFile(fullPath, rootDir) {
  const fullPathNormalized = normalizePath(fullPath);

  // 1. Check cache
  if (fileCache.has(fullPathNormalized)) {
    // console.log(`[FileProcessor] Cache hit for ${fullPathNormalized}`);
    return fileCache.get(fullPathNormalized);
  }

  const rootDirNormalized = normalizePath(rootDir);
  const relativePath = safeRelativePath(rootDirNormalized, fullPathNormalized);
  const name = path.basename(fullPath);

  // 3. Basic validation
  if (!isValidPath(relativePath) || relativePath.startsWith('..')) {
    const fileData = {
      path: fullPathNormalized,
      relativePath,
      name,
      size: 0,
      isDirectory: false, // Assuming this function only processes files
      extension: path.extname(fullPath).toLowerCase(),
      excluded: false, // This check is done by the caller
      content: '',
      tokenCount: 0,
      isBinary: false, // Unknown, but skipped
      isSkipped: true,
      error: 'Invalid path',
      fileType: '',
    };
    fileCache.set(fullPathNormalized, fileData);
    console.warn(`[FileProcessor] Skipping invalid path: ${fullPathNormalized}`);
    return fileData;
  }

  // 4. Check if binary
  const binary = isBinary(fullPath);

  if (binary) {
    // 5. If binary
    const fileData = {
      name,
      path: fullPathNormalized,
      relativePath,
      size: 0, // Default size
      isDirectory: false,
      extension: path.extname(fullPath).toLowerCase(),
      excluded: false, // This check is done by the caller
      content: '',
      tokenCount: 0,
      isBinary: true,
      isSkipped: false,
      fileType: path.extname(fullPath).toUpperCase().replace('.', ''),
    };

    try {
      const stats = await fs.stat(fullPath);
      fileData.size = stats.size;
    } catch (err) {
      console.error(`[FileProcessor] Error getting stats for binary file ${fullPathNormalized}:`, err);
      fileData.isSkipped = true;
      fileData.error = `Error getting stats: ${err.message}`;
    }

    fileCache.set(fullPathNormalized, fileData);
    // console.log(`[FileProcessor] Processed binary file: ${fullPathNormalized}`);
    return fileData;

  } else {
    // 6. If not binary
    let stats;
    try {
      stats = await fs.stat(fullPath);
    } catch (err) {
      console.error(`[FileProcessor] Error stating file ${fullPathNormalized}:`, err);
      const fileData = {
        name,
        path: fullPathNormalized,
        relativePath,
        size: 0,
        isDirectory: false,
        extension: path.extname(fullPath).toLowerCase(),
        excluded: false, // This check is done by the caller
        content: '',
        tokenCount: 0,
        isBinary: false,
        isSkipped: true,
        error: `Error stating file: ${err.message}`,
        fileType: '',
      };
      fileCache.set(fullPathNormalized, fileData);
      return fileData;
    }

    // Check size limit
    if (stats.size > MAX_FILE_SIZE) {
      const fileData = {
        name,
        path: fullPathNormalized,
        relativePath,
        size: stats.size,
        isDirectory: false,
        extension: path.extname(fullPath).toLowerCase(),
        excluded: false, // This check is done by the caller
        content: '',
        tokenCount: 0,
        isBinary: false,
        isSkipped: true,
        error: `File size (${stats.size} bytes) exceeds limit (${MAX_FILE_SIZE} bytes)`,
        fileType: '',
      };
      fileCache.set(fullPathNormalized, fileData);
      // console.log(`[FileProcessor] Skipping large file: ${fullPathNormalized}`);
      return fileData;
    }

    let content;
    // 7. Read file content
    try {
      content = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      console.error(`[FileProcessor] Error reading file ${fullPathNormalized}:`, err);
      const fileData = {
        name,
        path: fullPathNormalized,
        relativePath,
        size: stats.size,
        isDirectory: false,
        extension: path.extname(fullPath).toLowerCase(),
        excluded: false, // This check is done by the caller
        content: '',
        tokenCount: 0,
        isBinary: false,
        isSkipped: true,
        error: `Error reading file: ${err.message}`,
        fileType: '',
      };
      fileCache.set(fullPathNormalized, fileData);
      return fileData;
    }

    // Count tokens
    const tokenCount = countFileTokens(content);

    // Create final FileMetadata object
    const fileData = {
      name,
      path: fullPathNormalized,
      relativePath,
      size: stats.size,
      isDirectory: false,
      extension: path.extname(fullPath).toLowerCase(),
      excluded: false, // This check is done by the caller
      content,
      tokenCount,
      isBinary: false,
      isSkipped: false,
      fileType: '',
    };

    // Cache and return
    fileCache.set(fullPathNormalized, fileData);
    // console.log(`[FileProcessor] Processed text file: ${fullPathNormalized}`);
    return fileData;
  }
}

/**
 * Clears the internal file and file type caches.
 */
function clearFileCache() {
  fileCache.clear();
  fileTypeCache.clear();
  console.log('[FileProcessor] File caches cleared');
}

// Export the functions for use in other modules
module.exports = {
  processFile,
  clearFileCache,
};