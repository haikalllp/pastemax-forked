Okay, let's break down the refactoring plan for the Electron backend, focusing on modularity and maintainability while preserving functionality.

## PRD & Refactoring Plan: Electron Backend Modularization

**1. High Level Objective**

Refactor the existing Electron backend codebase (primarily `main.js`) into smaller, single-responsibility modules. The goals are to improve code organization, readability, testability, and maintainability, adhering to file size limits (ideally < 300 lines, max ~500 for complex orchestrators) without altering the application's current behavior or features. This involves separating concerns like Electron app management, IPC communication, file system operations (directory scanning, file processing), ignore pattern handling, configuration, and state management.

**2. Type Changes**

No fundamental changes to data structures are required *for functionality*. However, for clarity and potentially future TypeScript adoption, we should *consider* formally defining interfaces for data passed between modules and via IPC, even if just in JSDoc comments initially.

*   **`FileMetadata`**: Define the structure returned by file processing (currently implicit in `processSingleFile` and the final mapping in `request-file-list` handler).
    ```js
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
    ```
*   **`DirectoryScanProgress`**: Formalize the progress object structure.
    ```js
    /**
     * @typedef {Object} DirectoryScanProgress
     * @property {number} directories - Count of directories processed.
     * @property {number} files - Count of files processed (including skipped/errors).
     */
    ```
*   **`IgnoreHandlerInterface`**: Define the expected methods exported by the ignore module.
    ```js
    /**
     * @typedef {Object} IgnoreHandlerInterface
     * @property {function(string): Promise<import('ignore').Ignore>} loadIgnoreFilter - Loads/retrieves filter for a root path (considering current mode).
     * @property {function(string, string, import('ignore').Ignore): boolean} shouldIgnore - Checks if a path should be ignored relative to root/context.
     * @property {function('automatic' | 'global'): void} setIgnoreMode - Sets the current ignore mode.
     * @property {function(): ('automatic' | 'global')} getIgnoreMode - Gets the current ignore mode.
     * @property {function(): void} clearCache - Clears the ignore cache.
     * @property {function(string, string[]): Promise<object>} getIgnorePatternsForPath - Gets raw patterns for display/debug.
     * @property {import('ignore').Ignore} defaultIgnoreFilter - The globally applicable default filter instance.
     */
    ```
*   Define interfaces for other modules similarly (`DirectoryProcessorInterface`, `FileProcessorInterface`, etc.) to clarify dependencies.

**3. Method Changes (Signatures & Responsibilities)**

*   **`main.js`**:
    *   `createWindow`: Responsibility remains largely the same (window creation, basic lifecycle, CSP). Will become much shorter as logic moves out.
    *   ***Removed/Moved***: All IPC handlers (`ipcMain.on`/`handle`).
    *   ***Removed/Moved***: `readFilesRecursively`, `processDirectory`, `loadGitignore`, `shouldIgnorePath`, `createContextualIgnoreFilter`, `createGlobalIgnoreFilter`, `collectGitignoreMapRecursive`, `processSingleFile`, `isBinaryFile`, `countTokens`, `shouldExcludeByDefault`.
    *   ***Removed/Moved***: State variables like `currentIgnoreMode`, `isLoadingDirectory`, `loadingTimeoutId`, `currentProgress`, and caches.
    *   ***Retained***: App lifecycle event handlers (`app.whenReady`, `app.on('activate')`, `app.on('window-all-closed')`, `app.on('before-quit')`), `mainWindow` management. It will *import* and *initialize* or *call* methods from the new modules.
*   **`directory-processor.js`**:
    *   `scanDirectory(folderPath, options)`: New main function to initiate a scan.
        *   `options`: `{ window: BrowserWindow, ignoreHandler: IgnoreHandlerInterface, fileProcessor: FileProcessorInterface, config: ConfigObject, watcher: WatcherInterface }` (Dependency Injection).
        *   Returns `Promise<FileMetadata[]>`.
        *   Manages `isLoadingDirectory`, `loadingTimeoutId`, `currentProgress` internally for the scan process.
        *   Handles sending `file-processing-status` updates via the passed `window`.
        *   Uses `PQueue`.
        *   Calls `ignoreHandler.shouldIgnore` and `fileProcessor.processFile`.
        *   Calls `watcher.initializeWatcher` at the start (potentially) and interacts for cancellation.
    *   `cancelScan(reason)`: Cancels the ongoing scan, clears timeouts.
    *   Internal helpers derived from `readFilesRecursively` and `processDirectory`.
*   **`file-processor.js`**:
    *   `processFile(fullPath, rootDir, options)`: Replaces `processSingleFile`.
        *   `options`: `{ config: ConfigObject, ignoreHandler: IgnoreHandlerInterface }`
        *   Returns `Promise<FileMetadata>`.
        *   Handles stat, size checks, binary checks, reading content, token counting.
        *   Uses `tiktoken`, manages `fileTypeCache`. Manages `fileCache` for metadata/content caching.
    *   `isBinary(filePath)`: Determines if a file is binary (using `binaryExtensions` from config).
    *   `countFileTokens(text)`: Counts tokens using `tiktoken` or fallback.
