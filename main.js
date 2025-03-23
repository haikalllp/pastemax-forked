const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto"); // Added for CSP nonce generation
const { isBinaryFileSync } = require("isbinaryfile");

// Import shared path utilities
const { 
  normalizePath, 
  makeRelativePath, 
  ensureAbsolutePath, 
  safePathJoin, 
  safeRelativePath,
  getPathSeparator,
  basename,
  dirname,
  isWindows,
  isNode,
  isValidPath,
  join,
  extname,
  arePathsEqual,
  isSubPath,
} = require("./shared/path-utils");

// Log rootFilesToExclude to verify it's imported correctly
console.log("Imported rootFilesToExclude:", require('./excluded-files').rootFilesToExclude);

// Global variables for directory loading control
let isLoadingDirectory = false;
let loadingTimeoutId = null;
let isHandlingGitignore = false; // New flag to track gitignore processing specifically
const MAX_DIRECTORY_LOAD_TIME = 60000; // 60 seconds timeout

/**
 * Helper function to send status updates to the UI
 * @param {Electron.WebContents|Electron.IpcMainEvent} sender - Event or WebContents to send status updates to
 * @param {string} message - The status message to send
 * @param {string} status - The status type ('processing', 'complete', 'error', 'cancelled')
 * @param {boolean} [force=false] - Whether to force sending even if not in loading/gitignore state
 */
function sendStatusUpdate(sender, message, status = 'processing', force = false) {
  try {
    if (!sender) return;
    
    // Only send updates if we're in the initial loading phase, explicitly handling gitignore files, or forced
    const shouldSendUpdates = force || isLoadingDirectory || isHandlingGitignore;
    if (!shouldSendUpdates) return;
    
    const statusUpdate = {
      status: status,
      message: message
    };
    
    // Handle both WebContents and IpcMainEvent objects
    if (sender.send) {
      sender.send("file-processing-status", statusUpdate);
    } else if (sender.webContents && sender.webContents.send) {
      sender.webContents.send("file-processing-status", statusUpdate);
    }
  } catch (err) {
    console.error("Error sending status update:", err);
  }
}

// Add a cache for gitignore file paths to avoid rescanning
const gitignoreCache = new Map();
// Maximum age in milliseconds before invalidating the cache (10 minutes)
const GITIGNORE_CACHE_MAX_AGE = 10 * 60 * 1000;

// Add a cache for exclusion check results to avoid redundant processing
const exclusionCache = new Map();
// Maximum age in milliseconds before invalidating the exclusion cache (5 minutes)
const EXCLUSION_CACHE_MAX_AGE = 10 * 60 * 1000;

// Store reference to mainWindow globally so we can access it for theme updates
let mainWindow = null;
// Track current theme for DevTools sync
let currentTheme = 'light';

// Global state to track directory loading progress
let totalFilesProcessed = 0;
let totalFilesFound = 0;
let totalDirectoriesProcessed = 0;
let totalDirectoriesFound = 0;
let isDeepScanEnabled = true; // Enable this for thorough scanning, can be disabled for faster superficial scans

// Import the excluded files list and other configurations
const { 
  excludedFiles, 
  binaryExtensions, 
  skipDirectories,
  defaultIgnorePatterns,
  excludedRegexPatterns,
  rootFilesToExclude
} = require("./excluded-files");

// List of directories that should be completely skipped during traversal
// These are directories that often cause performance issues and don't provide useful content
const SKIP_DIRS = skipDirectories;

// Add handling for the 'ignore' module
let ignore;
try {
  ignore = require("ignore");
  console.log("Successfully loaded ignore module");
} catch (err) {
  console.error("Failed to load ignore module:", err);
  // Simple fallback implementation for when the ignore module fails to load
  ignore = {
    // Simple implementation that just matches exact paths
    createFilter: () => {
      return (path) => !excludedFiles.includes(path);
    },
  };
  console.log("Using fallback for ignore module");
}

// Initialize tokenizer with better error handling
let tiktoken;
try {
  tiktoken = require("tiktoken");
  console.log("Successfully loaded tiktoken module");
} catch (err) {
  console.error("Failed to load tiktoken module:", err);
  tiktoken = null;
}

// Initialize the encoder once at startup with better error handling
let encoder;
try {
  if (tiktoken) {
    encoder = tiktoken.get_encoding("o200k_base"); // gpt-4o encoding
    console.log("Tiktoken encoder initialized successfully");
  } else {
    throw new Error("Tiktoken module not available");
  }
} catch (err) {
  console.error("Failed to initialize tiktoken encoder:", err);
  // Fallback to a simpler method if tiktoken fails
  console.log("Using fallback token counter");
  encoder = null;
}

// Max file size to read (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function createWindow() {
  // Check if we're starting in safe mode (Shift key pressed)
  const isSafeMode = process.argv.includes('--safe-mode');
  const isDev = process.env.NODE_ENV === "development";
  
  // In development, suppress Electron security warnings about CSP
  // This is only for development since we need 'unsafe-eval' for Vite HMR
  if (isDev) {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
    console.log("Development mode: Security warnings about CSP are suppressed");
  } else {
    // Production security enhancements
    console.log("Production mode: Applying strict security settings");
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: safePathJoin(__dirname, "preload.js"),
      // Production security settings
      sandbox: !isDev, // Enable sandbox in production for better security
      devTools: isDev, // Only enable DevTools in development
      webSecurity: true, // Enforce web security
      additionalArguments: [`--app-path=${app.getAppPath()}`], // Pass app path for better cross-platform file resolution
    },
  });

  // Set proper Content-Security-Policy
  // This helps prevent the Insecure Content-Security-Policy warning
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    // Generate a random nonce for CSP
    const nonce = Buffer.from(crypto.randomBytes(16)).toString('base64');
    
    // Different CSP for development and production
    const isDev = process.env.NODE_ENV === "development";
    
    // Only log CSP once for main documents
    if (details.resourceType === 'mainFrame') {
      if (isDev) {
        console.log("Using development CSP with 'unsafe-eval' for Vite HMR");
      } else {
        console.log("Using production CSP with nonce-based script-src");
      }
    }
    
    let cspValue;
    if (isDev) {
      // Development policy that works with Vite's HMR
      // 'unsafe-eval' is required for Vite HMR in development mode only
      cspValue = [
        "default-src 'self';" +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;" +
        "font-src 'self' data: https://fonts.gstatic.com;" +
        "connect-src 'self' ws: wss: http://localhost:* https://localhost:*;" +
        "img-src 'self' data:;"
      ];
    } else {
      // Secure policy for production with nonce-based script-src
      cspValue = [
        "default-src 'self';" +
        `script-src 'self' 'nonce-${nonce}';` +
        "style-src 'self' 'unsafe-inline';" + // 'unsafe-inline' needed for most CSS frameworks
        "font-src 'self' data:;" +
        "connect-src 'self';" +
        "img-src 'self' data:;" +
        "object-src 'none';" + // Prevent object/embed tags
        "base-uri 'self';" + // Restrict base URIs
        "form-action 'self';" + // Restrict form submissions
        "frame-ancestors 'self';" + // Control embedding 
        "upgrade-insecure-requests;" // Upgrade HTTP to HTTPS
      ];
    }
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': cspValue,
        'X-Content-Type-Options': ['nosniff'],
        'X-XSS-Protection': ['1; mode=block'],
        'X-Frame-Options': ['SAMEORIGIN']
      }
    });
  });

  // Pass the safe mode flag to the renderer
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('startup-mode', { 
      safeMode: isSafeMode 
    });
  });

  // Register the escape key to cancel directory loading
  globalShortcut.register('Escape', () => {
    if (isLoadingDirectory) {
      cancelDirectoryLoading(mainWindow);
    }
  });

  // Clean up shortcuts when window is closed
  mainWindow.on('closed', () => {
    globalShortcut.unregisterAll();
  });

  // Listen for DevTools open events to sync theme
  mainWindow.webContents.on('devtools-opened', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('DevTools opened, applying current theme');
      // Apply current theme to DevTools
      syncDevToolsTheme(currentTheme);
    }
  });

  // Also listen for toggling DevTools via keyboard shortcut
  app.on('web-contents-created', (event, contents) => {
    contents.on('devtools-opened', () => {
      console.log('DevTools opened via shortcut, applying current theme');
      syncDevToolsTheme(currentTheme);
    });
  });

  // In development, load from Vite dev server
  // In production, load from built files
  if (process.env.NODE_ENV === "development") {
    // Use the URL provided by the dev script, or fall back to Vite's default port
    const startUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";
    // Wait a moment for dev server to be ready (increased timeout)
    setTimeout(() => {
      // Clear any cached data to prevent redirection loops
      mainWindow.webContents.session.clearCache().then(() => {
        // Set development-specific webPreferences before loading URL
        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
          // Open external links in browser, internal links in the app
          if (url.startsWith('http')) {
            return { action: 'allow' };
          }
          return { action: 'deny' };
        });
        
        mainWindow.loadURL(startUrl);
        // Open DevTools in development mode with options to reduce warnings
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        }
        // Open DevTools in the same window instead of detached
        mainWindow.webContents.openDevTools();
        console.log(`Loading from dev server at ${startUrl}`);
      });
    }, 2000);
  } else {
    const indexPath = safePathJoin(__dirname, "dist", "index.html");
    console.log(`Loading from built files at ${indexPath}`);

    // Use loadURL with file protocol for better path resolution
    const indexUrl = `file://${indexPath}`;
    mainWindow.loadURL(indexUrl);
  }

  // Add basic error handling for failed loads
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `Failed to load the application: ${errorDescription} (${errorCode})`,
      );
      console.error(`Attempted to load URL: ${validatedURL}`);

      if (process.env.NODE_ENV === "development") {
        const retryUrl =
          process.env.ELECTRON_START_URL || "http://localhost:5173";
        // Clear cache before retrying
        mainWindow.webContents.session.clearCache().then(() => {
          setTimeout(() => mainWindow.loadURL(retryUrl), 2000);
        });
      } else {
        // Retry with explicit file URL
        const indexPath = safePathJoin(__dirname, "dist", "index.html");
        const indexUrl = `file://${indexPath}`;
        mainWindow.loadURL(indexUrl);
      }
    },
  );
}

