const ignore = require('ignore');
const fs = require('fs').promises;
const path = require('path');
const { normalizePath, ensureAbsolutePath, safePathJoin, safeRelativePath, isValidPath } = require('./utils.js');
const { DEFAULT_PATTERNS, excludedFiles } = require('./config.js');

// Module-level state
let currentIgnoreMode = 'automatic';
const ignoreCache = new Map();
const gitIgnoreFound = new Map();
let defaultExcludeFilter = null;

// Initialize default ignore filter
let defaultIgnoreFilter;
try {
  defaultIgnoreFilter = ignore().add(DEFAULT_PATTERNS);
  console.log('[IgnoreHandler] Successfully initialized default ignore filter');
} catch (err) {
  console.error('[IgnoreHandler] Failed to initialize default ignore filter:', err);
  defaultIgnoreFilter = ignore();
}

// ======================
//  IGNORE HANDLER
// ======================

// Exclude files by default based on platform and specific patterns
function shouldExcludeByDefault(filePath, rootDir) {
  filePath = ensureAbsolutePath(filePath);
  rootDir = ensureAbsolutePath(rootDir);

  const relativePath = safeRelativePath(rootDir, filePath);

  if (!isValidPath(relativePath) || relativePath.startsWith('..')) {
    return true;
  }

  if (process.platform === 'win32') {
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(path.basename(filePath))) {
      console.log('[IgnoreHandler] Excluding reserved Windows name:', path.basename(filePath));
      return true;
    }

    if (
      filePath.toLowerCase().includes('\\windows\\') ||
      filePath.toLowerCase().includes('\\system32\\')
    ) {
      console.log('[IgnoreHandler] Excluding system path:', filePath);
      return true;
    }
  }

  if (process.platform === 'darwin') {
    if (
      filePath.includes('/.Spotlight-') ||
      filePath.includes('/.Trashes') ||
      filePath.includes('/.fseventsd')
    ) {
      console.log('[IgnoreHandler] Excluding macOS system path:', filePath);
      return true;
    }
  }

  if (process.platform === 'linux') {
    if (
      filePath.startsWith('/proc/') ||
      filePath.startsWith('/sys/') ||
      filePath.startsWith('/dev/')
    ) {
      console.log('[IgnoreHandler] Excluding Linux system path:', filePath);
      return true;
    }
  }

  // Create the filter only once and reuse it
  if (!defaultExcludeFilter) {
    defaultExcludeFilter = ignore().add(excludedFiles);
    console.log(`[IgnoreHandler] Initialized filter with ${excludedFiles.length} excluded files`);
  }

  const isExcluded = defaultExcludeFilter.ignores(relativePath);

  // Only log exclusions periodically to reduce spam
  if (isExcluded && Math.random() < 0.05) {
    console.log('[IgnoreHandler] Excluded file:', relativePath);
  }

  return isExcluded;
}

// ======================
// AUTOMATIC IGNORE MODE
// ======================

/**
 * Recursively scans the directory structure to collect all `.gitignore` files
 * and builds a map of patterns for automatic ignore mode.
 *
 */
