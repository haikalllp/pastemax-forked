const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto"); // Added for CSP nonce generation

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

// Global variables for directory loading control
let isLoadingDirectory = false;
let loadingTimeoutId = null;
let isHandlingGitignore = false; // New flag to track gitignore processing specifically
const MAX_DIRECTORY_LOAD_TIME = 60000; // 60 seconds timeout

// Add a cache for gitignore file paths to avoid rescanning
const gitignoreCache = new Map();
// Maximum age in milliseconds before invalidating the cache (10 minutes)
const GITIGNORE_CACHE_MAX_AGE = 10 * 60 * 1000;

// Add a cache for file exclusion decisions to avoid redundant checks
const pathExclusionCache = new Map();
// Maximum size of the exclusion cache to prevent memory issues
const PATH_EXCLUSION_CACHE_MAX_SIZE = 10000;

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
  excludedRegexPatterns
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

// Binary file extensions that should be excluded from token counting
// Use the centralized list from excluded-files.js and add any built-in defaults
const BINARY_EXTENSIONS = [
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico",
  ".icns",
  ".webp",
  ".svg",
  ".heic",
  ".heif",
  ".pdf",
  ".psd",
  // Audio/Video
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".avi",
  ".mov",
  ".mkv",
  ".flac",
  // Archives
  ".zip",
  ".rar",
  ".tar",
  ".gz",
  ".7z",
  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  // Compiled
  ".exe",
  ".dll",
  ".so",
  ".class",
  ".o",
  ".pyc",
  // Database
  ".db",
  ".sqlite",
  ".sqlite3",
  // Others
  ".bin",
  ".dat",
].concat(binaryExtensions || []); // Add extensions from excluded-files.js

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
      console.log("Cleared gitignore cache for new project");
      
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
  
  // Only send status updates if we're still in the initial loading phase or explicitly handling gitignore files
  const shouldSendUpdates = isLoadingDirectory || isHandlingGitignore;
  
  // Set the gitignore handling flag
  isHandlingGitignore = true;
  
  // Send processing status update if we have a sender and should send updates
  const sendStatusUpdate = (message) => {
    try {
      if (sender && shouldSendUpdates) {
        const statusUpdate = {
          status: "processing",
          message: message
        };
        
        // Handle both WebContents and IpcMainEvent objects
        if (sender.send) {
          sender.send("file-processing-status", statusUpdate);
        } else if (sender.webContents && sender.webContents.send) {
          sender.webContents.send("file-processing-status", statusUpdate);
        }
      }
    } catch (err) {
      console.error("Error sending gitignore status update:", err);
    }
  };
  
  if (shouldSendUpdates) {
    sendStatusUpdate("Finding and parsing .gitignore files...");
  }
  
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
    
    // Step 1: Find all .gitignore files in the project
    if (shouldSendUpdates) {
      sendStatusUpdate("Scanning for .gitignore files...");
    }
    const gitignoreFiles = await findAllGitignoreFiles(rootDir, 10, shouldSendUpdates ? sender : null);
    
    // Step 2: Consolidate patterns from all gitignore files
    let consolidatedPatterns = [];
    if (gitignoreFiles.length > 0) {
      if (shouldSendUpdates) {
        sendStatusUpdate(`Processing ${gitignoreFiles.length} .gitignore files...`);
      }
      consolidatedPatterns = await consolidateIgnorePatterns(gitignoreFiles, rootDir);
    } else {
      console.log(`No .gitignore files found in ${rootDir}, using only default ignores`);
    }
    
    // Step 3: Merge with default ignores and excluded files
    if (shouldSendUpdates) {
      sendStatusUpdate("Finalizing file exclusion patterns...");
    }
    const finalPatterns = mergeWithDefaultIgnores(consolidatedPatterns);
    
    // Step 4: Add all patterns to the ignore filter
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

