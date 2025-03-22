const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto"); // Added for CSP nonce generation

// Global variables for directory loading control
let isLoadingDirectory = false;
let loadingTimeoutId = null;
const MAX_DIRECTORY_LOAD_TIME = 60000; // 60 seconds timeout

// Store reference to mainWindow globally so we can access it for theme updates
let mainWindow = null;
// Track current theme for DevTools sync
let currentTheme = 'light';

/**
 * Enhanced path handling functions for cross-platform compatibility
 */

/**
 * Normalize file paths to use forward slashes regardless of OS
 * This ensures consistent path formatting between main and renderer processes
 * Also handles UNC paths on Windows
 */
function normalizePath(filePath) {
  if (!filePath) return filePath;

  // Handle Windows UNC paths
  if (process.platform === 'win32' && filePath.startsWith('\\\\')) {
    // Preserve the UNC path format but normalize separators
    return '\\\\' + filePath.slice(2).replace(/\\/g, '/');
  }

  return filePath.replace(/\\/g, '/');
}

/**
 * Get the platform-specific path separator
 */
function getPathSeparator() {
  return path.sep;
}

/**
 * Ensures a path is absolute and normalized for the current platform
 * @param {string} inputPath - The path to normalize
 * @returns {string} - Normalized absolute path
 */
function ensureAbsolutePath(inputPath) {
  if (!path.isAbsolute(inputPath)) {
    inputPath = path.resolve(inputPath);
  }
  return normalizePath(inputPath);
}

/**
 * Safely joins paths across different platforms
 * @param {...string} paths - Path segments to join
 * @returns {string} - Normalized joined path
 */
function safePathJoin(...paths) {
  const joined = path.join(...paths);
  return normalizePath(joined);
}

/**
 * Safely calculates relative path between two paths
 * Handles different OS path formats and edge cases
 * @param {string} from - Base path
 * @param {string} to - Target path
 * @returns {string} - Normalized relative path
 */
function safeRelativePath(from, to) {
  // Normalize both paths to use the same separator format
  from = normalizePath(from);
  to = normalizePath(to);
  
  // Handle Windows drive letter case-insensitivity
  if (process.platform === 'win32') {
    from = from.toLowerCase();
    to = to.toLowerCase();
  }
  
  let relativePath = path.relative(from, to);
  return normalizePath(relativePath);
}

/**
 * Checks if a path is a valid path for the current OS
 * @param {string} pathToCheck - Path to validate
 * @returns {boolean} - True if path is valid
 */
function isValidPath(pathToCheck) {
  try {
    path.parse(pathToCheck);
    return true;
  } catch (err) {
    return false;
  }
}

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

// Import the excluded files list
const { excludedFiles, binaryExtensions } = require("./excluded-files");

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
].concat(binaryExtensions || []); // Add any additional binary extensions from excluded-files.js

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
      preload: path.join(__dirname, "preload.js"),
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
    const indexPath = path.join(__dirname, "dist", "index.html");
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
        const indexPath = path.join(__dirname, "dist", "index.html");
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
 * Parse .gitignore file if it exists and create an ignore filter
 * Handles path normalization for cross-platform compatibility
 * 
 * @param {string} rootDir - The root directory containing .gitignore
 * @returns {object} - Configured ignore filter
 */
function loadGitignore(rootDir) {
  // Create a default ignore filter
  let ig;
  
  try {
    ig = ignore();
  } catch (err) {
    console.error("Error creating ignore filter:", err);
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
    const gitignorePath = safePathJoin(rootDir, ".gitignore");

    if (fs.existsSync(gitignorePath)) {
      try {
        const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
        // Split content into lines and normalize path separators
        const normalizedPatterns = gitignoreContent
          .split(/\r?\n/)
          .map(pattern => pattern.trim())
          .filter(pattern => pattern && !pattern.startsWith('#'))
          .map(pattern => normalizePath(pattern));

        ig.add(normalizedPatterns);
      } catch (err) {
        console.error("Error reading .gitignore:", err);
      }
    }

    // Add some default ignores that are common
    ig.add([
      ".git",
      "node_modules",
      ".DS_Store",
      // Add Windows-specific files to ignore
      "Thumbs.db",
      "desktop.ini",
      // Add common IDE files
      ".idea",
      ".vscode",
      // Add common build directories
      "dist",
      "build",
      "out"
    ]);

    // Normalize and add the excludedFiles patterns
    if (Array.isArray(excludedFiles)) {
      const normalizedExcludedFiles = excludedFiles.map(pattern => normalizePath(pattern));
      ig.add(normalizedExcludedFiles);
    } else {
      console.warn("excludedFiles is not an array, skipping");
    }
  } catch (err) {
    console.error("Error configuring ignore filter:", err);
  }

  // Wrap the ignores function to handle errors
  const originalIgnores = ig.ignores;
  ig.ignores = (path) => {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      console.warn("Ignores called with invalid path:", path);
      return false;
    }
    
    try {
      return originalIgnores.call(ig, path);
    } catch (err) {
      console.error(`Error in ignores for path '${path}':`, err);
      return false;
    }
  };

  return ig;
}

