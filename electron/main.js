// ======================
// IMPORTS AND CONSTANTS
// ======================
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { default: PQueue } = require('p-queue'); // Added for controlled concurrency
const watcher = require('./watcher.js'); // New watcher module

// Load Configurations Constants from config.js
const {
  MAX_DIRECTORY_LOAD_TIME,
  MAX_FILE_SIZE,
  CONCURRENT_DIRS,
  STATUS_UPDATE_INTERVAL,
  DEFAULT_PATTERNS,
  excludedFiles,
  binaryExtensions
} = require('./config.js');

// ======================
// GLOBAL STATE
// ======================
let isLoadingDirectory = false;
let loadingTimeoutId = null;

/**
 * @typedef {Object} DirectoryLoadingProgress
 * @property {number} directories - Number of directories processed
 * @property {number} files - Number of files processed
 */
let currentProgress = { directories: 0, files: 0 };

// Throttling for status updates
let lastStatusUpdateTime = 0;

// ======================
// MODULE INITIALIZATION
// ======================

// ======================
// PATH UTILITIES
// ======================
const {
  normalizePath,
  ensureAbsolutePath,
  safePathJoin,
  safeRelativePath,
  isValidPath
} = require('./utils.js');

// ======================
// FILE PROCESSING
// ======================



async function processDirectory({
  dirent,
  dir,
  rootDir,
  ignoreFilter,
  window,
  progress,
  currentDir = dir,
  ignoreMode = 'automatic',
  fileQueue = null,
}) {

  await watcher.shutdownWatcher();
  const fullPath = safePathJoin(dir, dirent.name);
  const relativePath = safeRelativePath(rootDir, fullPath);


  if (
    fullPath.includes('.app') ||
    fullPath === app.getAppPath() ||
    !isValidPath(relativePath) ||
    relativePath.startsWith('..')
  ) {
    console.log('Skipping directory:', fullPath);
    return { results: [], progress };
  }

  if (!ignoreFilter.ignores(relativePath)) {
    progress.directories++;
    await watcher.initializeWatcher(dir, window, ignoreFilter);
    window.webContents.send('file-processing-status', {
      status: 'processing',
      message: `Scanning directories (${progress.directories} processed)... (Press ESC to cancel)`,
    });
    return readFilesRecursively(
      fullPath,
      rootDir,
      ignoreFilter,
      window,
      progress,
      fullPath,
      ignoreMode,
      fileQueue
    );
  }
  return { results: [], progress };
}