async function collectGitignoreMapRecursive(startDir, rootDir, currentMap = new Map()) {
  const normalizedStartDir = normalizePath(startDir);
  const normalizedRootDir = normalizePath(rootDir);

  try {
    await fs.promises.access(normalizedStartDir, fs.constants.R_OK);
  } catch (err) {
    console.warn('[IgnoreHandler] Cannot access directory:', normalizedStartDir, err);
    return currentMap;
  }

  // Read .gitignore in current directory
  const gitignorePath = safePathJoin(normalizedStartDir, '.gitignore');
  try {
    const content = await fs.promises.readFile(gitignorePath, 'utf8');
    const patterns = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    if (patterns.length > 0) {
      const relativeDirPath = safeRelativePath(normalizedRootDir, normalizedStartDir) || '.';
      currentMap.set(relativeDirPath, patterns);
      console.log(`[IgnoreHandler] Found .gitignore in ${relativeDirPath} with ${patterns.length} patterns`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[IgnoreHandler] Error reading gitignore:', gitignorePath, err);
    }
  }

  // Recursively scan subdirectories in parallel
  try {
    const dirents = await fs.promises.readdir(normalizedStartDir, { withFileTypes: true });
    const subdirs = dirents.filter((dirent) => dirent.isDirectory());

    // Process subdirectories in parallel
    await Promise.all(
      subdirs.map(async (dirent) => {
        const subDir = safePathJoin(normalizedStartDir, dirent.name);
        await collectGitignoreMapRecursive(subDir, normalizedRootDir, currentMap);
      })
    );
  } catch (err) {
    console.error('[IgnoreHandler] Error reading directory for recursion:', normalizedStartDir, err);
  }

  return currentMap;
}

/**
 * Create a contextual ignore filter based on the current directory
 * and parent filter (for automatic mode)
 * This is for support of monorepo structures
 * where each subdirectory may have its own .gitignore
 *
 */
function createContextualIgnoreFilter(
  rootDir,
  currentDir,
  parentIgnoreFilter,
  ignoreMode = currentIgnoreMode
) {
  const ig = ignore();

  // 1. Add all patterns from parent filter (default patterns)
  if (parentIgnoreFilter && parentIgnoreFilter.rules) {
    const parentRules = parentIgnoreFilter.rules;
    // Extract pattern strings from parent rules
    const parentPatterns = Object.values(parentRules).map((rule) => rule.pattern);
    // Filter out any undefined/empty patterns
    const validPatterns = parentPatterns.filter((p) => p && typeof p === 'string');
    ig.add(validPatterns);
  }

  // 2. Only add patterns from .gitignore if in automatic mode
  if (ignoreMode === 'automatic') {
    const gitignorePath = safePathJoin(currentDir, '.gitignore');

    // Create a cache key for this .gitignore file
    const cacheKey = normalizePath(gitignorePath);

    let patterns = [];
    let needToProcessFile = true;

    // Check if we've already processed this .gitignore file
    if (gitIgnoreFound.has(cacheKey)) {
      patterns = gitIgnoreFound.get(cacheKey);
      needToProcessFile = false;
    }

    if (needToProcessFile) {
      try {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        patterns = content
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'));

        // Cache the patterns for future use
        if (patterns.length > 0) {
          gitIgnoreFound.set(cacheKey, patterns);

          // Get a more concise path for display
          const relativePath = safeRelativePath(rootDir, currentDir);
          console.log(
            `[IgnoreHandler] Added ${patterns.length} patterns from ${relativePath === '.' ? 'root' : relativePath} .gitignore`
          );
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('[IgnoreHandler] Error reading gitignore:', gitignorePath, err);
        }
      }
    }

    if (patterns.length > 0) {
      // Adjust patterns to be relative to current directory
      const adjustedPatterns = patterns.map((pattern) => {
        if (pattern.startsWith('/')) {
          return pattern.substring(1); // Make root-relative
        }
        if (!pattern.includes('**')) {
          // Make relative to current directory
          const relPath = safeRelativePath(rootDir, currentDir);
          return safePathJoin(relPath, pattern);
        }
        return pattern;
      });

      ig.add(adjustedPatterns);
    }
  }

  return ig;
}

/**
 * Load the ignore filter for automatic mode, caching it for future use.
 * This function will create a new ignore filter if it doesn't exist in the cache.
 * It will also log the number of patterns added from the .gitignore files.
 *
 */
async function _loadAutomaticIgnoreFilter(rootDir) {
  rootDir = ensureAbsolutePath(rootDir);
  const cacheKey = `${rootDir}:automatic`;

  if (ignoreCache.has(cacheKey)) {
    console.log('[IgnoreHandler] Using cached ignore filter for automatic mode in:', rootDir);
    const cached = ignoreCache.get(cacheKey);
    console.log('[IgnoreHandler] Cache entry details:', {
      patternCount: Object.keys(cached.patterns.gitignoreMap || {}).length,
    });
    return cached.ig;
  }
  console.log('[IgnoreHandler] Cache miss for key:', cacheKey);

  const ig = ignore();

  try {
    // Combine default patterns with excludedFiles
    const defaultPatterns = [...DEFAULT_PATTERNS, ...excludedFiles];

    ig.add(defaultPatterns);
    console.log(
      `[IgnoreHandler] Added ${DEFAULT_PATTERNS.length} default patterns and ${excludedFiles.length} excluded files`
    );

    const gitignoreMap = await collectGitignoreMapRecursive(rootDir, rootDir);
    let totalGitignorePatterns = 0;

    // Store raw patterns with their origin directory
    const patternOrigins = new Map();
    for (const [relativeDirPath, patterns] of gitignoreMap) {
      patternOrigins.set(relativeDirPath, patterns);

      // Add patterns to root filter (for backward compatibility)
      const patternsToAdd = patterns.map((pattern) => {
        if (!pattern.startsWith('/') && !pattern.includes('**')) {
          const joinedPath = normalizePath(
            path.join(relativeDirPath === '.' ? '' : relativeDirPath, pattern)
          );
          return joinedPath.replace(/^\.\//, '');
        } else if (pattern.startsWith('/')) {
          return pattern.substring(1);
        }
        return pattern;
      });

      if (patternsToAdd.length > 0) {
        ig.add(patternsToAdd);
        totalGitignorePatterns += patternsToAdd.length;
        console.log(
          `[IgnoreHandler] Added ${patternsToAdd.length} repository patterns from ${relativeDirPath}/.gitignore`
        );
      }
    }

    if (totalGitignorePatterns > 0) {
      console.log(
        `[IgnoreHandler] Added ${totalGitignorePatterns} repository-specific patterns (combined with ${defaultPatterns.length} default patterns) for:`,
        rootDir
      );
    }

    ignoreCache.set(cacheKey, {
      ig,
      patterns: {
        gitignoreMap: Object.fromEntries(gitignoreMap),
        patternOrigins: Object.fromEntries(patternOrigins),
      },
    });

    return ig;
  } catch (err) {
    console.error('[IgnoreHandler] Error in _loadAutomaticIgnoreFilter for', rootDir, err);
    return ig;
  }
}


// ======================
// GLOBAL IGNORE MODE
// ======================

function createGlobalIgnoreFilter(customIgnores = []) {
  const normalizedCustomIgnores = (customIgnores || []).map((p) => p.trim()).sort();
  const ig = ignore();
  const globalPatterns = [...DEFAULT_PATTERNS, ...excludedFiles, ...normalizedCustomIgnores].map(
    (pattern) => normalizePath(pattern)
  );
  ig.add(globalPatterns);
  console.log(
    `[IgnoreHandler] Added ${DEFAULT_PATTERNS.length} default patterns, ${excludedFiles.length} excluded files, and ${normalizedCustomIgnores.length} custom ignores`
  );

  console.log(
    `[IgnoreHandler] Added ${globalPatterns.length} global patterns (${excludedFiles.length} excluded + ${normalizedCustomIgnores.length} custom)`
  );
  console.log('[IgnoreHandler] Custom ignores added:', normalizedCustomIgnores);

  return ig;
}


// ======================
// Load Ignore Filter
// ======================

/**
 * Loads an ignore filter for the selected root directory, with optional custom ignore patterns.
 * Caches the filter for future use and handles both 'global' and 'automatic' ignore modes.
 *
 * @param {string} rootDir - The root directory to create the ignore filter for
 * @param {string[]} [customIgnores=[]] - Optional array of custom ignore patterns
 * @returns {Promise<import('ignore').Ignore>} A promise that resolves to the ignore filter instance
 */
async function loadIgnoreFilter(rootDir, customIgnores = []) {
  try {
    rootDir = normalizePath(rootDir);
    const cacheKey = `${currentIgnoreMode}:${rootDir}:${customIgnores.join(',')}`;

    if (ignoreCache.has(cacheKey)) {
      console.log(`[IgnoreHandler] Cache hit for key: ${cacheKey}`);
      return ignoreCache.get(cacheKey).ig;
    }

    let ig;
    if (currentIgnoreMode === 'global') {
      const { ig: globalIg } = createGlobalIgnoreFilter(customIgnores);
      ig = globalIg;
      ignoreCache.set(cacheKey, { ig, patterns: customIgnores });
    } else if (currentIgnoreMode === 'automatic') {
      ig = await _loadAutomaticIgnoreFilter(rootDir);
    } else {
      console.warn(`[IgnoreHandler] Unknown ignore mode: ${currentIgnoreMode}. Using default filter`);
      ig = defaultIgnoreFilter;
    }

    return ig;
  } catch (err) {
    console.error('[IgnoreHandler] Error creating ignore filter:', err);
    return defaultIgnoreFilter;
  }
}

/**
 * Internal helper function to check if a path should be ignored by a specific ignore filter.
 * @param {string} filePath - The absolute file path to check
 * @param {string} rootDir - The root directory for relative path calculation
 * @param {Object} ignoreFilterInstance - The ignore filter instance to check against
 * @returns {boolean} True if the path should be ignored, false otherwise
 */
function _checkIgnoreAgainstFilter(filePath, rootDir, ignoreFilterInstance) {
  // Validate paths to prevent empty path errors
  if (!filePath || filePath.trim() === '') {
    console.warn('[IgnoreHandler] Ignoring empty path in _checkIgnoreAgainstFilter');
    return true; // Treat empty paths as "should ignore"
  }

  const relativePath = safeRelativePath(rootDir, filePath);

  // Validate that the relative path is not empty
  if (!relativePath || relativePath.trim() === '') {
    console.warn(`[IgnoreHandler] Skipping empty relative path for: ${filePath}`);
    return true;
  }

  // First check against default patterns (fast path)
  if (defaultIgnoreFilter.ignores(relativePath)) {
    console.log('[IgnoreHandler] Skipped by default ignore patterns:', relativePath);
    return true;
  }

  // Then check against the provided ignore filter
  return ignoreFilterInstance.ignores(relativePath);
}

/**
 * Checks if a file path should be ignored based on default and provided ignore filters.
 * Utilizes the internal _checkIgnoreAgainstFilter helper function.
 * @param {string} filePath - The absolute file path to check
 * @param {string} rootDir - The root directory for relative path calculation
 * @param {string} currentDirContext - The current directory context (unused in this implementation)
 * @param {Object} ignoreFilterInstance - The ignore filter instance to check against
 * @returns {boolean} True if the path should be ignored, false otherwise
 */
function shouldIgnore(filePath, rootDir, currentDirContext, ignoreFilterInstance) {

  // The _checkIgnoreAgainstFilter function handles path normalization, validation,
  // and checks against both default and provided ignore filters.
  return _checkIgnoreAgainstFilter(filePath, rootDir, ignoreFilterInstance);
}


// ==============================
// Handle ignore mode switching
// ==============================

/**
 * Sets the ignore mode (either 'automatic' or 'global')
 * @param {string} mode - The mode to set ('automatic' or 'global')
 */
function setIgnoreMode(mode) {
  if (mode !== 'automatic' && mode !== 'global') {
    console.warn(`[IgnoreHandler] Invalid ignore mode: ${mode}. Must be 'automatic' or 'global'`);
    return;
  }

  currentIgnoreMode = mode;
  console.log(`[IgnoreHandler] Switched ignore mode to: ${mode}`);
  clearCache();
}

/**
 * Gets the current ignore mode
 * @returns {string} The current ignore mode ('automatic' or 'global')
 */
function getIgnoreMode() {
  return currentIgnoreMode;
}
/**
 * Clears both the ignore cache and gitignore found cache
 */
function clearCache() {
  ignoreCache.clear();
  gitIgnoreFound.clear();
  console.log('[IgnoreHandler] Cleared ignore caches');
}

/**
 * Gets the ignore patterns for a given folder path, either from cache or by generating new patterns.
 * @async
 * @param {string} folderPath - Absolute path to the folder
 * @param {string[]} [customIgnores=[]] - Optional array of custom ignore patterns
 * @returns {Promise<{patterns: Object}|{error: string}>} Object containing patterns or error
 */
async function getIgnorePatternsForPath(folderPath, customIgnores = []) {
  try {
    folderPath = ensureAbsolutePath(folderPath);
    const cacheKey = `${folderPath}:${currentIgnoreMode}:${customIgnores.join(',')}`;

    // Check cache first
    if (ignoreCache.has(cacheKey)) {
      const cached = ignoreCache.get(cacheKey);
      return { patterns: cached.patterns };
    }

    let patterns;
    if (currentIgnoreMode === 'global') {
      patterns = {
        global: [...DEFAULT_PATTERNS, ...excludedFiles, ...(customIgnores || [])]
      };
    } else if (currentIgnoreMode === 'automatic') {
      await _loadAutomaticIgnoreFilter(folderPath);
      const cached = ignoreCache.get(`${folderPath}:automatic`);
      patterns = cached?.patterns || { gitignoreMap: {} };
    }

    // Cache the result
    if (patterns) {
      ignoreCache.set(cacheKey, { patterns });
    }

    return { patterns: patterns || { gitignoreMap: {} } };
  } catch (err) {
    console.error('[IgnoreHandler] Error in getIgnorePatternsForPath:', err);
    return { error: err.message };
  }
}

/**
 * Gets the default ignore filter instance
 * @returns {import('ignore').Ignore} The default ignore filter instance
 */
function getDefaultIgnoreFilter() {
  return defaultIgnoreFilter;
}



/**
 * Exports the functions for use in other modules.
 *
 */
module.exports = {
  loadIgnoreFilter,
  shouldIgnore,
  setIgnoreMode,
  getIgnoreMode,
  clearCache,
  getIgnorePatternsForPath,
  shouldExcludeByDefault,
  getDefaultIgnoreFilter
};