// Check if file is binary based on extension
function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
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
  ignoreFilter = ignoreFilter || loadGitignore(rootDir);

  let results = [];
  let processedFiles = 0;
  const CHUNK_SIZE = 20;

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

    // Process directories first
    for (const dirent of directories) {
      if (!isLoadingDirectory) return results;

      const fullPath = safePathJoin(dir, dirent.name);
      // Calculate relative path safely
      const relativePath = safeRelativePath(rootDir, fullPath);

      // Skip PasteMax app directories and invalid paths
      if (fullPath.includes('.app') || fullPath === app.getAppPath() || 
          !isValidPath(relativePath) || relativePath.startsWith('..')) {
        console.log('Skipping directory:', fullPath);
        continue;
      }

      // Add the directory itself to the results
      try {
        const dirStats = await fs.promises.stat(fullPath);
        results.push({
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
        results.push({
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

      // Only process if not ignored
      try {
        // Safely check if directory should be ignored
        if (ignoreFilter && typeof ignoreFilter.ignores === 'function' && 
            relativePath && relativePath.trim() !== '' && 
            !ignoreFilter.ignores(relativePath)) {
          const subResults = await readFilesRecursively(fullPath, rootDir, ignoreFilter, window, false);
          if (!isLoadingDirectory) return results;
          if (Array.isArray(subResults)) {
            results = results.concat(subResults);
          } else {
            console.warn(`Non-array result from recursive call for ${fullPath}:`, subResults);
          }
        }
      } catch (subDirErr) {
        console.error(`Error processing subdirectory ${fullPath}:`, subDirErr);
      }

      window.webContents.send("file-processing-status", {
        status: "processing",
        message: `Scanning directories... (Press ESC to cancel)`,
      });
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

        // Early check for binary files
        if (isBinaryFile(fullPath)) {
          console.log(`Skipping binary file: ${relativePath}`);
          return null; // Skip binary files completely - don't even add them to results
        }

        // Safely check if file should be ignored
        try {
          if (ignoreFilter && typeof ignoreFilter.ignores === 'function' && 
              relativePath && relativePath.trim() !== '' && 
              ignoreFilter.ignores(relativePath)) {
            console.log(`Skipping ignored file: ${relativePath}`);
            return null; // Skip ignored files completely
          }
        } catch (ignoreErr) {
          console.error(`Error in ignore filter for ${fullPath}:`, ignoreErr);
        }

        try {
          const stats = await fs.promises.stat(fullPath);
          if (!isLoadingDirectory) return null;
          
          if (stats.size > MAX_FILE_SIZE) {
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
              error: "File too large to process"
            };
          }

          if (isBinaryFile(fullPath)) {
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

          const fileContent = await fs.promises.readFile(fullPath, "utf8");
          if (!isLoadingDirectory) return null;
          
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
        } catch (err) {
          console.error(`Error reading file ${fullPath}:`, err);
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
        message: `Processing files... ${processedFiles}/${files.length} (Press ESC to cancel)`,
      });
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

// Helper function to get basename
function basename(path) {
  if (!path) return "";
  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split('/');
  // Get the last non-empty part
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i]) return parts[i];
  }
  return "";
}

// Handle file list request
ipcMain.on("request-file-list", async (event, folderPath) => {
  try {
    console.log("Processing file list for folder:", folderPath);
    console.log("OS platform:", os.platform());
    console.log("Path separator:", getPathSeparator());

    // Set the loading flag to true
    isLoadingDirectory = true;
    
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
        
        // Await the result of readFilesRecursively
        const files = await readFilesRecursively(folderPath, folderPath, null, window, true);
        console.log(`Found ${files ? files.length : 0} files in ${folderPath}`);

        if (!files || !Array.isArray(files)) {
          console.error("Error: readFilesRecursively did not return an array");
          event.sender.send("file-processing-status", {
            status: "error",
            message: "Error: Failed to process directory structure",
          });
          return;
        }

        // Update with processing complete status
        event.sender.send("file-processing-status", {
          status: "complete",
          message: `Found ${files.length} files`,
        });

        // Process the files to ensure they're serializable
        const serializableFiles = files.map((file) => {
          // Normalize the path to use forward slashes consistently
          const normalizedPath = normalizePath(file.path);
          
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
            excludedByDefault: shouldExcludeByDefault(normalizedPath, normalizePath(folderPath)), // Also normalize folder path
            isDirectory: Boolean(file.isDirectory)
          };
        });

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
      } finally {
        // Clear the loading flag when done
        isLoadingDirectory = false;
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
    event.sender.send("file-processing-status", {
      status: "error",
      message: `Error: ${err.message}`,
    });
  }
});

// Check if a file should be excluded by default, using glob matching
function shouldExcludeByDefault(filePath, rootDir) {
  // Handle empty paths to prevent errors
  if (!filePath || !rootDir) {
    console.warn("shouldExcludeByDefault received empty path:", { filePath, rootDir });
    return false;
  }

  try {
    // Ensure both paths are normalized for consistent handling across platforms
    filePath = normalizePath(filePath);
    rootDir = normalizePath(rootDir);

    // Handle Windows drive letter case sensitivity
    if (process.platform === 'win32') {
      filePath = filePath.toLowerCase();
      rootDir = rootDir.toLowerCase();
    }

    // Use path.relative for proper cross-platform path handling
    const relativePath = path.relative(rootDir, filePath);
    const relativePathNormalized = normalizePath(relativePath);
    
    // Handle empty relative paths (root directory case)
    if (!relativePathNormalized || relativePathNormalized === '') {
      console.log("Root directory or empty path detected in shouldExcludeByDefault");
      return false; // Don't exclude the root directory itself
    }
    
    // Use the ignore package to do glob pattern matching
    try {
      const ig = ignore().add(excludedFiles);
      return ig.ignores(relativePathNormalized);
    } catch (ignoreError) {
      console.error("Error in ignore.ignores():", ignoreError);
      return false; // On ignore error, don't exclude the file
    }
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