*   **`ignore-handler.js`**:
    *   `loadIgnoreFilter(rootDir, customIgnores = [])`: Loads or retrieves the appropriate ignore filter based on `currentIgnoreMode`. Handles caching (`ignoreCache`). Returns an `ignore` instance.
    *   `shouldIgnore(filePath, rootDir, currentDirContext, ignoreFilterInstance)`: Encapsulates the logic from the old `shouldIgnorePath`, potentially simplified based on the filter instance provided by `loadIgnoreFilter`. Handles contextual filtering (`.gitignore` in subdirs) if in 'automatic' mode. Uses `gitIgnoreFound` cache.
    *   `setIgnoreMode(mode)`: Updates internal state and potentially clears caches.
    *   `getIgnoreMode()`: Returns the current mode.
    *   `clearCache()`: Clears `ignoreCache` and `gitIgnoreFound`.
    *   `getIgnorePatternsForPath(folderPath, customIgnores = [])`: Retrieves raw patterns for display purposes (replaces the logic inside the old `get-ignore-patterns` handler).
    *   `getDefaultIgnoreFilter()`: Returns the pre-compiled `defaultIgnoreFilter`.
    *   Internal helpers derived from `createGlobalIgnoreFilter`, `createContextualIgnoreFilter`, `collectGitignoreMapRecursive`. Manages `currentIgnoreMode` state.
*   **`ipc-manager.js`**:
    *   `registerHandlers(options)`: Registers all `ipcMain` listeners.
        *   `options`: `{ windowManager: WindowManagerInterface, directoryProcessor: DirectoryProcessorInterface, ignoreHandler: IgnoreHandlerInterface, cacheManager: CacheManagerInterface }`
    *   Individual handler functions that delegate calls to the appropriate modules (e.g., `handleOpenFolder`, `handleRequestFileList`, `handleSetIgnoreMode`, `handleCancelLoading`, `handleClearCache`).
*   **`watcher.js`**:
    *   `initializeWatcher(folderPath, options)`: Signature might change to accept dependencies explicitly.
        *   `options`: `{ window: BrowserWindow, ignoreHandler: IgnoreHandlerInterface, fileProcessor: FileProcessorInterface }`
        *   The `ignored` function will use `ignoreHandler.shouldIgnore`.
        *   Event handlers (`add`, `change`, `unlink`) will call `fileProcessor.processFile` for added/changed files and send IPC messages (`file-added`, `file-updated`, `file-removed`).
    *   `shutdownWatcher`: Remains largely the same.
*   **`cache-manager.js`**: (Optional but recommended)
    *   `clearAllCaches()`: Calls clear methods on `ignoreHandler`, `fileProcessor`, etc.
    *   Could potentially manage the lifecycle of other caches if needed.

**4. Modularisation Plan**

1.  **`config.js`**:
    *   **Purpose**: Centralize all constants and configuration data.
    *   **Contents**: Move `MAX_DIRECTORY_LOAD_TIME`, `MAX_FILE_SIZE`, `CONCURRENT_DIRS`, `STATUS_UPDATE_INTERVAL`, `DEFAULT_PATTERNS`. Import and re-export `excludedFiles` and `binaryExtensions` from `excluded-files.js`.
    *   **Dependencies**: `os`, `path`, `./excluded-files.js`.
2.  **`utils.js`**:
    *   **Purpose**: General utility functions, primarily path manipulation.
    *   **Contents**: Keep `normalizePath`, `ensureAbsolutePath`, `safePathJoin`, `safeRelativePath`, `isValidPath`.
    *   **Dependencies**: `path`.
3.  **`ignore-handler.js`**:
    *   **Purpose**: Encapsulate all logic related to file/directory ignore patterns (.gitignore, defaults, modes).
    *   **Contents**: Implement methods described in "Method Changes". Manage `currentIgnoreMode`, `ignoreCache`, `gitIgnoreFound`, `defaultIgnoreFilter`. Contains logic from `loadGitignore`, `shouldIgnorePath`, `create*Filter`, `collectGitignoreMapRecursive`, `shouldExcludeByDefault`.
    *   **Dependencies**: `ignore`, `fs`, `path`, `./utils.js`, `./config.js`.
4.  **`file-processor.js`**:
    *   **Purpose**: Handle processing of individual files (reading, stats, binary check, token counting, caching).
    *   **Contents**: Implement methods described in "Method Changes". Manage `fileCache`, `fileTypeCache`. Use `tiktoken`. Contains logic from `processSingleFile`, `isBinaryFile`, `countTokens`.
    *   **Dependencies**: `fs`, `path`, `tiktoken`, `./utils.js`, `./config.js`, `./ignore-handler.js`.