app.whenReady().then(() => {
  // Set secure app-wide defaults for production
  const isDev = process.env.NODE_ENV === "development";
  
  // Set up cache cleanup to prevent memory leaks
  setupCacheCleanup();
  
  if (!isDev) {
    // Production security settings
    
    // Prevent navigation to non-local content
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        // Only allow navigation to local content
        if (!parsedUrl.protocol.includes('file:')) {
          console.log('Blocked navigation to:', navigationUrl);
          event.preventDefault();
        }
      });
      
      // Block new window creation to external URLs
      contents.setWindowOpenHandler(({ url }) => {
        // Only allow opening windows for internal pages
        if (url.startsWith('file:')) {
          return { action: 'allow' };
        }
        // Open external URLs in the default browser instead
        if (url.startsWith('https:')) {
          setImmediate(() => {
            console.log('Opening in browser:', url);
            require('electron').shell.openExternal(url);
          });
        }
        return { action: 'deny' };
      });
    });
  }
  
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle folder selection
ipcMain.on("open-folder", async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];
    try {
      // Clear the gitignore cache since we're loading a new project
      gitignoreCache.clear();
      exclusionCache.clear(); // Also clear the exclusion cache
      console.log("Cleared gitignore and exclusion caches for new project");
      
      // Ensure we're only sending a string, not an object
      const pathString = String(selectedPath);
      console.log("Sending folder-selected event with path:", pathString);
      event.sender.send("folder-selected", pathString);
    } catch (err) {
      console.error("Error sending folder-selected event:", err);
      // Try a more direct approach as a fallback
      event.sender.send("folder-selected", String(selectedPath));
    }
  }
});

/**
 * Parse .gitignore files if they exist and create an ignore filter
 * Handles path normalization for cross-platform compatibility
 * Finds and consolidates patterns from all .gitignore files in the project
 * 
 * @param {string} rootDir - The root directory containing .gitignore files
 * @param {Electron.WebContents|Electron.IpcMainEvent} [sender] - Event or WebContents to send status updates to
 * @returns {Promise<object>} - Configured ignore filter
 */
async function loadGitignore(rootDir, sender) {
  console.log(`Loading gitignore patterns for ${rootDir}`);
  
  // Set the gitignore handling flag
  isHandlingGitignore = true;
  
  sendStatusUpdate(sender, "Finding and parsing .gitignore files...");
  
  // Create a default ignore filter
  let ig;
  
  try {
    ig = ignore();
  } catch (err) {
    console.error("Error creating ignore filter:", err);
    // Reset the gitignore handling flag
    isHandlingGitignore = false;
    // Return a simple fallback filter that doesn't ignore anything
    return {
      ignores: (path) => {
        console.log("Using fallback ignore filter for:", path);
        return false;
      }
    };
  }
  
  try {
    // Ensure root directory path is absolute and normalized
    rootDir = ensureAbsolutePath(rootDir);
    
    // Step 1: Start with default exclusion patterns from excluded-files.js
    // These are the base patterns that apply to all projects
    const defaultPatterns = [...defaultIgnorePatterns];
    console.log(`Using ${defaultPatterns.length} default exclusion patterns`);
    
    // Step 2: Find all .gitignore files in the project
    if (sender) {
      sendStatusUpdate(sender, "Scanning for .gitignore files...");
    }
    const gitignoreFiles = await findAllGitignoreFiles(rootDir, 10, sender);
    
    // Step 3: Consolidate patterns from all gitignore files
    let gitignorePatterns = [];
    if (gitignoreFiles.length > 0) {
      if (sender) {
        sendStatusUpdate(sender, `Processing ${gitignoreFiles.length} .gitignore files...`);
      }
      gitignorePatterns = await consolidateIgnorePatterns(gitignoreFiles, rootDir);
      console.log(`Consolidated ${gitignorePatterns.length} patterns from .gitignore files`);
    } else {
      console.log(`No .gitignore files found in ${rootDir}, using only default ignores`);
    }
    
    // Step 4: Merge with default patterns (giving priority to .gitignore patterns)
    if (sender) {
      sendStatusUpdate(sender, "Finalizing file exclusion patterns...");
    }
    
    // Use a Set to remove exact duplicates
    const uniquePatterns = new Set([
      ...defaultPatterns,        // Default patterns first
      ...gitignorePatterns       // Then .gitignore patterns, which will override defaults
    ]);
    
    const finalPatterns = [...uniquePatterns];
    console.log(`Final exclusion patterns: ${finalPatterns.length} unique patterns`);
    
    // Step 5: Add all patterns to the ignore filter
    ig.add(finalPatterns);
    
    console.log(`Ignore filter configured with ${finalPatterns.length} patterns`);
    
    // Reset the gitignore handling flag
    isHandlingGitignore = false;
    
    return ig;
  } catch (err) {
    console.error("Error configuring ignore filter:", err);
    
    // Reset the gitignore handling flag
    isHandlingGitignore = false;
    
    // Return a simple fallback filter that doesn't ignore anything
    return {
      ignores: (path) => {
        console.log("Using fallback ignore filter with error:", path);
        return false;
      }
    };
  }
}