async function readFilesRecursively(
  dir,
  rootDir,
  ignoreFilter,
  window,
  progress = { directories: 0, files: 0 },
  currentDir = dir,
  ignoreMode = 'automatic',
  fileQueue = null
) {

  await watcher.shutdownWatcher();
  if (!ignoreFilter) {
    throw new Error('readFilesRecursively requires an ignoreFilter parameter');
  }
  if (!isLoadingDirectory) return { results: [], progress };

  dir = ensureAbsolutePath(dir);
  rootDir = ensureAbsolutePath(rootDir || dir);

  // Initialize queue only once at the top level call
  let shouldCleanupQueue = false;
  let queueToUse = fileQueue;
  if (!queueToUse) {
    // Determine concurrency based on CPU cores, with a reasonable minimum and maximum
    const cpuCount = os.cpus().length;
    const fileQueueConcurrency = Math.max(2, Math.min(cpuCount, 8)); // e.g., Use between 2 and 8 concurrent file operations
    queueToUse = new PQueue({ concurrency: fileQueueConcurrency });
    shouldCleanupQueue = true;

    // Only log the initialization message for the root directory to reduce spam
    if (dir === rootDir) {
      console.log(`Initializing file processing queue with concurrency: ${fileQueueConcurrency}`);
    }
  }

  let results = [];
  let fileProcessingErrors = []; // To collect errors without stopping

  try {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    if (!isLoadingDirectory) return { results: [], progress };

    const directories = dirents.filter((dirent) => dirent.isDirectory());
    const files = dirents.filter((dirent) => dirent.isFile());

    for (let i = 0; i < directories.length; i += CONCURRENT_DIRS) {
      if (!isLoadingDirectory) return { results: [], progress };

      const batch = directories.slice(i, Math.min(i + CONCURRENT_DIRS, directories.length));

      const batchPromises = batch.map((dirent) =>
        processDirectory({
          dirent,
          dir,
          rootDir,
          ignoreFilter,
          window,
          progress,
          currentDir,
          ignoreMode,
          fileQueue,
        })
      );

      const batchResults = await Promise.all(batchPromises);

      const combinedResults = batchResults.reduce(
        (acc, curr) => {
          acc.results = acc.results.concat(curr.results);
          return acc;
        },
        { results: [], progress }
      );

      results = results.concat(combinedResults.results);
      if (!isLoadingDirectory) return { results: [], progress };
    }

    // Process files using the controlled concurrency queue
    for (const dirent of files) {
      if (!isLoadingDirectory) break; // Check cancellation before adding to queue

      queueToUse.add(async () => {
        if (!isLoadingDirectory) return; // Check cancellation again inside the task

        const fullPath = safePathJoin(dir, dirent.name);
        const relativePath = safeRelativePath(rootDir, fullPath);

        try {
          // Use the processFile function from file-processor.js
          const { processFile } = require('./file-processor.js');
          const fileData = await processFile(fullPath, rootDir);

          if (!isLoadingDirectory) return; // Check cancellation after processing

          // Add the processed file data to results if not skipped due to ignore filter (processFile handles other skips)
          // Note: processFile now handles ignore checks internally based on the rootDir and file path
          // We still need the outer ignoreFilter check here because processFile is designed for single file processing
          // and the recursive directory traversal needs to respect the filter at the directory level.
          // However, the instruction was to remove the inline processing and use processFile,
          // which implies processFile should handle the ignore logic. Let's assume processFile
          // from the previous step already incorporates the ignore logic based on the rootDir.
          // If not, this will need adjustment in file-processor.js in a future step.
          // For now, we rely on processFile to return null or a skipped status if ignored.

          // Re-checking ignoreFilter here to be safe, although ideally processFile would handle it.
          if (!ignoreFilter.ignores(relativePath)) {
             results.push(fileData);
             progress.files++;
          } else {
             // If ignored by the filter here, and processFile didn't mark it as skipped,
             // we should probably mark it as skipped or just not add it to results.
             // Let's just not add it to results if the outer filter ignores it.
             // This might lead to a slight discrepancy if processFile *did* process it
             // but the outer filter says ignore. We'll stick to the outer filter's decision for now.
             // console.log('Ignored by filter after processing:', relativePath); // Can be noisy
          }


        } catch (err) {
          console.error(`Error processing file ${fullPath} using processFile:`, err.code || err.message);
          // Handle errors from processFile if needed, though processFile should ideally return error status
          const errorData = {
            name: dirent.name,
            path: normalizePath(fullPath),
            relativePath: relativePath,
            tokenCount: 0,
            size: 0,
            isBinary: false,
            isSkipped: true,
            error: `Error processing: ${err.message}`,
          };
           results.push(errorData); // Add error entry to results
           progress.files++; // Count errors as processed files for progress
           fileProcessingErrors.push({ path: normalizePath(fullPath), error: err.message });
        }

        // Throttle status updates (moved outside finally)
        const now = Date.now();
        if (now - lastStatusUpdateTime > STATUS_UPDATE_INTERVAL) {
          if (!isLoadingDirectory) return; // Check cancellation before sending IPC
          window.webContents.send('file-processing-status', {
            status: 'processing',
            message: `Processing files (${progress.directories} dirs, ${progress.files} files)... (Press ESC to cancel)`,
          });
          lastStatusUpdateTime = now;
          if (progress.files % 500 === 0) {
            // Log less frequently
            console.log(
              `Progress update - Dirs: ${progress.directories}, Files: ${progress.files}, Queue Size: ${queueToUse.size}, Pending: ${queueToUse.pending}`
            );
          }
        }
      });
    }

    // Wait for all queued file processing tasks to complete
    await queueToUse.onIdle();

    if (fileProcessingErrors.length > 0) {
      console.warn(`Encountered ${fileProcessingErrors.length} errors during file processing.`);
      // Optionally send a summary of errors to the renderer
      // window.webContents.send("file-processing-errors", fileProcessingErrors);
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.log(`Skipping inaccessible directory: ${dir}`);
      return { results: [], progress };
    }
  }

  // Cleanup queue if it was initialized in this call
  if (shouldCleanupQueue) {
    await queueToUse.onIdle();
    queueToUse.clear();
  }

  return { results, progress };
}