// Check if file is binary based on extension
function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
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
        
        // Skip PasteMax app directories and invalid paths
        if (fullPath.includes('.app') || fullPath === app.getAppPath() || 
            !isValidPath(relativePath) || relativePath.startsWith('..')) {
          console.log('Skipping directory:', fullPath);
          return null;
        }
        
        // Check if directory should be ignored first - prioritize ignores over anything else
        try {
          if (ignoreFilter && typeof ignoreFilter.ignores === 'function' && 
              relativePath && relativePath.trim() !== '' && 
              ignoreFilter.ignores(relativePath)) {
            console.log(`Skipping ignored directory: ${relativePath}`);
            totalDirectoriesProcessed++;
            return null; // Skip ignored directories completely without any further processing
          }
        } catch (ignoreErr) {
          console.error(`Error in ignore filter for directory ${fullPath}:`, ignoreErr);
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
      window.webContents.send("file-processing-status", {
        status: "processing",
        message: `Scanning directories... ${totalDirectoriesProcessed}/${totalDirectoriesFound} (Press ESC to cancel)`,
      });
      
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
        if (fullPath.includes('.app') || fullPath === app.getAppPath() || 
            !isValidPath(relativePath) || relativePath.startsWith('..')) {
          console.log('Skipping file:', fullPath);
          return null;
        }

        // Safely check if file should be ignored - do this check first before any file processing
        try {
          if (ignoreFilter && typeof ignoreFilter.ignores === 'function' && 
              relativePath && relativePath.trim() !== '' && 
              ignoreFilter.ignores(relativePath)) {
            console.log(`Skipping ignored file: ${relativePath}`);
            totalFilesProcessed++;
            return null; // Skip ignored files completely without any further processing
          }
        } catch (ignoreErr) {
          console.error(`Error in ignore filter for ${fullPath}:`, ignoreErr);
        }

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
      
      window.webContents.send("file-processing-status", {
        status: "processing",
        message: `Processing files... ${totalFilesProcessed}/${totalFilesFound} (Press ESC to cancel)`,
      });
      
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
    event.sender.send("file-processing-status", {
      status: "processing",
      message: "Scanning directory structure...",
    });

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
        event.sender.send("file-processing-status", {
          status: "processing",
          message: "Reading files...",
        });
        
        // Await the result of readFilesRecursively
        const files = await readFilesRecursively(folderPath, folderPath, ignoreFilter, window, true);
        console.log(`Found ${files ? files.length : 0} files in ${folderPath}`);

        if (!files || !Array.isArray(files)) {
          console.error("Error: readFilesRecursively did not return an array");
          event.sender.send("file-processing-status", {
            status: "error",
            message: "Error: Failed to process directory structure",
          });
          return;
        }

        // Update with processing near-complete status 
        event.sender.send("file-processing-status", {
          status: "processing",
          message: `Finalizing ${files.length} files...`,
        });

        // Process the files to ensure they're serializable
        const serializableFiles = await Promise.all(files.map(async (file) => {
          // Normalize the path to use forward slashes consistently
          const normalizedPath = normalizePath(file.path);
          
          // Check if we should exclude this file by default
          const shouldExclude = shouldExcludeByDefault(normalizedPath);
          
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
            excludedByDefault: shouldExclude, // Use the result of shouldExcludeByDefault
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
          event.sender.send("file-processing-status", {
            status: "complete",
            message: `Found ${serializableFiles.length} files (processed ${totalFilesProcessed} files in ${totalDirectoriesProcessed} directories)`,
          });
          
          // Then send the actual file data
          event.sender.send("file-list-data", serializableFiles);
          
          // Clean up the path exclusion cache
          cleanupPathExclusionCache();
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
        event.sender.send("file-processing-status", {
          status: "error",
          message: `Error: ${error.message || "Unknown error during file processing"}`,
        });
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
    event.sender.send("file-processing-status", {
      status: "error",
      message: `Error: ${err.message}`,
    });
  }
});

/**
 * Checks if a file should be excluded by default, using fast pattern matching
 * @param {string} relativePath - The normalized relative file path to check
 * @returns {boolean} - Whether the file should be excluded
 */
function shouldExcludeByDefault(relativePath) {
  if (!relativePath) {
    return false;
  }

  try {
    // Create a cache key for this path
    const cacheKey = `exclude:${relativePath}`;
    
    // Check cache first (fast path)
    if (pathExclusionCache.has(cacheKey)) {
      return pathExclusionCache.get(cacheKey);
    }
    
    // Skip binary files by default - fast check using extension
    const ext = path.extname(relativePath).toLowerCase();
    if (BINARY_EXTENSIONS.includes(ext)) {
      pathExclusionCache.set(cacheKey, true);
      return true;
    }
    
    // Quick regex check for common excluded patterns - this is much faster than glob matching
    // These patterns match things like node_modules, .git, etc.
    for (const pattern of excludedRegexPatterns) {
      if (pattern.test(relativePath)) {
        pathExclusionCache.set(cacheKey, true);
        return true;
      }
    }
    
    // Quick check for common excluded directories by path segments
    const pathParts = relativePath.split('/');
    for (const part of pathParts) {
      if (SKIP_DIRS.includes(part)) {
        pathExclusionCache.set(cacheKey, true);
        return true;
      }
    }
    
    // Check for common file patterns that should be excluded
    const fileName = path.basename(relativePath);
    
    // Exclude files with multiple dots (often generated files)
    // but avoid excluding actual source files with multiple dots (like component.test.js)
    const dots = fileName.split('.').length - 1;
    if (dots > 2 && !fileName.match(/\.(js|jsx|ts|tsx|vue|py|java|c|cpp|cs|rb|go|rs|php|swift|kt|scala)$/i)) {
      pathExclusionCache.set(cacheKey, true);
      return true;
    }
    
    // All checks passed, this file should not be excluded
    pathExclusionCache.set(cacheKey, false);
    return false;
  } catch (err) {
    console.error("Error in shouldExcludeByDefault:", err);
    return false; // On error, don't exclude
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
  window.webContents.send("file-processing-status", {
    status: "cancelled",
    message: "Directory loading cancelled",
  });
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
  
  // Only send updates if we're in initial loading or explicitly handling gitignore
  const shouldSendUpdates = isLoadingDirectory || isHandlingGitignore;
  
  // Send processing status update if we have a sender and should send updates
  const sendStatusUpdate = (message) => {
    try {
      if (sender && shouldSendUpdates) {
        const statusUpdate = {
          status: "processing",
          message: message
        };
        
        // Handle both WebContents and IpcMainEvent objects
        if (sender.send) {
          sender.send("file-processing-status", statusUpdate);
        } else if (sender.webContents && sender.webContents.send) {
          sender.webContents.send("file-processing-status", statusUpdate);
        }
      }
    } catch (err) {
      console.error("Error sending gitignore status update:", err);
    }
  };
  
  // Check the cache first
  const cacheKey = rootDir;
  if (gitignoreCache.has(cacheKey)) {
    const { timestamp, files } = gitignoreCache.get(cacheKey);
    
    if (shouldSendUpdates) {
      sendStatusUpdate("Checking for changes in .gitignore files...");
    }
    
    // Check if cache is still valid (not expired and files haven't changed)
    const cacheAge = Date.now() - timestamp;
    const cacheExpired = cacheAge > GITIGNORE_CACHE_MAX_AGE;
    
    // Only check for file changes if cache hasn't expired
    // This avoids unnecessary file stats operations
    let filesChanged = false;
    if (!cacheExpired) {
      filesChanged = await checkGitignoreFilesChanged(rootDir);
    }
    
    // Use cached results if they're not too old and files haven't changed
    if (!cacheExpired && !filesChanged) {
      console.log(`Using cached gitignore files for ${rootDir} (${files.length} files)`);
      return files;
    }
    
    if (filesChanged) {
      console.log(`Gitignore files changed, rescanning for ${rootDir}`);
      if (shouldSendUpdates) {
        sendStatusUpdate("Detected changes in .gitignore files, rescanning...");
      }
    } else {
      console.log(`Cache expired for ${rootDir}, rescanning for gitignore files`);
      if (shouldSendUpdates) {
        sendStatusUpdate("Refreshing .gitignore cache...");
      }
    }
  }

  const gitignoreFiles = [];
  const dirsToSkip = new Set(SKIP_DIRS);
  
  if (shouldSendUpdates) {
    sendStatusUpdate("Scanning directories for .gitignore files...");
  }
  
  // Use a faster non-recursive search with a queue
  // This avoids call stack size issues with deep directories
  async function findGitignoreNonRecursive() {
    const queue = [{ dir: rootDir, depth: 0 }];
    const processed = new Set(); // Track processed directories to avoid duplicates
    
    // Process at most 1000 directories to prevent excessive searching
    // This is a reasonable limit for most projects
    const MAX_DIRS_TO_PROCESS = 1000;
    let dirsProcessed = 0;
    
    // Prioritize key locations for gitignore files
    // Most projects have .gitignore in root, src, and a few other key places
    const KEY_LOCATIONS = ['/', '/src', '/app', '/backend', '/frontend', '/client', '/server', '/api', '/web', '/ui'];
    for (const loc of KEY_LOCATIONS) {
      const keyPath = safePathJoin(rootDir, loc.startsWith('/') ? loc.substring(1) : loc);
      const gitignorePath = safePathJoin(keyPath, '.gitignore');
      try {
        if (await fs.promises.access(gitignorePath, fs.constants.F_OK).then(() => true).catch(() => false)) {
          gitignoreFiles.push(gitignorePath);
          if (shouldSendUpdates) {
            sendStatusUpdate(`Found .gitignore in key location: ${loc}`);
          }
        }
      } catch (error) {
        // Silently ignore access errors - this is just a preemptive check for common locations
        // The full directory scan will still find any existing gitignore files
      }
    }
    
    while (queue.length > 0 && dirsProcessed < MAX_DIRS_TO_PROCESS) {
      const { dir, depth } = queue.shift();
      
      // Skip if we've already processed this directory or reached max depth
      const normalizedDir = normalizePath(dir);
      if (processed.has(normalizedDir) || depth > maxDepth) continue;
      processed.add(normalizedDir);
      
      dirsProcessed++;
      
      // Check if we should skip this directory
      const dirName = basename(dir);
      if (dirsToSkip.has(dirName)) continue;
      
      try {
        // Check for .gitignore (skip if already found in key locations check)
        const gitignorePath = safePathJoin(dir, '.gitignore');
        if (!gitignoreFiles.includes(gitignorePath)) {
          if (await fs.promises.access(gitignorePath, fs.constants.F_OK).then(() => true).catch(() => false)) {
            gitignoreFiles.push(gitignorePath);
          }
        }
        
        // Only process more directories if we're not at max depth
        if (depth < maxDepth) {
          // Read the directory entries
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          
          // At shallower depths, process all directories
          // At deeper depths, only process directories likely to contain project code
          const depthFilter = depth <= 2 
              ? (entry) => !dirsToSkip.has(entry.name)  // Less restrictive at shallow depths
              : (entry) => {  // More restrictive at deeper depths
                  // Skip directories likely to be non-source code
                  if (dirsToSkip.has(entry.name)) return false;
                  
                  // Skip directories that start with dot or underscore at deeper levels
                  if (depth > 3 && (entry.name.startsWith('.') || entry.name.startsWith('_'))) {
                    return false;
                  }
                  
                  // Prioritize directories likely to contain source code
                  return true;
              };
          
          // Add subdirectories to the queue
          for (const entry of entries) {
            if (entry.isDirectory() && depthFilter(entry)) {
              queue.push({ 
                dir: safePathJoin(dir, entry.name), 
                depth: depth + 1 
              });
            }
          }
        }
      } catch (err) {
        // Gracefully skip directories we can't read
        continue;
      }
    }
  }
  
  try {
    if (shouldSendUpdates) {
      sendStatusUpdate("Scanning for .gitignore files...");
    }
    
    await findGitignoreNonRecursive();
    
    // Update the cache with the newly found files
    gitignoreCache.set(cacheKey, {
      timestamp: Date.now(),
      files: gitignoreFiles
    });
    
    console.log(`Found ${gitignoreFiles.length} .gitignore files in ${rootDir}`);
    return gitignoreFiles;
  } catch (error) {
    console.error("Error finding gitignore files:", error);
    if (shouldSendUpdates) {
      sendStatusUpdate("Error finding .gitignore files");
    }
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

/**
 * Merge consolidated gitignore patterns with default exclusion patterns
 * @param {Array<string>} consolidatedPatterns - Patterns from gitignore files
 * @returns {Array<string>} - Final merged patterns with duplicates removed
 */
function mergeWithDefaultIgnores(consolidatedPatterns) {
  // Use a Map instead of a Set for potential performance benefits
  // with large numbers of patterns
  const uniquePatterns = new Map();
  
  // Count patterns by type for reporting
  let defaultCount = 0;
  let excludedFilesCount = 0;
  let gitignoreCount = 0;
  
  // Add patterns to Map with type information
  
  // First add gitignore patterns (highest priority)
  for (const pattern of consolidatedPatterns) {
    if (!uniquePatterns.has(pattern)) {
      uniquePatterns.set(pattern, 'gitignore');
      gitignoreCount++;
    }
  }
  
  // Then add excluded-files.js patterns (medium priority)
  if (Array.isArray(excludedFiles)) {
    for (const pattern of excludedFiles) {
      if (!uniquePatterns.has(pattern)) {
        uniquePatterns.set(pattern, 'excluded-files');
        excludedFilesCount++;
      }
    }
  }
  
  // Finally add default patterns (lowest priority)
  for (const pattern of defaultIgnorePatterns) {
    if (!uniquePatterns.has(pattern)) {
      uniquePatterns.set(pattern, 'default');
      defaultCount++;
    }
  }
  
  // Convert back to array
  const mergedPatterns = Array.from(uniquePatterns.keys());
  
  // Log some stats, but only when we have a significant number of patterns
  // to avoid excessive logging
  if (mergedPatterns.length > 10) {
    console.log(`Merged patterns - Total: ${mergedPatterns.length}`);
    console.log(`- From gitignore files: ${gitignoreCount}`);
    console.log(`- From excluded-files.js: ${excludedFilesCount}`);
    console.log(`- Default: ${defaultCount}`);
  }
  
  return mergedPatterns;
}

// Add isValidPath function for backward compatibility
// This should be removed when we're confident everything uses the shared module
function _isValidPath(pathToCheck) {
  try {
    return isValidPath(pathToCheck);
  } catch (err) {
    return false;
  }
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
  event.sender.send("file-processing-status", {
    status: "cancelled",
    message: "Operation cancelled by user",
  });
});

/**
 * Cleans up the path exclusion cache when it gets too large
 * This prevents memory issues over long sessions
 */
function cleanupPathExclusionCache() {
  if (pathExclusionCache.size > PATH_EXCLUSION_CACHE_MAX_SIZE) {
    console.log(`Cleaning up path exclusion cache (size: ${pathExclusionCache.size})`);
    // Simple approach: just clear the whole cache when it gets too big
    pathExclusionCache.clear();
  }
}

/**
 * Get file information for a given path
 * @param {string} filePath - Absolute path to the file
 * @param {Object} rootDirInfo - Information about the root directory
 * @param {string} rootDirInfo.path - Path to the root directory
 * @param {number} rootDirInfo.rootPathLength - Length of the root path string
 * @param {Object} ignoreFilter - The ignore filter to use for excluding files
 * @returns {Object|null} - File object or null if should be skipped
 */
function getFileInfo(filePath, rootDirInfo, ignoreFilter) {
  try {
    // Quick check for common hidden files (OS dependent, faster than full regex)
    const basename = path.basename(filePath);
    if (basename.startsWith('.') || basename === 'node_modules' || basename === 'dist') {
      return null;
    }

    // Get fs.Stats object with file info
    const fileStat = fs.statSync(filePath);
    
    // Path calculations (only do these once)
    const relativePath = filePath.slice(rootDirInfo.rootPathLength);
    const relativePathNormalized = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    
    // Skip files excluded by our default patterns (fast sync check)
    if (shouldExcludeByDefault(relativePathNormalized)) {
      return null;
    }
    
    // Skip files excluded by gitignore patterns (if filter provided)
    if (ignoreFilter && ignoreFilter.ignores && ignoreFilter.ignores(relativePathNormalized)) {
      return null;
    }
    
    // Create the file object
    const fileObj = {
      path: filePath,
      isDirectory: fileStat.isDirectory(),
      size: fileStat.size,
      // Only compute these if we need them
      relativePath,
      relativePathNormalized,
      name: basename,
      extension: path.extname(filePath).toLowerCase(),
      lastModified: fileStat.mtime.getTime()
    };
    
    return fileObj;
  } catch (err) {
    // Silently ignore errors for files we can't access
    return null;
  }
}

// Inside the list-files handler
ipcMain.on("list-files", async (event, rootDir) => {
  try {
    console.time("list-files");
    // Skip if rootDir is invalid
    if (!rootDir || typeof rootDir !== "string") {
      event.sender.send("file-list-data", []);
      return;
    }

    // Normalize root dir path
    rootDir = path.normalize(rootDir);
    // Create root dir info object to avoid recalculating
    const rootDirInfo = {
      path: rootDir,
      // Cache the root path length so we don't keep recalculating
      rootPathLength: rootDir.endsWith(path.sep) ? rootDir.length : rootDir.length + 1
    };

    // Get gitignore patterns using the existing function
    console.time("gitignore-scan");
    const ignoreFilter = await loadGitignore(rootDir, event);
    console.timeEnd("gitignore-scan");

    // Start collecting files (limit scanning depth to prevent issues)
    const MAX_DEPTH = 15;
    const allFiles = [];
    const dirsToProcess = [{ path: rootDir, depth: 0 }];

    while (dirsToProcess.length > 0) {
      const currentDir = dirsToProcess.shift();
      
      // Skip directories beyond max depth
      if (currentDir.depth > MAX_DEPTH) {
        continue;
      }
      
      try {
        const entries = fs.readdirSync(currentDir.path, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir.path, entry.name);
          const fileInfo = getFileInfo(fullPath, rootDirInfo, ignoreFilter);
          
          // Skip files that were filtered out
          if (!fileInfo) {
            continue;
          }
          
          // Add directories to be processed
          if (fileInfo.isDirectory) {
            dirsToProcess.push({ 
              path: fullPath, 
              depth: currentDir.depth + 1 
            });
          }
          
          // Add to results
          allFiles.push(fileInfo);
        }
      } catch (err) {
        // Skip inaccessible directories silently
        continue;
      }
    }
    
    console.log(`Found ${allFiles.length} files/directories`);
    console.timeEnd("list-files");
    
    // Convert to a serializable format before sending
    const serializableFiles = allFiles.map(file => {
      // Remove non-serializable properties if any
      const { ...serializableFile } = file;
      return serializableFile;
    });
    
    // Then send the actual file data
    event.sender.send("file-list-data", serializableFiles);
    
    // Clean up the path exclusion cache
    cleanupPathExclusionCache();
  } catch (sendErr) {
    console.error("Error sending file data:", sendErr);
  }
});