// Check if file is binary based on extension or content
function isBinaryFile(filePath) {
  try {
    // First check by extension for better performance
    const ext = path.extname(filePath).toLowerCase();
    if (binaryExtensions.includes(ext)) {
      return true;
    }
    
    // Use the imported binary file detection as a backup when needed
    // Only perform content-based detection for non-excluded extensions
    // This improves performance by avoiding unnecessary file reads
    if (fs.existsSync(filePath) && fs.statSync(filePath).size < MAX_FILE_SIZE) {
      return isBinaryFileSync(filePath);
    }
    
    return false;
  } catch (err) {
    console.error(`Error in isBinaryFile check for ${filePath}:`, err);
    return false;
  }
}

// Additional function to detect binary files using content heuristics
function detectBinaryContent(buffer, sampleSize = 512) {
  // Check a small sample of the file for null bytes or non-UTF8 characters
  // This is a simple heuristic and not foolproof, but catches many binary files
  try {
    if (!buffer || buffer.length === 0) return false;
    
    // Check up to sampleSize bytes (or the whole buffer if smaller)
    const checkSize = Math.min(buffer.length, sampleSize);
    
    // Count null bytes and non-printable characters
    let nullCount = 0;
    let nonPrintableCount = 0;
    
    for (let i = 0; i < checkSize; i++) {
      const byte = buffer[i];
      if (byte === 0) nullCount++;
      // Check for non-printable characters (control characters except tabs, newlines)
      if ((byte < 9 || (byte > 10 && byte < 32)) && byte !== 13) {
        nonPrintableCount++;
      }
    }
    
    // If more than 1% nulls or 10% non-printable, likely binary
    return (nullCount / checkSize > 0.01) || (nonPrintableCount / checkSize > 0.1);
  } catch (err) {
    console.error("Error detecting binary content:", err);
    return false; // On error, assume not binary
  }
}

// Count tokens using tiktoken with o200k_base encoding
function countTokens(text) {
  // Simple fallback implementation if encoder fails
  if (!encoder) {
    return Math.ceil(text.length / 4);
  }

  try {
    // Remove any special tokens that might cause issues
    const cleanText = text.replace(/<\|endoftext\|>/g, '');
    const tokens = encoder.encode(cleanText);
    return tokens.length;
  } catch (err) {
    console.error("Error counting tokens:", err);
    // Fallback to character-based estimation on error
    return Math.ceil(text.length / 4);
  }
}

/**
 * Checks if a directory should be completely skipped
 * @param {string} dirName - The name of the directory to check
 * @returns {boolean} - True if the directory should be skipped
 */
function shouldSkipDirectory(dirName) {
  return SKIP_DIRS.includes(dirName);
}

/**
 * Recursively reads files from a directory with chunked processing and cancellation support.
 * Implements several performance and safety features:
 * - Processes files in small chunks to maintain UI responsiveness
 * - Supports immediate cancellation at any point
 * - Handles binary files and large files appropriately
 * - Respects .gitignore and custom exclusion patterns
 * - Provides progress updates to the UI
 * - Handles cross-platform path issues including UNC paths
 *
 * @param {string} dir - The directory to process
 * @param {string} rootDir - The root directory (used for relative path calculations)
 * @param {object} ignoreFilter - The ignore filter instance for file exclusions
 * @param {BrowserWindow} window - The Electron window instance for sending updates
 * @returns {Promise<Array>} Array of processed file objects
 */