5.  **`directory-processor.js`**:
    *   **Purpose**: Manage the recursive scanning of directories, orchestrate file processing, handle progress, timeouts, and cancellation.
    *   **Contents**: Implement methods described in "Method Changes". Use `PQueue`. Manage scan-specific state (`isLoadingDirectory`, `loadingTimeoutId`, `currentProgress`). Send progress IPC events. Integrate with `watcher.js`. Contains logic from `readFilesRecursively`, `processDirectory`, `setupDirectoryLoadingTimeout`, `cancelDirectoryLoading`.
    *   **Dependencies**: `fs`, `path`, `p-queue`, `electron (BrowserWindow for sending IPC)`, `./utils.js`, `./config.js`, `./ignore-handler.js`, `./file-processor.js`, `./watcher.js`.
6.  **`watcher.js`**:
    *   **Purpose**: Monitor file system changes using Chokidar.
    *   **Contents**: Refine `initializeWatcher` and `shutdownWatcher` as described in "Method Changes". The core `chokidar` logic remains, but dependencies are injected. Event handlers (`add`, `change`, `unlink`) trigger appropriate actions (IPC messages, potentially calling `file-processor`).
    *   **Dependencies**: `chokidar`, `lodash`, `fs`, `path`, `electron (BrowserWindow)`, `./utils.js`, `./file-processor.js`, `./ignore-handler.js`.
7.  **`ipc-manager.js`**:
    *   **Purpose**: Centralize the registration and handling of all IPC communication from the renderer process.
    *   **Contents**: Implement `registerHandlers` and individual handler functions that delegate to other modules (`directory-processor`, `ignore-handler`, potentially a `cache-manager` or directly to modules with caches).
    *   **Dependencies**: `electron (ipcMain, BrowserWindow)`, `./directory-processor.js`, `./ignore-handler.js`, `./file-processor.js`, `./watcher.js` (potentially), `./cache-manager.js` (optional).
8.  **`cache-manager.js`** (Optional):
    *   **Purpose**: Provide a single point to manage clearing caches across different modules.
    *   **Contents**: `clearAllCaches` function calling specific clear functions in `ignore-handler.js`, `file-processor.js`.
    *   **Dependencies**: `./ignore-handler.js`, `./file-processor.js`.
9.  **`main.js`**:
    *   **Purpose**: Application entry point, Electron app lifecycle management, window creation, initialization of other modules.
    *   **Contents**: `createWindow`, app event listeners (`whenReady`, `activate`, `window-all-closed`, `before-quit`), CSP setup. Instantiate and dependency-inject modules. Call `ipcManager.registerHandlers`. Much leaner.
    *   **Dependencies**: `electron (app, BrowserWindow, session)`, `path`, `./config.js`, `./utils.js`, `./ipc-manager.js`, `./directory-processor.js`, `./ignore-handler.js`, `./file-processor.js`, `./watcher.js`, `./cache-manager.js` (optional).

**5. Files Created / Modified**

*   **`main.js`**: Heavily Modified (Reduced responsibility)
*   **`config.js`**: New
*   **`utils.js`**: Modified (Minor cleanup/consistency if needed)
*   **`ignore-handler.js`**: New
*   **`file-processor.js`**: New
*   **`directory-processor.js`**: New
*   **`watcher.js`**: Modified (Refined interface, dependency injection)
*   **`ipc-manager.js`**: New
*   **`cache-manager.js`**: New (Optional)
*   **`excluded-files.js`**: Unchanged (or moved into `config.js` if preferred)
*   **`preload.js`**: Unchanged (interface already well-defined)
*   **`renderer.js`**: Unchanged (Frontend)

**Execution Strategy:**

1.  Create the new file structure.
2.  Start by moving constants to `config.js`.
3.  Move path utilities to `utils.js` (already mostly done).
4.  Create `ignore-handler.js` and carefully move all ignore-related logic and state into it, defining clear exported functions.
5.  Create `file-processor.js` and move file-specific processing logic (stats, read, tokens, binary check) and caches.
6.  Create `directory-processor.js` and move the recursive scanning logic, progress tracking, timeout, and cancellation logic. Adapt it to use the new `ignore-handler` and `file-processor`.
7.  Refactor `watcher.js` to accept dependencies and use the new modules.
8.  Create `ipc-manager.js` and move all `ipcMain` listeners, adapting them to call the new module functions.
9.  Strip down `main.js` to its core responsibilities (app lifecycle, window creation). Instantiate all modules in `main.js` and inject dependencies where needed (e.g., pass `ignoreHandler` instance to `directoryProcessor`). Call `ipcManager.registerHandlers`.
10. Test thoroughly after each major step.

This plan provides a clear separation of concerns, making the backend much easier to understand, modify, and test while ensuring all original functionalities are preserved in their respective new modules.