// ======================
// DIRECTORY LOADING MANAGEMENT
// ======================
function setupDirectoryLoadingTimeout(window, folderPath) {
  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
  }

  loadingTimeoutId = setTimeout(() => {
    console.log(
      `Directory loading timed out after ${MAX_DIRECTORY_LOAD_TIME / 1000} seconds: ${folderPath}`
    );
    console.log(
      `Stats at timeout: Processed ${currentProgress.directories} directories and ${currentProgress.files} files`
    );
    cancelDirectoryLoading(window, 'timeout');
  }, MAX_DIRECTORY_LOAD_TIME);

  currentProgress = { directories: 0, files: 0 };
}

async function cancelDirectoryLoading(window, reason = 'user') {
  await watcher.shutdownWatcher();
  if (!isLoadingDirectory) return;

  console.log(`Cancelling directory loading process (Reason: ${reason})`);
  console.log(
    `Stats at cancellation: Processed ${currentProgress.directories} directories and ${currentProgress.files} files`
  );

  isLoadingDirectory = false;

  if (loadingTimeoutId) {
    clearTimeout(loadingTimeoutId);
    loadingTimeoutId = null;
  }

  currentProgress = { directories: 0, files: 0 };

  if (window && window.webContents && !window.webContents.isDestroyed()) {
    const message =
      reason === 'timeout'
        ? 'Directory loading timed out after 5 minutes. Try clearing data and retrying.'
        : 'Directory loading cancelled';

    window.webContents.send('file-processing-status', {
      status: 'cancelled',
      message: message,
    });
  } else {
    console.log('Window not available to send cancellation status.');
  }
}

// ======================
// IPC HANDLERS
// ======================
ipcMain.on('clear-main-cache', () => {
  console.log('Clearing main process caches');
  // Caches are now managed by file-processor.js, clear them via its function
  const { clearFileCache } = require('./file-processor.js');
  clearFileCache();
  console.log('Main process caches cleared (via file-processor.js)');
});


ipcMain.on('open-folder', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    const rawPath = result.filePaths[0];
    const normalizedPath = normalizePath(rawPath);
    try {
      console.log('Sending folder-selected event with normalized path:', normalizedPath);
      event.sender.send('folder-selected', normalizedPath);
    } catch (err) {
      console.error('Error sending folder-selected event:', err);
      event.sender.send('folder-selected', normalizedPath);
    }
  }
});


ipcMain.on('cancel-directory-loading', (event) => {
  cancelDirectoryLoading(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.on('debug-file-selection', (event, data) => {
  console.log('DEBUG - File Selection:', data);
});

ipcMain.on('request-file-list', async (event, folderPath) => {
  console.log('Received request-file-list payload:', folderPath); // Log the entire payload

  if (isLoadingDirectory) {
    console.log('Already processing a directory, ignoring new request for:', folderPath);
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window && window.webContents && !window.webContents.isDestroyed()) {
      window.webContents.send('file-processing-status', {
        status: 'busy',
        message: 'Already processing another directory. Please wait.',
      });
    }
    return;
  }

  try {
    isLoadingDirectory = true;
    setupDirectoryLoadingTimeout(BrowserWindow.fromWebContents(event.sender), folderPath);

    event.sender.send('file-processing-status', {
      status: 'processing',
      message: 'Scanning directory structure... (Press ESC to cancel)',
    });

    currentProgress = { directories: 0, files: 0 };


    const ignoreFilter = require('ignore')().add([...DEFAULT_PATTERNS, ...excludedFiles]);
    console.log('Using default ignore patterns');

    const { results: files } = await readFilesRecursively(
      folderPath.folderPath,
      folderPath.folderPath,
      ignoreFilter,
      BrowserWindow.fromWebContents(event.sender),
      currentProgress,
      folderPath.folderPath,
      'automatic'
    );

    if (!isLoadingDirectory) {
      return;
    }

    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }
    isLoadingDirectory = false;

    event.sender.send('file-processing-status', {
      status: 'complete',
      message: `Found ${files.length} files`,
    });

    const serializedFiles = files
      .filter((file) => {
        if (typeof file?.path !== 'string') {
          console.warn('Invalid file object in files array:', file);
          return false;
        }
        return true;
      })
      .map((file) => {
        return {
          path: file.path,
          relativePath: file.relativePath,
          name: file.name,
          size: file.size,
          isDirectory: file.isDirectory,
          extension: path.extname(file.name).toLowerCase(),
          excluded: false,
          content: file.content,
          tokenCount: file.tokenCount,
          isBinary: file.isBinary,
          isSkipped: file.isSkipped,
          error: file.error,
        };
      });

    event.sender.send('file-list-data', serializedFiles);
  } catch (err) {
    console.error('Error processing file list:', err);
    isLoadingDirectory = false;

    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }

    event.sender.send('file-processing-status', {
      status: 'error',
      message: `Error: ${err.message}`,
    });
  } finally {
    isLoadingDirectory = false;
    if (loadingTimeoutId) {
      clearTimeout(loadingTimeoutId);
      loadingTimeoutId = null;
    }
  }
});