async function readFilesRecursively(dir, rootDir, ignoreFilter, window, isRoot = false) {
  if (!isLoadingDirectory) return [];
  
  // Ensure absolute and normalized paths
  dir = ensureAbsolutePath(dir);
  rootDir = ensureAbsolutePath(rootDir || dir);
  
  // If ignoreFilter wasn't provided, load it
  if (!ignoreFilter) {
    ignoreFilter = await loadGitignore(rootDir, null);
  }

  let results = [];
  let processedFiles = 0;
  // Increase chunk size for better performance with large repos
  const CHUNK_SIZE = 50;
  // Limit directory depth to prevent excessive recursion
  const MAX_DEPTH = 20;
  // Tracking current depth
  const pathSeparator = getPathSeparator();
  const depth = isRoot ? 0 : (dir.split(pathSeparator).length - rootDir.split(pathSeparator).length);
  
  // Early return if we're too deep and not doing a deep scan
  if (depth > MAX_DEPTH && !isDeepScanEnabled) {
    console.log(`Reached max depth (${MAX_DEPTH}) at ${dir}, stopping traversal`);
    return [{
      name: basename(dir),
      path: normalizePath(dir),
      relativePath: safeRelativePath(rootDir, dir),
      content: "",
      tokenCount: 0,
      size: 0,
      isBinary: false,
      isSkipped: true,
      isDirectory: true,
      error: "Max directory depth reached"
    }];
  }

  // Check if this is a directory we should skip entirely
  const dirName = basename(dir);
  if (!isRoot && shouldSkipDirectory(dirName)) {
    console.log(`Skipping known problematic directory: ${dir}`);
    return [{
      name: dirName,
      path: normalizePath(dir),
      relativePath: safeRelativePath(rootDir, dir),
      content: "",
      tokenCount: 0,
      size: 0,
      isBinary: false,
      isSkipped: true,
      isDirectory: true,
      error: "Directory skipped for performance"
    }];
  }

  // Add root folder if this is the top-level call
  if (isRoot) {
    try {
      const stats = await fs.promises.stat(dir);
      const rootName = basename(dir); // Get the folder name, not the full path
      
      const rootEntry = {
        name: rootName,
        path: normalizePath(dir),
        content: "",
        tokenCount: 0,
        size: stats.size,
        isBinary: false,
        isSkipped: false,
        isDirectory: true,
        excludedByDefault: false, // EXPLICITLY set this to false - root folder should never be excluded
        relativePath: ""
      };
      
      console.log("Added root folder to file list:", rootEntry.name, rootEntry.path);
      results.push(rootEntry);
    } catch (err) {
      console.error("Error adding root folder:", err);
    }
  }

  try {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    if (!isLoadingDirectory) return results;

    const directories = dirents.filter(dirent => dirent.isDirectory());
    const files = dirents.filter(dirent => dirent.isFile());
    
    // Update counter for found files and directories
    totalFilesFound += files.length;
    totalDirectoriesFound += directories.length;

    // Process directories first, but in chunks to avoid blocking UI
    for (let i = 0; i < directories.length; i += CHUNK_SIZE) {
      if (!isLoadingDirectory) return results;
      
      const directoryChunk = directories.slice(i, i + CHUNK_SIZE);
      
      // Use Promise.all to process directory chunk in parallel
      const dirResults = await Promise.all(directoryChunk.map(async (dirent) => {
        if (!isLoadingDirectory) return null;
        
        // Quick check if this is a directory we want to completely skip
        if (shouldSkipDirectory(dirent.name)) {
          console.log(`Quickly skipping known directory: ${dirent.name}`);
          totalDirectoriesProcessed++;
          return [{
            name: dirent.name,
            path: normalizePath(safePathJoin(dir, dirent.name)),
            relativePath: safeRelativePath(rootDir, safePathJoin(dir, dirent.name)),
            content: "",
            tokenCount: 0,
            size: 0,
            isBinary: false,
            isSkipped: true,
            isDirectory: true,
            error: "Directory skipped for performance"
          }];
        }
        
        const fullPath = safePathJoin(dir, dirent.name);
        // Calculate relative path safely
        const relativePath = safeRelativePath(rootDir, fullPath);
        
        // Skip PasteMax app files and invalid paths
        if (isAppPath(fullPath, relativePath)) {
          console.log('Skipping directory:', fullPath);
          return null;
        }
        
        // FIRST CHECK: Check if directory should be excluded by .gitignore or default patterns
        try {
          // Check if directory should be excluded by default patterns
          const normalizedPath = normalizePath(fullPath);
          const shouldExclude = await shouldExcludeByDefault(normalizedPath, normalizePath(rootDir));
          
          // Check if directory should be excluded by gitignore filter
          const isIgnored = ignoreFilter && 
                           typeof ignoreFilter.ignores === 'function' && 
                           relativePath && 
                           relativePath.trim() !== '' && 
                           ignoreFilter.ignores(relativePath);
          
          // Skip the directory if it should be excluded by either pattern
          if (shouldExclude || isIgnored) {
            console.log(`Skipping excluded directory: ${relativePath}`);
            totalDirectoriesProcessed++;
            return null;
          }
        } catch (ignoreErr) {
          console.error(`Error checking exclusion patterns for directory ${fullPath}:`, ignoreErr);
        }
        
        let directoryResults = [];
        
        // Add the directory itself to the results
        try {
          const dirStats = await fs.promises.stat(fullPath);
          directoryResults.push({
            name: dirent.name,
            path: normalizePath(fullPath),
            relativePath: relativePath,
            tokenCount: 0,
            size: dirStats.size || 0,
            content: "",
            isBinary: false,
            isSkipped: false,
            isDirectory: true,
            error: null
          });
        } catch (dirErr) {
          console.error(`Error adding directory ${fullPath}:`, dirErr);
          // Still add the directory entry with default values if we can't stat it
          directoryResults.push({
            name: dirent.name,
            path: normalizePath(fullPath),
            relativePath: relativePath,
            tokenCount: 0,
            size: 0,
            content: "",
            isBinary: false,
            isSkipped: false,
            isDirectory: true,
            error: `Error reading directory: ${dirErr.message}`
          });
        }
        
        // Process contents if not in an ignored location
        try {
          // Skip certain directories that tend to be problematic
          if ((depth >= 5 && !isDeepScanEnabled)) {
            // For these, just add the directory but don't process contents
            console.log(`Skipping deep traversal of ${relativePath} at depth ${depth}`);
          } else {
            const subResults = await readFilesRecursively(fullPath, rootDir, ignoreFilter, window, false);
            if (!isLoadingDirectory) return null;
            
            if (Array.isArray(subResults)) {
              directoryResults = directoryResults.concat(subResults);
            } else {
              console.warn(`Non-array result from recursive call for ${fullPath}:`, subResults);
            }
          }
        } catch (subDirErr) {
          console.error(`Error processing subdirectory ${fullPath}:`, subDirErr);
        }
        
        totalDirectoriesProcessed++;
        return directoryResults;
      }));
      
      // Flatten and add directory results
      results = results.concat(dirResults.filter(Boolean).flat());
      
      // Update UI with progress after each chunk
      sendStatusUpdate(window.webContents, `Scanning directories... ${totalDirectoriesProcessed}/${totalDirectoriesFound} (Press ESC to cancel)`);
      
      // Add a small delay between directory chunks to keep UI responsive
      if (i + CHUNK_SIZE < directories.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Process files in chunks
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      if (!isLoadingDirectory) return results;

      const chunk = files.slice(i, i + CHUNK_SIZE);
      
      const chunkPromises = chunk.map(async (dirent) => {
        if (!isLoadingDirectory) return null;

        const fullPath = safePathJoin(dir, dirent.name);
        // Calculate relative path safely
        const relativePath = safeRelativePath(rootDir, fullPath);

        // Skip PasteMax app files and invalid paths
        if (isAppPath(fullPath, relativePath)) {
          console.log('Skipping file:', fullPath);
          return null;
        }
        
        // FIRST CHECK: Check if the file should be excluded by default patterns or gitignore
        const normalizedPath = normalizePath(fullPath);
        try {
          // Check if this is a direct child of the root folder (root file)
          const isRootFile = isRoot || (
            safeRelativePath(rootDir, fullPath) !== '' && 
            !safeRelativePath(rootDir, fullPath).includes('/') && 
            !safeRelativePath(rootDir, fullPath).includes('\\')
          );
          
          // Special handling for root files - only exclude if in rootFilesToExclude
          if (isRootFile) {
            console.log(`Root file detected during traversal: ${dirent.name}`);
            const shouldExcludeRootFile = rootFilesToExclude.includes(dirent.name);
            
            if (shouldExcludeRootFile) {
              console.log(`Root file explicitly excluded: ${dirent.name}`);
              totalFilesProcessed++;
              return null;
            } else {
              console.log(`Root file explicitly included: ${dirent.name}`);
              // Continue processing the file normally, but skip regular exclusion checks
            }
          } else {
            // Check if file should be excluded by default patterns
            const shouldExclude = await shouldExcludeByDefault(normalizedPath, normalizePath(rootDir));
            
            // Check if file should be excluded by gitignore filter
            const isIgnored = ignoreFilter && 
                            typeof ignoreFilter.ignores === 'function' && 
                            relativePath && 
                            relativePath.trim() !== '' && 
                            ignoreFilter.ignores(relativePath);
            
            // Skip the file if it should be excluded by either pattern
            if (shouldExclude || isIgnored) {
              console.log(`Skipping excluded file: ${relativePath}`);
              totalFilesProcessed++;
              return null;
            }
            
            // File passed both default and gitignore exclusion checks
            console.log(`File passed exclusion checks: ${relativePath}`);
          }
        } catch (ignoreErr) {
          console.error(`Error checking exclusion patterns for ${fullPath}:`, ignoreErr);
        }

        // SECOND CHECK: Only after the file passes exclusion checks, we check if it's binary
        try {
          const stats = await fs.promises.stat(fullPath);
          if (!isLoadingDirectory) return null;
          
          // Now check if file is binary based on extension
          const isBin = isBinaryFile(fullPath);
          
          if (stats.size > MAX_FILE_SIZE) {
            totalFilesProcessed++;
            return {
              name: dirent.name,
              path: normalizePath(fullPath),
              relativePath: relativePath,
              tokenCount: 0,
              size: stats.size,
              content: "",
              isBinary: isBin, // Mark as binary if detected by extension
              isSkipped: true,
              isDirectory: false,
              error: "File too large to process"
            };
          }

          // Always tag binary files but include them in results
          if (isBin) {
            totalFilesProcessed++;
            return {
              name: dirent.name,
              path: normalizePath(fullPath),
              relativePath: relativePath,
              tokenCount: 0,
              size: stats.size,
              content: "",
              isBinary: true,
              isSkipped: false,
              isDirectory: false,
              fileType: path.extname(fullPath).substring(1).toUpperCase()
            };
          }

          // For non-binary files, read and process content
          try {
            const fileContent = await fs.promises.readFile(fullPath, "utf8");
            if (!isLoadingDirectory) return null;
            
            totalFilesProcessed++;
            return {
              name: dirent.name,
              path: normalizePath(fullPath),
              relativePath: relativePath,
              content: fileContent,
              tokenCount: countTokens(fileContent),
              size: stats.size,
              isBinary: false,
              isSkipped: false,
              isDirectory: false
            };
          } catch (readErr) {
            // If we couldn't read as UTF-8, try to detect if it's binary
            try {
              // Read a small sample of the file as a buffer to check
              const buffer = await fs.promises.readFile(fullPath, { encoding: null, flag: 'r', length: 512 });
              const isBinaryContent = detectBinaryContent(buffer);
              
              totalFilesProcessed++;
              if (isBinaryContent) {
                return {
                  name: dirent.name,
                  path: normalizePath(fullPath),
                  relativePath: relativePath,
                  tokenCount: 0,
                  size: stats.size,
                  content: "",
                  isBinary: true,
                  isSkipped: false,
                  isDirectory: false,
                  fileType: path.extname(fullPath).substring(1).toUpperCase() || "BIN"
                };
              } else {
                // Not binary but still couldn't read as UTF-8
                return {
                  name: dirent.name,
                  path: normalizePath(fullPath),
                  relativePath: relativePath,
                  tokenCount: 0,
                  size: stats.size,
                  content: "",
                  isBinary: false,
                  isSkipped: true,
                  isDirectory: false,
                  error: "File encoding not supported"
                };
              }
            } catch (bufferErr) {
              console.error(`Error reading file buffer ${fullPath}:`, bufferErr);
              totalFilesProcessed++;
              return {
                name: dirent.name,
                path: normalizePath(fullPath),
                relativePath: relativePath,
                tokenCount: 0,
                size: stats.size,
                content: "",
                isBinary: false,
                isSkipped: true,
                isDirectory: false,
                error: "Failed to read file: " + bufferErr.message
              };
            }
          }
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
          totalFilesProcessed++;
          return {
            name: dirent.name,
            path: normalizePath(fullPath),
            relativePath: relativePath,
            tokenCount: 0,
            size: 0,
            isBinary: false,
            isSkipped: true,
            isDirectory: false,
            error: err.code === 'EPERM' ? "Permission denied" : 
                   err.code === 'ENOENT' ? "File not found" : 
                   "Could not read file"
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      if (!isLoadingDirectory) return results;
      
      results = results.concat(chunkResults.filter(result => result !== null));
      processedFiles += chunk.length;
      
      sendStatusUpdate(window.webContents, `Processing files... ${totalFilesProcessed}/${totalFilesFound} (Press ESC to cancel)`);
      
      // Add a small delay between file chunks to keep UI responsive
      if (i + CHUNK_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.log(`Skipping inaccessible directory: ${dir}`);
      return results;
    }
  }

  return results;
}

// Handle file list request
ipcMain.on("request-file-list", async (event, folderPath) => {
  try {
    console.log("Processing file list for folder:", folderPath);
    console.log("OS platform:", os.platform());
    console.log("Path separator:", getPathSeparator());

    // Reset progress counters
    resetProgressCounters();
    
    // Set the loading flag to true - this is a significant operation
    isLoadingDirectory = true;
    isHandlingGitignore = false; // Reset gitignore flag to start fresh
    
    // Get the current BrowserWindow
    const window = BrowserWindow.fromWebContents(event.sender);
    
    // Set up a safety timeout
    setupDirectoryLoadingTimeout(window, folderPath);

    // Send initial progress update
    sendStatusUpdate(event.sender, "Scanning directory structure...");

    // Process files in a way that can be properly awaited
    const processFiles = async () => {
      try {
        console.log("Starting directory scan, isLoadingDirectory =", isLoadingDirectory);
        
        // Set gitignore flag to true before loading gitignore
        isHandlingGitignore = true;
        
        // Initialize the gitignore filter once to avoid re-reading it for each directory
        // This is important to do first as it determines what files we'll skip entirely
        console.log("Initializing gitignore filters before file traversal");
        const ignoreFilter = await loadGitignore(folderPath, event);
        
        // Reset gitignore handling flag after loading
        isHandlingGitignore = false;
        
        // Log some info about the ignore filter to help with debugging
        console.log("Ignore filter initialized, proceeding with directory traversal");
        console.log("Note: Files in ignored directories will be completely skipped");
        console.log("      Binary files in non-ignored directories will be included but tagged as binary");
        console.log("      Priority: 1. Directory ignores, 2. File ignores, 3. Binary detection");
        
        // Update status now that gitignore is done
        sendStatusUpdate(event.sender, "Reading files...");
        
        // Await the result of readFilesRecursively
        const files = await readFilesRecursively(folderPath, folderPath, ignoreFilter, window, true);
        console.log(`Found ${files ? files.length : 0} files in ${folderPath}`);

        if (!files || !Array.isArray(files)) {
          console.error("Error: readFilesRecursively did not return an array");
          sendStatusUpdate(event.sender, "Error: Failed to process directory structure", "error");
          return;
        }

        // Update with processing near-complete status 
        sendStatusUpdate(event.sender, `Finalizing ${files.length} files...`);

        // Process the files to ensure they're serializable
        const serializableFiles = await Promise.all(files.map(async (file) => {
          // Normalize the path to use forward slashes consistently
          const normalizedPath = normalizePath(file.path);
          
          // Special handling for root folder - never exclude it
          const isRootFolder = arePathsEqual(normalizedPath, normalizePath(folderPath));
          
          // Check if this is a direct child of the root folder (a root file)
          const relPath = safeRelativePath(normalizePath(folderPath), normalizedPath);
          const isRootFile = !relPath.includes('/') && !relPath.includes('\\') && relPath !== '';
          
          // Only perform exclusion check if it's not the root folder or a root file
          let shouldExclude = false;
          if (!isRootFolder && !isRootFile && file.excludedByDefault !== false) {
            shouldExclude = await shouldExcludeByDefault(normalizedPath, normalizePath(folderPath));
          }
          
          // Log root folder/file handling explicitly for debugging
          if (isRootFolder) {
            console.log(`ROOT FOLDER DETECTED: ${normalizedPath}, setting excludedByDefault=false`);
          } else if (isRootFile) {
            console.log(`ROOT FILE DETECTED: ${normalizedPath}, preserving excludedByDefault=false`);
          }
          
          // Create a clean file object
          return {
            name: file.name ? String(file.name) : "",
            path: normalizedPath, // Use normalized path
            tokenCount: typeof file.tokenCount === "number" ? file.tokenCount : 0,
            size: typeof file.size === "number" ? file.size : 0,
            content: file.isBinary || file.isDirectory
              ? ""
              : typeof file.content === "string"
              ? file.content
              : "",
            isBinary: Boolean(file.isBinary),
            isSkipped: Boolean(file.isSkipped),
            error: file.error ? String(file.error) : null,
            fileType: file.fileType ? String(file.fileType) : null,
            excludedByDefault: isRootFolder || isRootFile ? false : shouldExclude,
            isDirectory: Boolean(file.isDirectory)
          };
        }));

        try {
          console.log(`Sending ${serializableFiles.length} files to renderer`);
          // Log a sample of paths to check normalization
          if (serializableFiles.length > 0) {
            console.log("Sample file paths (first 3):");
            serializableFiles.slice(0, 3).forEach(file => {
              console.log(`- Name: ${file.name}, Path: ${file.path}, isDirectory: ${file.isDirectory}`);
            });

            // Log some directory entries specifically
            const directoryEntries = serializableFiles.filter(file => file.isDirectory);
            console.log(`Found ${directoryEntries.length} directory entries`);
            if (directoryEntries.length > 0) {
              console.log("Sample directory entries (first 3):");
              directoryEntries.slice(0, 3).forEach(dir => {
                console.log(`- Name: ${dir.name}, Path: ${dir.path}, isDirectory: ${dir.isDirectory}`);
              });
            }
          }
          
          // First, send a final processing status update
          sendStatusUpdate(
            event.sender, 
            `Found ${serializableFiles.length} files (processed ${totalFilesProcessed} files in ${totalDirectoriesProcessed} directories)`,
            "complete"
          );
          
          // Then send the actual file data
          event.sender.send("file-list-data", serializableFiles);
        } catch (sendErr) {
          console.error("Error sending file data:", sendErr);

          // If sending fails, try again with minimal data
          const minimalFiles = serializableFiles.map((file) => ({
            name: file.name,
            path: file.path,
            tokenCount: file.tokenCount,
            size: file.size,
            isBinary: file.isBinary,
            isSkipped: file.isSkipped,
            excludedByDefault: file.excludedByDefault,
            isDirectory: file.isDirectory
          }));

          event.sender.send("file-list-data", minimalFiles);
        }
      } catch (error) {
        console.error("Error in file processing:", error);
        sendStatusUpdate(
          event.sender,
          `Error: ${error.message || "Unknown error during file processing"}`,
          "error"
        );
      } finally {
        // Clear the loading flag when done
        isLoadingDirectory = false;
        isHandlingGitignore = false;
        if (loadingTimeoutId) {
          clearTimeout(loadingTimeoutId);
          loadingTimeoutId = null;
        }
      }
    };

    // Use setTimeout to allow UI to update before processing starts
    setTimeout(() => processFiles(), 100);
  } catch (err) {
    console.error("Error processing file list:", err);
    isLoadingDirectory = false;
    isHandlingGitignore = false;
    sendStatusUpdate(
      event.sender,
      `Error: ${err.message}`,
      "error"
    );
  }
});

/**
 * Checks if a file should be excluded by default, using glob matching and .gitignore patterns
 * This function implements the primary exclusion logic for determining which files to show.
 * 
 * Order of operations:
 * 1. Special handling for root directory and root files
 * 2. Check against common regex patterns for excluded files (fast path)
 * 3. Check against .gitignore patterns
 * 4. Check against default excluded file patterns
 * 
 * @param {string} filePath - The file path to check
 * @param {string} rootDir - The root directory
 * @returns {Promise<boolean>} - Whether the file should be excluded
 */
async function shouldExcludeByDefault(filePath, rootDir) {
  // Handle empty paths to prevent errors
  if (!filePath || !rootDir) {
    console.warn("shouldExcludeByDefault received empty path:", { filePath, rootDir });
    return false;
  }

  try {
    // Ensure both paths are normalized for consistent handling across platforms
    filePath = normalizePath(filePath);
    rootDir = normalizePath(rootDir);

    // SPECIAL CASE: If the file path IS the root directory, never exclude it
    if (arePathsEqual(filePath, rootDir)) {
      console.log("This is the root directory itself, never exclude it");
      return false;
    }

    // Cache key combines both paths
    const cacheKey = `${rootDir}:${filePath}`;
    
    // Check cache first
    if (exclusionCache.has(cacheKey)) {
      const { result, timestamp } = exclusionCache.get(cacheKey);
      if (Date.now() - timestamp < EXCLUSION_CACHE_MAX_AGE) {
        return result;
      }
      // Cache expired, remove it
      exclusionCache.delete(cacheKey);
    }
    
    // Start the actual exclusion check logic
    // Handle Windows drive letter case sensitivity
    if (process.platform === 'win32') {
      filePath = filePath.toLowerCase();
      rootDir = rootDir.toLowerCase();
    }

    // Check if the paths are on the same drive (Windows)
    if (process.platform === 'win32') {
      const fileDrive = filePath.slice(0, 2).toLowerCase();
      const rootDrive = rootDir.slice(0, 2).toLowerCase();
      
      if (fileDrive !== rootDrive) {
        console.log(`File on different drive: ${filePath} vs ${rootDir}`);
        // Store result in cache
        exclusionCache.set(cacheKey, { result: false, timestamp: Date.now() });
        return false; // Different drives, can't be excluded by relative patterns
      }
    }

    // Calculate the relative path
    // Use our safeRelativePath for proper cross-platform path handling
    const relativePath = safeRelativePath(rootDir, filePath);
    // Then normalize to forward slashes and make it a proper relative path
    const relativePathNormalized = makeRelativePath(relativePath);
    
    // Handle empty relative paths (root directory case)
    if (!relativePathNormalized || relativePathNormalized === '') {
      console.log("Root directory or empty path detected in shouldExcludeByDefault");
      // Store result in cache
      exclusionCache.set(cacheKey, { result: false, timestamp: Date.now() });
      return false; // Don't exclude the root directory itself
    }
    
    // Special handling for files directly in root (no path separators)
    if (!relativePathNormalized.includes('/') && !relativePathNormalized.includes('\\')) {
      // Debug log for root files
      console.log(`Root file: ${relativePathNormalized}, checking against ROOT_FILES_TO_EXCLUDE`);
      
      // More detailed logging for debugging
      console.log(`ROOT_FILES_TO_EXCLUDE contains ${rootFilesToExclude.length} items`);
      console.log(`Checking if '${relativePathNormalized}' is in: ${JSON.stringify(rootFilesToExclude)}`);
      
      // Check ONLY against the specific rootFilesToExclude list for root files
      // This ensures root files are only excluded if explicitly listed
      const shouldExcludeRootFile = rootFilesToExclude.includes(relativePathNormalized);
      
      console.log(`EXCLUSION RESULT for '${relativePathNormalized}': ${shouldExcludeRootFile ? 'EXCLUDED' : 'INCLUDED'}`);
      
      if (shouldExcludeRootFile) {
        console.log(`Root file ${relativePathNormalized} explicitly excluded by ROOT_FILES_TO_EXCLUDE list`);
        exclusionCache.set(cacheKey, { result: true, timestamp: Date.now() });
        return true;
      }
      
      // If not in rootFilesToExclude, the root file should be included
      console.log(`Root file ${relativePathNormalized} NOT in ROOT_FILES_TO_EXCLUDE list, including it`);
      exclusionCache.set(cacheKey, { result: false, timestamp: Date.now() });
      return false;
    }
    
    // Check for common large/generated files that should be excluded using regex patterns
    // These are quick checks that don't require loading full patterns
    for (const pattern of excludedRegexPatterns) {
      if (pattern.test(relativePathNormalized)) {
        // Store result in cache
        exclusionCache.set(cacheKey, { result: true, timestamp: Date.now() });
        return true;
      }
    }
    
    // For non-root files, use the preloaded gitignore filter
    // Load gitignore patterns for this root directory
    const gitignoreFilter = await loadGitignore(rootDir, null);
    
    // Check if the file is ignored by gitignore patterns
    if (gitignoreFilter && typeof gitignoreFilter.ignores === 'function') {
      try {
        // Use the combined filter (default patterns + gitignore patterns)
        if (gitignoreFilter.ignores(relativePathNormalized)) {
          if (relativePathNormalized.includes('node_modules') || 
              relativePathNormalized.includes('.git/') ||
              relativePathNormalized.endsWith('.min.js')) {
            console.log(`File excluded by combined patterns: ${relativePathNormalized}`);
          }
          // Store result in cache
          exclusionCache.set(cacheKey, { result: true, timestamp: Date.now() });
          return true;
        }
      } catch (ignoreErr) {
        console.error(`Error checking gitignore for ${relativePathNormalized}:`, ignoreErr);
      }
    }
    
    // File passed all exclusion checks
    // Store result in cache
    exclusionCache.set(cacheKey, { result: false, timestamp: Date.now() });
    return false;
  } catch (error) {
    console.error("Error in shouldExcludeByDefault:", error);
    return false; // On any error, don't exclude the file
  }
}

// Add a debug handler for file selection
ipcMain.on("debug-file-selection", (event, data) => {
  console.log("DEBUG - File Selection:", data);
});

/**
 * Handles the cancellation of directory loading operations.
 * Ensures clean cancellation by:
 * - Clearing all timeouts
 * - Resetting loading flags
 * - Notifying the UI immediately
 * 
 * @param {BrowserWindow} window - The Electron window instance to send updates to
 */
function cancelDirectoryLoading(window) {
  if (!isLoadingDirectory) return;
  
  console.log("Cancelling directory loading process immediately");
  isLoadingDirectory = false;
  
  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
    loadingTimeoutId = null;
  }
  
  // Send cancellation message immediately
  sendStatusUpdate(window.webContents, "Directory loading cancelled", "cancelled", true);
}

/**
 * Sets up a safety timeout for directory loading operations.
 * Prevents infinite loading by automatically cancelling after MAX_DIRECTORY_LOAD_TIME.
 * 
 * @param {BrowserWindow} window - The Electron window instance
 * @param {string} folderPath - The path being processed (for logging)
 */
function setupDirectoryLoadingTimeout(window, folderPath) {
  // Clear any existing timeout
  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
  }
  
  // Set a new timeout
  loadingTimeoutId = setTimeout(() => {
    console.log(`Directory loading timed out after ${MAX_DIRECTORY_LOAD_TIME / 1000} seconds: ${folderPath}`);
    cancelDirectoryLoading(window);
  }, MAX_DIRECTORY_LOAD_TIME);
}

// Add IPC listener for theme changes
ipcMain.on("theme-changed", (event, theme) => {
  // Store the current theme
  currentTheme = theme;
  
  // Apply theme to DevTools if they're open
  syncDevToolsTheme(theme);
});

/**
 * Synchronizes the DevTools appearance with the application theme
 * @param {string} theme - The current theme ('light' or 'dark')
 */
function syncDevToolsTheme(theme) {
  // Only proceed if we're in development mode
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) {
    return; // DevTools aren't enabled in production
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  // Ensure DevTools are open before trying to access them
  if (!mainWindow.webContents.isDevToolsOpened()) {
    console.log('DevTools not open, skipping theme sync');
    return;
  }
  
  const devTools = mainWindow.webContents.devToolsWebContents;
  if (!devTools) {
    console.log('DevTools WebContents not available');
    return;
  }
  
  try {
    console.log(`Applying ${theme} theme to DevTools`);
    
    // Apply dark theme CSS when in dark mode
    if (theme === 'dark') {
      devTools.insertCSS(`
        :root, :host {
          --toolbar-bg: #1e1e1e;
          --toolbar-color: #e8e8e8;
          --toolbar-border: #3e3e42;
          --searchable-view-bg: #252526;
          --input-bg: #333333;
          --input-color: #e8e8e8;
          --input-border: #3e3e42;
          --panel-bg: #1e1e1e;
          --panel-color: #e8e8e8;
          --panel-item-hover: #333333;
          --tab-selected-bg: #0e639c;
          --tab-selected-color: white;
          --search-match-bg: rgba(255, 255, 0, 0.2);
        }
        
        body.platform-windows .monospace, 
        body.platform-windows .source-code,
        body.platform-linux .monospace, 
        body.platform-linux .source-code,
        body.platform-mac .monospace, 
        body.platform-mac .source-code {
          font-family: Consolas, Menlo, Monaco, "Courier New", monospace !important;
        }

        .platform-windows #console-prompt .CodeMirror.CodeMirror-focused.cm-focused,
        .platform-linux #console-prompt .CodeMirror.CodeMirror-focused.cm-focused,
        .platform-mac #console-prompt .CodeMirror.CodeMirror-focused.cm-focused {
          background-color: #333333 !important;
        }
      `).catch(err => console.error('Error injecting dark mode CSS:', err));
      
      // Use executeJavaScript to add dark-mode class
      devTools.executeJavaScript(`
        document.documentElement.classList.add('dark-mode');
        document.body.classList.add('dark-mode');
      `).catch(err => console.error('Error adding dark-mode class:', err));
    } else {
      // Remove dark theme and reset to default light theme
      devTools.executeJavaScript(`
        document.documentElement.classList.remove('dark-mode');
        document.body.classList.remove('dark-mode');
      `).catch(err => console.error('Error removing dark-mode class:', err));
    }
  } catch (err) {
    console.error('Failed to sync DevTools theme:', err);
  }
}

// Reset the progress counters when starting a new directory scan
function resetProgressCounters() {
  totalFilesProcessed = 0;
  totalFilesFound = 0;
  totalDirectoriesProcessed = 0;
  totalDirectoriesFound = 0;
}

/**
 * Checks if any of the cached gitignore files have been modified
 * @param {string} rootDir - The root directory
 * @returns {Promise<boolean>} - Returns true if any files were modified
 */
async function checkGitignoreFilesChanged(rootDir) {
  if (!gitignoreCache.has(rootDir)) {
    return true; // No cache, consider it changed
  }
  
  const { timestamp, files } = gitignoreCache.get(rootDir);
  
  // Check if any of the cached files have been modified
  for (const filePath of files) {
    try {
      const stats = await fs.promises.stat(filePath);
      const lastModified = stats.mtimeMs;
      
      if (lastModified > timestamp) {
        console.log(`Gitignore file changed: ${filePath}`);
        return true;
      }
    } catch (err) {
      console.error(`Error checking file modification time for ${filePath}:`, err);
      // If we can't check, assume it changed
      return true; 
    }
  }
  
  return false;
}

/**
 * Find all .gitignore files in a project directory structure
 * @param {string} rootDir - The root directory to start searching from
 * @param {number} maxDepth - Maximum depth to search (default: 10)
 * @param {Electron.WebContents|Electron.IpcMainEvent} [sender] - Event or WebContents to send status updates to
 * @returns {Promise<Array<string>>} - Array of paths to .gitignore files
 */
async function findAllGitignoreFiles(rootDir, maxDepth = 10, sender = null) {
  console.log(`Finding all .gitignore files in ${rootDir} (max depth: ${maxDepth})`);
  
  // Check the cache first
  const cacheKey = rootDir;
  if (gitignoreCache.has(cacheKey)) {
    const { timestamp, files } = gitignoreCache.get(cacheKey);
    
    sendStatusUpdate(sender, "Checking for changes in .gitignore files...");
    
    // Check if files have been modified
    const filesChanged = await checkGitignoreFilesChanged(rootDir);
    
    // Use cached results if they're not too old and files haven't changed
    if (Date.now() - timestamp < GITIGNORE_CACHE_MAX_AGE && !filesChanged) {
      console.log(`Using cached gitignore files for ${rootDir} (${files.length} files)`);
      return files;
    }
    if (filesChanged) {
      console.log(`Gitignore files changed, rescanning for ${rootDir}`);
      sendStatusUpdate(sender, "Detected changes in .gitignore files, rescanning...");
    } else {
      console.log(`Cache expired for ${rootDir}, rescanning for gitignore files`);
      sendStatusUpdate(sender, "Refreshing .gitignore cache...");
    }
  }

  const gitignoreFiles = [];
  const dirsToSkip = new Set(SKIP_DIRS);
  
  sendStatusUpdate(sender, "Scanning directories for .gitignore files...");
  
  // Helper function to recursively find gitignore files
  async function findGitignoreInDir(dir, currentDepth = 0) {
    if (currentDepth > maxDepth) {
      return; // Stop if we've reached the maximum depth
    }
    
    // Check if we should skip this directory
    const dirName = basename(dir);
    if (dirsToSkip.has(dirName)) {
      return; // Skip this directory
    }
    
    try {
      // Check if there's a .gitignore file in this directory
      const gitignorePath = safePathJoin(dir, '.gitignore');
      try {
        await fs.promises.access(gitignorePath, fs.constants.F_OK);
        gitignoreFiles.push(gitignorePath);
        sendStatusUpdate(sender, `Found .gitignore in ${dirName}`);
      } catch (e) {
        // No .gitignore in this directory, continue
      }
      
      // Read the directory entries
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      // Process subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && !dirsToSkip.has(entry.name)) {
          await findGitignoreInDir(safePathJoin(dir, entry.name), currentDepth + 1);
        }
      }
    } catch (err) {
      console.error(`Error scanning directory ${dir} for gitignore files:`, err);
    }
  }
  
  try {
    sendStatusUpdate(sender, "Starting deep scan for .gitignore files...");
    await findGitignoreInDir(rootDir);
    
    // Update the cache with the newly found files
    gitignoreCache.set(cacheKey, {
      timestamp: Date.now(),
      files: gitignoreFiles
    });
    
    console.log(`Found ${gitignoreFiles.length} .gitignore files in ${rootDir}`);
    return gitignoreFiles;
  } catch (error) {
    console.error("Error finding gitignore files:", error);
    sendStatusUpdate(sender, "Error finding .gitignore files", "error");
    return [];
  }
}

/**
 * Read and parse a gitignore file
 * @param {string} filePath - Path to the gitignore file
 * @param {string} rootDir - The root directory of the project
 * @returns {Object} - Object containing patterns and metadata
 */
async function readGitignoreFile(filePath, rootDir) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const dirPath = dirname(filePath);
    const relativeDir = safeRelativePath(rootDir, dirPath);
    const normalizedRelativeDir = normalizePath(relativeDir);
    
    // Parse patterns from the file
    const patterns = content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Remove comments and empty lines
    
    return {
      path: filePath,
      dirPath,
      relativeDir: normalizedRelativeDir,
      patterns,
      isRootGitignore: dirPath === rootDir
    };
  } catch (err) {
    console.error(`Error reading gitignore file ${filePath}:`, err);
    return {
      path: filePath,
      dirPath: dirname(filePath),
      patterns: [],
      error: err.message
    };
  }
}