// ======================
// ELECTRON WINDOW SETUP
// ======================
console.log('--- createWindow() ENTERED ---');
let mainWindow;
function createWindow() {
  const isSafeMode = process.argv.includes('--safe-mode');

  // Set CSP header for all environments
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:* ws://localhost:*; object-src 'none';",
        ],
      },
    });
  });
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: {
        isDevToolsExtension: false,
        htmlFullscreen: false,
      },
      // Always enable security
      // Disable manually for testing
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Set up window event handlers
  mainWindow.on('closed', async () => {
    await watcher.shutdownWatcher();
    mainWindow = null; // Now allowed since mainWindow is let
  });

  app.on('before-quit', async (event) => {
    await watcher.shutdownWatcher();
  });

  app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
      await watcher.shutdownWatcher();
      app.quit();
    }
  });

  // handle Escape locally (only when focused), not globally
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // only intercept Esc when our window is focused and a load is in progress
    if (input.key === 'Escape' && isLoadingDirectory) {
      cancelDirectoryLoading(mainWindow);
      event.preventDefault(); // stop further in-app handling
    }
  });

  // Only verify file existence in production mode
  if (process.env.NODE_ENV !== 'development') {
    // Verify file exists before loading
    const prodPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Production path:', prodPath);
    try {
      fs.accessSync(prodPath, fs.constants.R_OK);
      console.log('File exists and is readable');
    } catch (err) {
      console.error('File access error:', err);
    }
  }

  // Clean up watcher when window is closed
  mainWindow.on('closed', () => {
    // Watcher cleanup is now handled by the watcher module itself
  });

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('startup-mode', {
      safeMode: isSafeMode,
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const prodPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
      : path.join(__dirname, 'dist', 'index.html');

    console.log('--- PRODUCTION LOAD ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('app.isPackaged:', app.isPackaged);
    console.log('__dirname:', __dirname);
    console.log('Resources Path:', process.resourcesPath);
    console.log('Attempting to load file:', prodPath);
    console.log('File exists:', fs.existsSync(prodPath));

    mainWindow
      .loadFile(prodPath)
      .then(() => {
        console.log('Successfully loaded index.html');
        mainWindow.webContents.on('did-finish-load', () => {
          console.log('Finished loading all page resources');
        });
      })
      .catch((err) => {
        console.error('Failed to load index.html:', err);
        // Fallback to showing error page
        mainWindow.loadURL(
          `data:text/html,<h1>Loading Error</h1><p>${encodeURIComponent(err.message)}</p>`
        );
      });
  }
}

// ======================
// APP LIFECYCLE
// ======================
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Exports for file processing functions
const { processFile, clearFileCache } = require('./file-processor.js');

module.exports = {
  createWindow,
  setupDirectoryLoadingTimeout,
  cancelDirectoryLoading,
  readFilesRecursively,
  processDirectory,
  processFile,
  clearFileCache,
};