/**
 * Consolidate patterns from multiple gitignore files
 * @param {Array<string>} gitignoreFiles - Array of paths to gitignore files
 * @param {string} rootDir - The root directory of the project
 * @returns {Promise<Array<string>>} - Consolidated list of unique patterns
 */
async function consolidateIgnorePatterns(gitignoreFiles, rootDir) {
  console.log(`Consolidating patterns from ${gitignoreFiles.length} gitignore files`);
  
  // Map to store unique patterns with their sources
  const patternMap = new Map();
  // Set to track patterns that should be negated
  const negatedPatterns = new Set();
  
  // Process each gitignore file
  for (const filePath of gitignoreFiles) {
    const gitignoreData = await readGitignoreFile(filePath, rootDir);
    const { patterns, relativeDir, isRootGitignore } = gitignoreData;
    
    if (patterns.length === 0) continue;
    
    console.log(`Processing ${patterns.length} patterns from ${filePath}`);
    
    // Process each pattern
    for (let pattern of patterns) {
      // Handle negation
      const isNegated = pattern.startsWith('!');
      if (isNegated) {
        pattern = pattern.substring(1);
      }
      
      // Normalize pattern
      let normalizedPattern = normalizePath(pattern);
      
      // For non-root gitignore files, adjust patterns to be relative to the root
      if (!isRootGitignore && relativeDir && !pattern.startsWith('/')) {
        // Don't prefix if the pattern is already absolute or explicitly specific to its directory
        if (!pattern.includes('/')) {
          // Pattern applies to any file with this name in any subdirectory
          // Keep it as is
        } else {
          // Pattern is relative to the gitignore file's directory
          normalizedPattern = path.posix.join(relativeDir, normalizedPattern);
        }
      }
      
      // Store pattern with its source for debugging
      if (isNegated) {
        negatedPatterns.add(normalizedPattern);
      } else {
        patternMap.set(normalizedPattern, {
          source: filePath,
          original: pattern
        });
      }
    }
  }
  
  // Create the final list of patterns
  const consolidatedPatterns = [];
  
  // Add non-negated patterns
  for (const [pattern, metadata] of patternMap.entries()) {
    if (!negatedPatterns.has(pattern)) {
      consolidatedPatterns.push(pattern);
    }
  }
  
  // Add negated patterns last so they take precedence
  negatedPatterns.forEach(pattern => {
    consolidatedPatterns.push(`!${pattern}`);
  });
  
  console.log(`Consolidated to ${consolidatedPatterns.length} unique patterns`);
  // Log some sample patterns for debugging
  if (consolidatedPatterns.length > 0) {
    console.log("Sample consolidated patterns:", consolidatedPatterns.slice(0, 5));
  }
  
  return consolidatedPatterns;
}

// Handle directory loading cancellation
ipcMain.on("cancel-directory-loading", (event) => {
  console.log("Directory loading cancelled by user");
  
  // Set the loading flag to false to stop any ongoing operations
  isLoadingDirectory = false;
  isHandlingGitignore = false;
  
  // Clear any loading timeout
  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
    loadingTimeoutId = null;
  }
  
  // Notify the renderer that the operation was cancelled
  sendStatusUpdate(event.sender, "Operation cancelled by user", "cancelled", true);
});

/**
 * Checks if a path should be skipped because it's part of the app itself
 * @param {string} path - The path to check
 * @param {string} [relativePath] - Optional relative path to also check
 * @returns {boolean} - True if the path should be skipped
 */
function isAppPath(path, relativePath) {
  // Check the main path
  if (path.includes('.app') || path === app.getAppPath()) {
    return true;
  }
  
  // Check the relative path if provided
  if (relativePath) {
    return !isValidPath(relativePath) || relativePath.startsWith('..');
  }
  
  return false;
}

// Add scheduled cache cleanup to prevent memory leaks
function setupCacheCleanup() {
  // Clean up stale cache entries every 15 minutes
  const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
  
  // Set up periodic cleanup
  setInterval(() => {
    const now = Date.now();
    
    // Clean up exclusion cache
    let expiredExclusionEntries = 0;
    exclusionCache.forEach((entry, key) => {
      if (now - entry.timestamp > EXCLUSION_CACHE_MAX_AGE) {
        exclusionCache.delete(key);
        expiredExclusionEntries++;
      }
    });
    
    // Clean up gitignore cache
    let expiredGitignoreEntries = 0;
    gitignoreCache.forEach((entry, key) => {
      if (now - entry.timestamp > GITIGNORE_CACHE_MAX_AGE) {
        gitignoreCache.delete(key);
        expiredGitignoreEntries++;
      }
    });
    
    // Log results if any entries were cleaned up
    if (expiredExclusionEntries > 0 || expiredGitignoreEntries > 0) {
      console.log(`Cache cleanup: removed ${expiredExclusionEntries} exclusion entries and ${expiredGitignoreEntries} gitignore entries`);
    }
  }, CLEANUP_INTERVAL);
  
  console.log(`Scheduled cache cleanup every ${CLEANUP_INTERVAL / (60 * 1000)} minutes`);
}
