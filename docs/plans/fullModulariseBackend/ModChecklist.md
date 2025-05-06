# Electron Backend Refactoring Checklist

**Goal:** Refactor the Electron backend (primarily `main.js`) into smaller, single-responsibility modules, improving organization, readability, testability, and maintainability without altering functionality. Adhere to file size guidelines (ideally < 300 lines, max ~500 for complex orchestrators).

**Instructions:** Do these tasks sequentially. Verify functionality preservation after completing each major module's refactoring. Update import/export statements meticulously as code moves. Ensure all dependencies are correctly injected or imported. Maintain existing JSDoc comments and add new ones for clarity, especially for new function signatures and module responsibilities.

---

## Phase 1: Setup and Configuration Module

**Objective:** Centralize configuration constants and basic utilities.

**File: `config.js`**

*   [x] Create the file `electron/config.js`.
*   [x] Add `require('os')` at the top.
*   [x] Add `require('path')` at the top.
*   [x] Move `MAX_DIRECTORY_LOAD_TIME` constant from `main.js` to `config.js` and export it.
*   [x] Move `MAX_FILE_SIZE` constant from `main.js` to `config.js` and export it.
*   [x] Move `CONCURRENT_DIRS` constant definition (using `os.cpus().length`) from `main.js` to `config.js` and export it.
*   [x] Move `STATUS_UPDATE_INTERVAL` constant from `main.js` to `config.js` and export it.
*   [x] Move `DEFAULT_PATTERNS` array constant from `main.js` to `config.js` and export it.
*   [x] Add `require('./excluded-files.js')` to import `excludedFiles` and `binaryExtensions`.
*   [x] Re-export `excludedFiles` from `excluded-files.js` via `config.js`.
*   [x] Re-export `binaryExtensions` from `excluded-files.js` via `config.js`.
*   [x] Add JSDoc comments explaining the purpose of each exported constant/variable.

**File: `utils.js`**

*   [x] Verify `normalizePath` function exists and is exported.
*   [x] Verify `ensureAbsolutePath` function exists and is exported.
*   [x] Verify `safeRelativePath` function exists and is exported.
*   [x] Verify `safePathJoin` function exists and is exported.
*   [x] Verify `isValidPath` function exists and is exported.
*   [x] Ensure `require('path')` is present.
*   [x] Ensure no other logic resides in `utils.js` beyond these path utilities.
*   [x] Remove the commented-out `// processSingleFile` export if present.
*   [x] *Remove* the `require('./excluded-files')` line from `utils.js` (it's not used there).

**File: `main.js` (Cleanup Part 1)**

*   [x] Remove the definitions of `MAX_DIRECTORY_LOAD_TIME`, `MAX_FILE_SIZE`, `CONCURRENT_DIRS`, `STATUS_UPDATE_INTERVAL`, `DEFAULT_PATTERNS` from `main.js`.
*   [x] Add `require('./config.js')` at the top of `main.js` to import necessary constants later. (Actual usage will be added when modules are integrated).
*   [x] Verify `require('./utils.js')` exists for path functions needed later.

---

## Phase 2: Ignore Handling Module

**Objective:** Isolate all logic related to determining whether files/directories should be ignored.

**File: `ignore-handler.js`**

*   [x] Create the file `electron/ignore-handler.js`.
*   [x] Add `require('ignore')` at the top and initialize the `ignore` library instance. Log success/failure similar to `main.js`. Handle potential error by creating a fallback `ignore` object.
*   [x] Add `require('fs').promises` as `fs`.
*   [x] Add `require('path')`.
*   [x] Add `require('./utils.js')` for path functions (`normalizePath`, `ensureAbsolutePath`, `safePathJoin`, `safeRelativePath`, `isValidPath`).
*   [x] Add `require('./config.js')` to import `DEFAULT_PATTERNS`, `excludedFiles`.
*   [x] Define module-level state variable `let currentIgnoreMode = 'automatic';`.
*   [x] Define module-level state variable `const ignoreCache = new Map();`.
*   [x] Define module-level state variable `const gitIgnoreFound = new Map();`.
*   [x] Define module-level state variable `let defaultExcludeFilter = null;`.
*   [x] Move the `defaultIgnoreFilter = ignore().add(DEFAULT_PATTERNS)` initialization from `main.js` into this module (as a module-level variable, initialized immediately).
*   [x] **Function: `shouldExcludeByDefault`**
    *   [x] Copy the `shouldExcludeByDefault` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Update dependencies inside the function to use imported `path`, `excludedFiles` (from `config.js`), `ignore` instance, `defaultExcludeFilter`, `ensureAbsolutePath`, `safeRelativePath`, `isValidPath`.
    *   [x] Ensure platform-specific checks (`process.platform`) remain.
    *   [x] Ensure logging remains (`console.log` / `console.warn`).
    *   [x] Export the `shouldExcludeByDefault` function.
*   [x] **Function: `collectGitignoreMapRecursive`**
    *   [x] Copy the `collectGitignoreMapRecursive` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Update dependencies: `fs`, `path`, `normalizePath`, `ensureAbsolutePath`, `safePathJoin`, `safeRelativePath`.
    *   [x] Make this an internal (not exported) helper function.
*   [x] **Function: `createGlobalIgnoreFilter`**
    *   [x] Copy the `createGlobalIgnoreFilter` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Update dependencies: `ignore`, `DEFAULT_PATTERNS`, `excludedFiles`, `normalizePath`.
    *   [x] Adapt logging to include `[IgnoreHandler]` prefix.
    *   [x] Make this an internal (not exported) helper function.
*   [x] **Function: `createContextualIgnoreFilter`**
    *   [x] Copy the `createContextualIgnoreFilter` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Update dependencies: `fs`, `path`, `ignore`, `normalizePath`, `safePathJoin`, `safeRelativePath`.
    *   [x] Ensure it uses the module-level `gitIgnoreFound` cache.
    *   [x] Adapt logging to include `[IgnoreHandler]` prefix.
    *   [x] Make this an internal (not exported) helper function.
*   [x] **Function: `loadGitignore` (becomes internal helper for `loadIgnoreFilter`)**
    *   [x] Copy the `loadGitignore` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Rename it slightly (e.g., `_loadAutomaticIgnoreFilter`) as it will be called by the main `loadIgnoreFilter` function.
    *   [x] Update dependencies: `ignore`, `fs`, `path`, `ensureAbsolutePath`, `normalizePath`, `DEFAULT_PATTERNS`, `excludedFiles`.
        *   [x] Adapt it to use the module-level `ignoreCache`, `currentIgnoreMode`, and call the internal `collectGitignoreMapRecursive`.
        *   [x] Adapt logging to include `[IgnoreHandler]` prefix.
        *   [x] Ensure it returns the `ignore` instance (`ig`).
        *   [x] Ensure it populates the `ignoreCache` correctly with the structure `{ ig: <instance>, patterns: <object> }`.
    *   [x] **Function: `loadIgnoreFilter`** (New public API)
        *   [x] Define the exported async function `loadIgnoreFilter(rootDir, customIgnores = [])`.
        *   [x] Add JSDoc explaining its purpose, params, and return value (`Promise<import('ignore').Ignore>`).
        *   [x] Implement logic:
            *   `rootDir = ensureAbsolutePath(rootDir);`
            *   Determine cache key based on `currentIgnoreMode` and `rootDir` (and sorted `customIgnores` if global mode).
            *   Check `ignoreCache` for the key. If found, log cache hit and return `cached.ig`.
            *   If cache miss:
                *   If `currentIgnoreMode === 'global'`, call internal `createGlobalIgnoreFilter(customIgnores)`, store result `{ ig, patterns }` in `ignoreCache`, return `ig`.
                *   If `currentIgnoreMode === 'automatic'`, call internal `_loadAutomaticIgnoreFilter(rootDir)`, get the result `ig` from the cache entry set by `_loadAutomaticIgnoreFilter`, and return `ig`. (No need for `customIgnores` here).
            *   Handle errors gracefully, potentially returning a default/empty filter.
*   [x] **Function: `shouldIgnorePath` (becomes internal helper for `shouldIgnore`)**
    *   [x] Copy the `shouldIgnorePath` function implementation from `main.js` into `ignore-handler.js`.
    *   [x] Rename it slightly (e.g. `_checkIgnoreAgainstFilter`).
    *   [x] Update dependencies: `path`, `safeRelativePath`, `isValidPath`. Uses the module-level `defaultIgnoreFilter`.
    *   [x] Adapt it to accept the *specific* `ignoreFilterInstance` to use (passed as an argument), instead of relying on a potentially ambiguous one. Remove references to `createContextualIgnoreFilter` from within this function check.
    *   [x] Remove the `ignoreMode` parameter, as the calling function `shouldIgnore` will handle selecting the right filter instance.
    *   [x] Adapt logging (optional, may be too verbose).
*   [x] **Function: `shouldIgnore`** (New public API)
    *   [x] Define the exported function `shouldIgnore(filePath, rootDir, currentDirContext, ignoreFilterInstance)`. *Important Note:* The `ignoreFilterInstance` passed should be the one *already loaded* for the root context (via `loadIgnoreFilter`). The `currentDirContext` might be needed if fine-grained contextual checks *independent* of the pre-loaded filter instance are required, but the current `shouldIgnorePath` logic mainly relies on the *filter instance* itself containing all patterns. Re-evaluate if `createContextualIgnoreFilter` is truly needed *here* or if its logic is fully incorporated into how `loadIgnoreFilter` builds the instance in automatic mode. *Decision:* Stick to the pattern where `loadIgnoreFilter` builds the comprehensive filter for 'automatic' mode. Simplify `shouldIgnore`.
    *   [x] Add JSDoc explaining params and return value (`boolean`).
    *   [x] Implement logic:
        *   `filePath = ensureAbsolutePath(filePath);`
        *   `rootDir = ensureAbsolutePath(rootDir);`
        *   Calculate `relativeToRoot = safeRelativePath(rootDir, filePath);`
        *   If `!isValidPath(relativeToRoot)` or `relativeToRoot.startsWith('..')`, return `true`.
        *   If `defaultIgnoreFilter.ignores(relativeToRoot)`, log and return `true`.
        *   If `ignoreFilterInstance.ignores(relativeToRoot)`, return `true`.
        *   *(Remove the contextual check part using `createContextualIgnoreFilter` and `relativeToCurrent` as the main `ignoreFilterInstance` should handle this based on how it was built by `loadIgnoreFilter`)*.
        *   Return `false`.
*   [x] **Function: `setIgnoreMode`**
    *   [x] Define the exported function `setIgnoreMode(mode)`.
    *   [x] Add validation: if `mode` is not 'automatic' or 'global', log warning and return.
    *   [x] Update the module-level `currentIgnoreMode = mode;`.
    *   [x] Log the mode switch: `console.log(`[IgnoreHandler] Ignore mode switched -> ${mode}`);`.
    *   [x] Call `clearCache()` (implement next).
*   [x] **Function: `getIgnoreMode`**
    *   [x] Define the exported function `getIgnoreMode()`.
    *   [x] Return the module-level `currentIgnoreMode`.
*   [x] **Function: `clearCache`**
    *   [x] Define the exported function `clearCache()`.
    *   [x] Clear the module-level `ignoreCache`: `ignoreCache.clear();`.
    *   [x] Clear the module-level `gitIgnoreFound`: `gitIgnoreFound.clear();`.
    *   [x] Log cache clearing: `console.log('[IgnoreHandler] Ignore cache cleared');`.
*   [x] **Function: `getIgnorePatternsForPath`**
    *   [x] Define the exported async function `getIgnorePatternsForPath(folderPath, customIgnores = [])`.
    *   [x] Add JSDoc.
    *   [x] Implement logic almost identical to the *original* `get-ignore-patterns` IPC handler *logic* (but without IPC context):
        *   Ensure `folderPath` is absolute.
        *   Determine cache key based on `folderPath`, `currentIgnoreMode`, and `customIgnores`.
        *   Try to retrieve patterns from `ignoreCache`. If found, return `{ patterns: cached.patterns }`.
        *   If not cached:
            *   If `currentIgnoreMode === 'global'`, create the pattern object `{ global: [...DEFAULT_PATTERNS, ...excludedFiles, ...(customIgnores || [])] }`. *Do not* cache here unless `loadIgnoreFilter` is also called to create the `ig` instance.
            *   If `currentIgnoreMode === 'automatic'`:
                *   Call the internal `_loadAutomaticIgnoreFilter(folderPath)` to populate the cache if needed.
                *   Retrieve the newly cached entry: `const cached = ignoreCache.get(cacheKey);`
                *   Return `{ patterns: cached?.patterns || { gitignoreMap: {} } }`.
        *   Handle errors and return `{ error: err.message }`.
*   [x] **Function: `getDefaultIgnoreFilter`**
    *   [x] Define exported function `getDefaultIgnoreFilter()`.
    *   [x] Return the module-level `defaultIgnoreFilter` instance.
*   [x] Export all public functions: `loadIgnoreFilter`, `shouldIgnore`, `setIgnoreMode`, `getIgnoreMode`, `clearCache`, `getIgnorePatternsForPath`, `shouldExcludeByDefault`, `getDefaultIgnoreFilter`.

**File: `main.js` (Cleanup Part 2)**

*   [x] Remove the `ignore = require('ignore')` block.
*   [x] Remove the `currentIgnoreMode` global variable.
*   [x] Remove the `ignoreCache` global variable.
*   [x] Remove the `gitIgnoreFound` global variable.
*   [x] Remove the `defaultExcludeFilter` global variable.
*   [x] Remove the `defaultIgnoreFilter` global variable initialization.
*   [x] Remove the `shouldExcludeByDefault` function.
*   [x] Remove the `collectGitignoreMapRecursive` function.
*   [x] Remove the `createGlobalIgnoreFilter` function.
*   [x] Remove the `createContextualIgnoreFilter` function.
*   [x] Remove the `loadGitignore` function.
*   [x] Remove the `shouldIgnorePath` function.
*   [x] Remove the `ipcMain.on('clear-ignore-cache')` handler. (Will be replaced in `ipc-manager.js`).
*   [x] Remove the `ipcMain.handle('get-ignore-patterns')` handler. (Will be replaced in `ipc-manager.js`).
*   [x] Remove the `ipcMain.on('set-ignore-mode')` handler. (Will be replaced in `ipc-manager.js`).

---

## Phase 3: File Processing Module

**Objective:** Isolate logic for reading file content, checking size/binary status, counting tokens, and caching file data.

**File: `file-processor.js`**

*   [x] Create the file `electron/file-processor.js`.
*   [x] Add `require('fs').promises` as `fs`.
*   [x] Add `require('path')`.
*   [x] Add `require('tiktoken')` setup block (identical to `main.js`, including try/catch and fallback logging). Store the `encoder` instance at module level.
*   [x] Add `require('./utils.js')` for `normalizePath`, `ensureAbsolutePath`, `safeRelativePath`, `isValidPath`.
*   [x] Add `require('./config.js')` for `MAX_FILE_SIZE`, `binaryExtensions`.
*   [x] Define module-level state variable `const fileCache = new Map();`.
*   [x] Define module-level state variable `const fileTypeCache = new Map();`.
*   [x] **Function: `countFileTokens`**
    *   [x] Copy the `countTokens` function implementation from `main.js` into `file-processor.js`. Rename it to `countFileTokens`.
    *   [x] Ensure it uses the module-level `encoder` instance.
    *   [x] Keep the fallback logic (`Math.ceil(text.length / 4)`).
    *   [x] Make this an internal (not exported) function.
*   [x] **Function: `isBinary`** (Replaces `isBinaryFile`)
    *   [x] Copy the `isBinaryFile` function implementation from `main.js` into `file-processor.js`. Rename it `isBinary`.
    *   [x] Update dependencies: `path`, module-level `fileTypeCache`, `binaryExtensions` from `config.js`.
    *   [x] Make this an internal (not exported) helper function.
*   [x] **Function: `processFile`** (Replaces `processSingleFile`)
    *   [x] Define the exported async function `processFile(fullPath, rootDir)`.
    *   [x] Define `options`: `{ config: ConfigObject }` -> *Correction:* Dependencies like `ignoreHandler` should be injected at a higher level (like `directory-processor`). `processFile` should focus *only* on the file itself, assuming it *should* be processed. The caller (`directory-processor` or `watcher`) is responsible for the ignore check *before* calling `processFile`.
    *   [x] Add JSDoc defining the `FileMetadata` type it returns (or Promise thereof). See "Type Changes" section in the plan.
    *   [x] Check the module-level `fileCache` first. If `fullPathNormalized` exists, return the cached data.
    *   [x] Implement logic based *heavily* on the *original* `processSingleFile` function *and* the file processing parts *within* the old `readFilesRecursively` loop:
        *   Normalize paths: `fullPath = ensureAbsolutePath(fullPath); rootDir = ensureAbsolutePath(rootDir); const relativePath = safeRelativePath(rootDir, fullPath); const fullPathNormalized = normalizePath(fullPath);`
        *   Basic validation: Check `isValidPath(relativePath)` and `!relativePath.startsWith('..')`. If invalid, return a minimal error `FileMetadata` object `{ path: fullPathNormalized, relativePath, name: path.basename(fullPath), isSkipped: true, error: 'Invalid path' }`.
        *   Call internal `isBinary(fullPath)`. If true:
            *   Create `fileData` object: `{ name, path, relativePath, isBinary: true, isSkipped: false, fileType: path.extname(fullPath)..., size: 0, content: '', tokenCount: 0 }`.
            *   Try `fs.stat(fullPath)` to get size. Add `size` to `fileData` if successful, catch error and log.
            *   Cache `fileData` in `fileCache`.
            *   Return `fileData`.
        *   If not binary:
            *   Perform `fs.stat(fullPath)`. Handle errors (e.g., EPERM, ENOENT) by creating and returning an appropriate error `FileMetadata` object (similar to the error handling in the original `readFilesRecursively` file loop).
            *   Check `stats.size > MAX_FILE_SIZE`. If true, create, cache, and return a `FileMetadata` object indicating skipped due to size.
            *   Perform `fs.readFile(fullPath, 'utf8')`. Handle errors by creating/returning an error `FileMetadata` object.
            *   Call internal `countFileTokens(content)` to get `tokenCount`.
            *   Create the final `FileMetadata` object: `{ name, path, relativePath, content, tokenCount, size, isBinary: false, isSkipped: false }`.
            *   Cache the result in `fileCache`.
            *   Return the `FileMetadata` object.
*   [x] **Function: `clearFileCache`** (New public API for cache management)
    *   [x] Define exported function `clearFileCache()`.
    *   [x] Clear `fileCache`: `fileCache.clear();`.
    *   [x] Clear `fileTypeCache`: `fileTypeCache.clear();`.
    *   [x] Log: `console.log('[FileProcessor] File caches cleared');`
*   [x] Export `processFile` and `clearFileCache`.

**File: `main.js` (Cleanup Part 3)**

*   [x] Remove the `tiktoken = require('tiktoken')` block.
*   [x] Remove the `encoder` global variable.
*   [x] Remove the `fileCache` global variable.
*   [x] Remove the `fileTypeCache` global variable.
*   [x] Remove the `isBinaryFile` function.
*   [x] Remove the `countTokens` function.
*   [x] Remove the `processSingleFile` function.
*   [x] Confirm no original functionality has been lost or altered.

---

## Phase 4: Directory Processing Module

**Objective:** Orchestrate the recursive scanning of directories, manage concurrency, progress updates, timeouts, and integrate with other modules.

**File: `directory-processor.js`**

*   [ ] Create the file `electron/directory-processor.js`.
*   [ ] Add `require('fs').promises` as `fs`.
*   [ ] Add `require('path')`.
*   [ ] Add `require('os')`.
*   [ ] Add `require('p-queue').default` as `PQueue`.
*   [ ] Add `require('electron')` specifically for `BrowserWindow` to send IPC messages.
*   [ ] Add `require('./utils.js')` (`ensureAbsolutePath`, `safePathJoin`, `safeRelativePath`, `isValidPath`).
*   [ ] Add `require('./config.js')` (`MAX_DIRECTORY_LOAD_TIME`, `STATUS_UPDATE_INTERVAL`, `CONCURRENT_DIRS`).
*   [ ] Define module-level state:
    *   `let isLoadingDirectory = false;`
    *   `let loadingTimeoutId = null;`
    *   `let currentProgress = { directories: 0, files: 0 };`
    *   `let lastStatusUpdateTime = 0;`
    *   `let fileQueue = null;` // The PQueue instance for file processing
    *   `let rootDirForCurrentScan = null;` // Store root for validation
    *   `let windowForCurrentScan = null;` // Store window for IPC
    *   `let ignoreHandlerInstance = null;` // Injected dependency
    *   `let fileProcessorInstance = null;` // Injected dependency
    *   `let watcherInstance = null;` // Injected dependency
    *   `let configInstance = null;` // Injected dependency (or require directly)
    *   `let globalIgnoreFilter = null;` // Store the filter for the current scan
    *   `let defaultIgnoreFilterRef = null;` // Store the default filter for the current scan
*   [ ] **Function: `_sendFileProcessingStatus`** (Internal helper)
    *   [ ] Define internal function `_sendFileProcessingStatus(status, message)`.
    *   [ ] Check if `windowForCurrentScan` is valid and not destroyed.
    *   [ ] If valid, send IPC: `windowForCurrentScan.webContents.send('file-processing-status', { status, message });`.
*   [ ] **Function: `_clearLoadingState`** (Internal helper)
    *   [ ] Define internal function `_clearLoadingState()`.
    *   [ ] Set `isLoadingDirectory = false;`.
    *   [ ] Clear timeout: `if (loadingTimeoutId) { clearTimeout(loadingTimeoutId); loadingTimeoutId = null; }`.
    *   [ ] Reset progress: `currentProgress = { directories: 0, files: 0 };`.
    *   [ ] Reset queue if exists: `if (fileQueue) { fileQueue.clear(); fileQueue = null; }`.
    *   [ ] Reset state holders: `rootDirForCurrentScan = null; windowForCurrentScan = null; ignoreHandlerInstance = null; fileProcessorInstance = null; watcherInstance = null; globalIgnoreFilter = null; defaultIgnoreFilterRef = null;`
*   [ ] **Function: `cancelScan`** (Public API - replaces `cancelDirectoryLoading`)
    *   [ ] Define exported async function `cancelScan(reason = 'user')`.
    *   [ ] If `!isLoadingDirectory`, return.
    *   [ ] Log cancellation: `console.log(`[DirectoryProcessor] Cancelling scan (Reason: ${reason})`);`. Include stats from `currentProgress`.
    *   [ ] Call `watcherInstance.shutdownWatcher()` asynchronously and await it.
    *   [ ] Call `_clearLoadingState()`.
    *   [ ] Send IPC status update: `_sendFileProcessingStatus('cancelled', reason === 'timeout' ? 'Directory loading timed out...' : 'Directory loading cancelled');`.
*   [ ] **Function: `_setupDirectoryLoadingTimeout`** (Internal helper - replaces standalone function)
    *   [ ] Define internal function `_setupDirectoryLoadingTimeout(folderPath)`.
    *   [ ] Clear existing timeout: `if (loadingTimeoutId) { clearTimeout(loadingTimeoutId); }`.
    *   [ ] Set new timeout using `setTimeout`:
        ```javascript
        loadingTimeoutId = setTimeout(() => {
          console.log(`[DirectoryProcessor] Scan timed out for ${folderPath}. Stats: ${currentProgress.directories} dirs, ${currentProgress.files} files`);
          cancelScan('timeout'); // Use the public cancelScan function
        }, configInstance.MAX_DIRECTORY_LOAD_TIME); // Use injected config
        ```
*   [ ] **Function: `_recursiveScanInternal`** (Core recursive logic - replaces `readFilesRecursively` and `processDirectory`)
    *   [ ] Define internal async function `_recursiveScanInternal(currentScanDir, currentIgnoreMode)`. This function will manage the recursion and file queueing for a specific directory.
    *   [ ] **Pre-checks:**
        *   If `!isLoadingDirectory` return `{ results: [], progress: currentProgress }`.
        *   `currentScanDir = ensureAbsolutePath(currentScanDir);`.
    *   [ ] **Queue Init:** Initialize `fileQueue` if it's null (only at the *top* level call, likely managed by the public `scanDirectory` function, not here). Use `configInstance.CONCURRENT_DIRS` for directory concurrency, `os.cpus().length` based logic for file queue concurrency.
    *   [ ] **Read Directory:**
        *   `try { const dirents = await fs.readdir(currentScanDir, { withFileTypes: true }); } catch (err) ...` Handle errors (EPERM, EACCES, etc.) - log skip and return `{ results: [], progress }`.
        *   If `!isLoadingDirectory` after readdir, return.
    *   [ ] **Process Subdirectories:**
        *   Filter `dirents` for directories.
        *   Iterate through directories *concurrently* (perhaps using `Promise.all` on batches or another `PQueue` if `CONCURRENT_DIRS` is complex to manage with `Promise.all`).
        *   For each subdirectory `dirent`:
            *   If `!isLoadingDirectory`, break loop.
            *   Construct `fullPath = safePathJoin(currentScanDir, dirent.name);`.
            *   Construct `relativePath = safeRelativePath(rootDirForCurrentScan, fullPath);`.
            *   **Ignore Check (Directory):** Call `ignoreHandlerInstance.shouldIgnore(fullPath, rootDirForCurrentScan, currentScanDir, globalIgnoreFilter)` and `ignoreHandlerInstance.shouldExcludeByDefault(fullPath, rootDirForCurrentScan)` and `defaultIgnoreFilterRef.ignores(relativePath)`. Also add platform checks (`.app`, `app.getAppPath()`, invalid chars, etc.) similar to original code. If ignored/invalid, continue to next directory.
            *   **Recurse:** `currentProgress.directories++;`
            *   *Immediately* send progress update if needed (throttled): Check `Date.now() - lastStatusUpdateTime > configInstance.STATUS_UPDATE_INTERVAL`. If so, `_sendFileProcessingStatus('processing', \`Scanning directories...\`); lastStatusUpdateTime = Date.now();`.
            *   Recursively call `await _recursiveScanInternal(fullPath, currentIgnoreMode);`. Aggregate results (though results are pushed directly in file processing part).
    *   [ ] **Process Files:**
        *   Filter `dirents` for files.
        *   Iterate through files. For each file `dirent`:
            *   If `!isLoadingDirectory`, break loop.
            *   Construct `fullPath = safePathJoin(currentScanDir, dirent.name);`.
            *   Construct `relativePath = safeRelativePath(rootDirForCurrentScan, fullPath);`.
            *   **Ignore Check (File):** Call `ignoreHandlerInstance.shouldIgnore(fullPath, rootDirForCurrentScan, currentScanDir, globalIgnoreFilter)` and `ignoreHandlerInstance.shouldExcludeByDefault(fullPath, rootDirForCurrentScan)` and `defaultIgnoreFilterRef.ignores(relativePath)`. Also add platform checks. If ignored/invalid, continue to next file.
            *   **Queue File Processing:** Add a task to the `fileQueue`:
                ```javascript
                fileQueue.add(async () => {
                  if (!isLoadingDirectory) return; // Check cancellation inside task
                  try {
                    const fileData = await fileProcessorInstance.processFile(fullPath, rootDirForCurrentScan); // Call file processor
                    if (!isLoadingDirectory) return; // Check again after await

                    // Check if fileData indicates an error or skip condition handled by processFile
                    // No need to re-check binary/size here if processFile handles it.

                    currentProgress.files++;
                    filesResultArray.push(fileData); // Add result to an array managed by the top-level scanDirectory call

                    // Throttled Progress Update (Inside queue task completion)
                    const now = Date.now();
                    if (now - lastStatusUpdateTime > configInstance.STATUS_UPDATE_INTERVAL) {
                       if (!isLoadingDirectory) return;
                       _sendFileProcessingStatus('processing', `Processing files (${currentProgress.directories} dirs, ${currentProgress.files} files)...`);
                       lastStatusUpdateTime = now;
                     }
                    // Log detailed progress less frequently (e.g., % 500 files)
                     if (currentProgress.files % 500 === 0) {
                       console.log(`[DirectoryProcessor] Progress: Dirs: ${currentProgress.directories}, Files: ${currentProgress.files}, Queue Size: ${fileQueue.size}, Pending: ${fileQueue.pending}`);
                     }

                  } catch (err) { // Catch errors from processFile itself (should be rare if processFile returns error objects)
                    console.error(`[DirectoryProcessor] Error processing file ${fullPath} in queue:`, err);
                    currentProgress.files++; // Still count as processed
                    // Add error placeholder to results if necessary needed (processFile should already return error objects)
                  }
                });
                ```
    *   [ ] **Return/Wait:** This internal function doesn't directly return the full file list. It adds tasks to the queue. The main `scanDirectory` function will `await fileQueue.onIdle()`.
*   [ ] **Function: `scanDirectory`** (Public API - replaces `request-file-list` handler logic)
    *   [ ] Define exported async function `scanDirectory(folderPath, options)`.
    *   [ ] Define `options`: `{ window: BrowserWindow, ignoreHandler: IgnoreHandlerInterface, fileProcessor: FileProcessorInterface, config: ConfigObject, watcher: WatcherInterface, customIgnores?: string[], ignoreSettingsModified?: boolean }`.
    *   [ ] Add JSDoc explaining parameters, what it does (starts scan, manages state), and return value (`Promise<FileMetadata[]>`).
    *   [ ] **Initial Check:** If `isLoadingDirectory`, log warning, send 'busy' status, and return `[]`.
    *   [ ] **Setup State:**
        *   `isLoadingDirectory = true;`
        *   Reset progress: `currentProgress = { directories: 0, files: 0 };`
        *   Store dependencies: `windowForCurrentScan = options.window; ignoreHandlerInstance = options.ignoreHandler; ...etc.`
        *   Store `rootDirForCurrentScan = ensureAbsolutePath(folderPath);`.
    *   [ ] **Setup Timeout:** Call `_setupDirectoryLoadingTimeout(rootDirForCurrentScan);`.
    *   [ ] **Send Initial Status:** `_sendFileProcessingStatus('processing', 'Scanning directory structure...');`.
    *   [ ] **Shutdown Watcher:** `await watcherInstance.shutdownWatcher();` (As original code does this).
    *   [ ] **Load Ignore Filter:**
        *   Get current mode: `const currentIgnoreMode = ignoreHandlerInstance.getIgnoreMode();`.
        *   Call `globalIgnoreFilter = await ignoreHandlerInstance.loadIgnoreFilter(rootDirForCurrentScan, options.customIgnores);`. Handle potential errors loading filter (throw error or log + use empty filter).
        *   Get default filter: `defaultIgnoreFilterRef = ignoreHandlerInstance.getDefaultIgnoreFilter();`
        *   Log success: `console.log('[DirectoryProcessor] Ignore patterns loaded successfully.');`
    *   [ ] **Initialize File Queue:** Create the `PQueue` instance for file processing.
        *   `const cpuCount = os.cpus().length;`
        *   `const fileQueueConcurrency = Math.max(2, Math.min(cpuCount, 8));`
        *   `fileQueue = new PQueue({ concurrency: fileQueueConcurrency });`
        *   `console.log(`[DirectoryProcessor] Initializing file processing queue with concurrency: ${fileQueueConcurrency}`);`
    *   [ ] **Start Recursive Scan:**
        *   Initialize an empty array: `let allFilesResult = [];`
        *   Call the internal recursive function: `await _recursiveScanInternal(rootDirForCurrentScan, currentIgnoreMode);` (Pass the `allFilesResult` array by reference or have `_recursiveScanInternal` return results to be aggregated). *Correction:* The file queue tasks push directly to `allFilesResult`.
    *   [ ] **Wait for Queue:** `await fileQueue.onIdle();`.
    *   [ ] **Check Cancellation:** If `!isLoadingDirectory` (scan was cancelled during processing), call `_clearLoadingState()` and return `[]`.
    *   [ ] **Finalize:**
        *   Call `_clearLoadingState()` (clears timeout etc., sets `isLoadingDirectory = false`).
        *   Send final status: `_sendFileProcessingStatus('complete', \`Found ${allFilesResult.length} files\`);`.
        *   **Initialize Watcher:** `await watcherInstance.initializeWatcher(rootDirForCurrentScan, { window: windowForCurrentScan, ignoreHandler: ignoreHandlerInstance, fileProcessor: fileProcessorInstance, globalIgnoreFilter: globalIgnoreFilter, defaultIgnoreFilter: defaultIgnoreFilterRef });` (Pass necessary context/filters watcher needs).
        *   Return the `allFilesResult` array.
    *   [ ] **Error Handling:** Wrap the main logic in a `try...catch...finally`.
        *   `catch (err)`: Log error, call `_clearLoadingState()`, send 'error' status, return `[]`.
        *   `finally`: Ensure `_clearLoadingState()` is called if an unexpected error escapes the main try block.
*   [ ] **Function: `isScanning`** (Public API)
    *   [ ] Define exported function `isScanning()`.
    *   [ ] Return `isLoadingDirectory`.

**File: `main.js` (Cleanup Part 4)**

*   [ ] Remove `PQueue` require and usage.
*   [ ] Remove `isLoadingDirectory` global variable.
*   [ ] Remove `loadingTimeoutId` global variable.
*   [ ] Remove `currentProgress` global variable.
*   [ ] Remove `lastStatusUpdateTime` global variable.
*   [ ] Remove `STATUS_UPDATE_INTERVAL` usage (now in config).
*   [ ] Remove `CONCURRENT_DIRS` usage (now in config).
*   [ ] Remove `setupDirectoryLoadingTimeout` function.
*   [ ] Remove `cancelDirectoryLoading` function.
*   [ ] Remove `processDirectory` function.
*   [ ] Remove `readFilesRecursively` function.
*   [ ] Remove `ipcMain.on('request-file-list')` handler. (Replaced by `ipc-manager.js`).
*   [ ] Remove `ipcMain.on('cancel-directory-loading')` handler. (Replaced by `ipc-manager.js`).
*   [ ] Remove the `Escape` key handler logic within `createWindow`'s `before-input-event` listener (this should be handled via the `cancelScan` IPC call triggered by the renderer, or potentially moved to `ipc-manager` if global keybinding is absolutely required, but local window is better). *Correction:* The original code *did* handle it locally in main. Keep the `before-input-event` listener in `main.js`, but make it call the *exported* `directoryProcessor.cancelScan('user')` function if `directoryProcessor.isScanning()` is true.

---

## Phase 5: Watcher Module Refinement

**Objective:** Ensure the watcher integrates cleanly with the new modules and uses injected dependencies.

**File: `watcher.js`**

*   [ ] Keep `require('chokidar')`, `require('path')`, `require('fs')`, `require('electron').BrowserWindow`, `require('lodash').debounce`.
*   [ ] Keep `require('./utils.js')` (`normalizePath`, `safeRelativePath`, `ensureAbsolutePath`).
*   [ ] *Remove* `require('./main.js')`. Instead, dependencies will be injected.
*   [ ] Keep module-level state: `currentWatcher`, `changeDebounceMap`.
*   [ ] **Function: `shutdownWatcher`**
    *   [ ] Verify implementation is correct (closes watcher, clears map, logs). Keep async. No significant changes needed structurally.
*   [ ] **Function: `initializeWatcher`**
    *   [ ] Modify signature to accept dependencies: `initializeWatcher(folderPath, options)`.
    *   [ ] Define `options`: `{ window: BrowserWindow, ignoreHandler: IgnoreHandlerInterface, fileProcessor: FileProcessorInterface, globalIgnoreFilter: import('ignore').Ignore, defaultIgnoreFilter: import('ignore').Ignore }`.
    *   [ ] Call `await shutdownWatcher()` at the beginning.
    *   [ ] Log start attempt using `folderPath`.
    *   [ ] Define `watcherOptions`:
        *   **`ignored` function:**
            *   Implement the `(filePath) => { ... }` function.
            *   Inside, use the injected `options.ignoreHandler`, `options.globalIgnoreFilter` and `options.defaultIgnoreFilter`.
            *   Calculate `relativePath = safeRelativePath(folderPath, filePath)`.
            *   Check default filter: `options.defaultIgnoreFilter.ignores(relativePath)`.
            *   Check global/specific filter: `options.ignoreHandler.shouldIgnore(filePath, folderPath, folderPath, options.globalIgnoreFilter)`. (*Note:* passing folderPath as currentDirContext since watcher operates from root).
            *   Return `true` if ignored, `false` otherwise. Include try/catch for safety. Remove verbose logging from here.
        *   Keep `ignoreInitial: true`, `persistent: true`, `awaitWriteFinish`.
    *   [ ] Instantiate watcher: `currentWatcher = chokidar.watch(folderPath, watcherOptions);` (Keep try/catch).
    *   [ ] **Event Handlers:**
        *   `'error'`: Keep logging.
        *   `'add'`:
            *   Modify callback: `async (filePath) => { ... }`.
            *   Call `options.fileProcessor.processFile(filePath, folderPath)` to get `fileData`.
            *   If `fileData` is valid and `options.window` is valid, send IPC `options.window.webContents.send('file-added', fileData);`. Log IPC send. Handle errors.
        *   `'change'`:
            *   Keep debounce logic using `changeDebounceMap` and `lodash.debounce`.
            *   Modify the *debounced* handler: `async (filePath) => { ... }`.
            *   Call `options.fileProcessor.processFile(filePath, folderPath)` to get `fileData`.
            *   If `fileData` is valid and `options.window` is valid, send IPC `options.window.webContents.send('file-updated', fileData);`. Log IPC send. Handle errors.
        *   `'unlink'`:
            *   Modify callback: `(filePath) => { ... }`.
            *   Normalize path: `const normalizedPath = normalizePath(filePath);`.
            *   Get relative path: `const relativePath = safeRelativePath(folderPath, normalizedPath);`.
            *   If `options.window` is valid and `relativePath` exists, send IPC `options.window.webContents.send('file-removed', { path: normalizedPath, relativePath: relativePath });`. Log IPC send. Handle errors.
    *   [ ] Log success.
*   [ ] Ensure `initializeWatcher` and `shutdownWatcher` are exported.

**File: `main.js` (Modification)**

*   [ ] Ensure `app.on('before-quit', ...)` and `app.on('window-all-closed', ...)` call the *new* `watcher.shutdownWatcher()` if necessary.
*   [ ] Ensure `mainWindow.on('closed', ...)` calls `watcher.shutdownWatcher()`.

---

## Phase 6: IPC Management Module

**Objective:** Centralize all `ipcMain` event handling, delegating tasks to the appropriate modules.

**File: `ipc-manager.js`**

*   [ ] Create the file `electron/ipc-manager.js`.
*   [ ] Add `require('electron')` for `ipcMain`, `dialog`, `BrowserWindow`.
*   [ ] Define module-level variables to hold injected dependencies:
    *   `let directoryProcessorInstance = null;`
    *   `let ignoreHandlerInstance = null;`
    *   `let fileProcessorInstance = null;` // For cache clearing
    *   `let watcherInstance = null;` // Potentially needed? Maybe not directly.
    // Add other modules if needed (e.g., cacheManager)
*   [ ] **Function: `registerHandlers`**
    *   [ ] Define exported function `registerHandlers(options)`.
    *   [ ] Define `options`: `{ directoryProcessor: DirectoryProcessorInterface, ignoreHandler: IgnoreHandlerInterface, fileProcessor: FileProcessorInterface, watcher: WatcherInterface, /* ... other modules */ }`.
    *   [ ] Store injected instances in module-level variables: `directoryProcessorInstance = options.directoryProcessor; ...`.
    *   [ ] **Register Listener: `clear-main-cache`**
        *   `ipcMain.on('clear-main-cache', () => { ... });`
        *   Inside, log intent.
        *   Call `ignoreHandlerInstance.clearCache();`.
        *   Call `fileProcessorInstance.clearFileCache();`.
        *   Log completion.
    *   [ ] **Register Listener: `clear-ignore-cache`** (This might be redundant if `set-ignore-mode` calls `ignoreHandler.clearCache`, but keep for explicit calls if UI uses it).
        *   `ipcMain.on('clear-ignore-cache', () => { ... });`
        *   Inside, log intent.
        *   Call `ignoreHandlerInstance.clearCache();`.
        *   Log completion.
    *   [ ] **Register Listener: `open-folder`**
        *   `ipcMain.on('open-folder', async (event) => { ... });`
        *   Implement the dialog logic exactly as in `main.js`.
        *   On success, send `folder-selected` to `event.sender`.
    *   [ ] **Register Listener: `get-ignore-patterns`**
        *   `ipcMain.handle('get-ignore-patterns', async (event, payload) => { ... });`
        *   Destructure `payload`: `{ folderPath, mode, customIgnores = [] }`.
        *   If `!folderPath`, return default patterns structure, reference `DEFAULT_PATTERNS` and `excludedFiles` (potentially via `configInstance` if injected, or require config here).
        *   Call `ignoreHandlerInstance.setIgnoreMode(mode)` if `mode` is provided (to ensure consistency, though the main trigger should be `set-ignore-mode`). *Correction:* Don't set mode here, just read it. Use `ignoreHandlerInstance.getIgnoreMode()` if `mode` isn't passed in payload, although payload *should* contain the mode the frontend intends. Rely on the payload's `mode` for consistency.
        *   Call `await ignoreHandlerInstance.getIgnorePatternsForPath(folderPath, customIgnores)`.
        *   Return the result `{ patterns: ... }` or `{ error: ... }`.
    *   [ ] **Register Listener: `cancel-directory-loading`**
        *   `ipcMain.on('cancel-directory-loading', (event) => { ... });`
        *   Call `await directoryProcessorInstance.cancelScan('user');`.
    *   [ ] **Register Listener: `debug-file-selection`**
        *   `ipcMain.on('debug-file-selection', (event, data) => { ... });`
        *   Keep the simple `console.log`.
    *   [ ] **Register Listener: `set-ignore-mode`**
        *   `ipcMain.on('set-ignore-mode', async (_event, mode) => { ... });`
        *   Call `ignoreHandlerInstance.setIgnoreMode(mode);` (This function now also handles logging and cache clearing).
        *   Notify renderer windows:
            ```javascript
            BrowserWindow.getAllWindows().forEach((win) => {
              if (win && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('ignore-mode-updated', mode);
              }
            });
            ```
    *   [ ] **Register Listener: `request-file-list`**
        *   `ipcMain.on('request-file-list', async (event, payload) => { ... });`
        *   Log received payload.
        *   Get the window: `const window = BrowserWindow.fromWebContents(event.sender);`. Return if no window.
        *   Destructure payload: `folderPath` object from original code is `{ folderPath: string, ignoreMode: 'automatic'|'global', customIgnores?: string[], ignoreSettingsModified?: boolean }`.
        *   Call `const files = await directoryProcessorInstance.scanDirectory(payload.folderPath, { window, ignoreHandler: ignoreHandlerInstance, fileProcessor: fileProcessorInstance, config: configInstance /* Inject config */, watcher: watcherInstance, customIgnores: payload.customIgnores, ignoreSettingsModified: payload.ignoreSettingsModified });`.
        *   If scan was successful (didn't return early due to busy/cancel/error, which `scanDirectory` handles internally now including status updates):
            *   Process the `files` array for serialization (map to the structure expected by the renderer, similar to the original handler's final mapping). Ensure `shouldExcludeByDefault` is called correctly via `ignoreHandlerInstance` during this mapping if not already present on `fileData`.
            *   Send IPC: `event.sender.send('file-list-data', serializedFiles);`.
        *   *Note:* Much of the original handler's logic (state checks, timeout, status updates, ignore loading, recursion) is now inside `directoryProcessorInstance.scanDirectory`. This handler becomes much simpler.

**File: `main.js` (Cleanup Part 5)**

*   [ ] Remove *all* remaining `ipcMain.on`/`ipcMain.handle` listeners. Their logic is now in `ipc-manager.js`.
*   [ ] Remove the `require('electron').dialog`.

---

## Phase 7: Main Module Integration and Cleanup

**Objective:** Refactor `main.js` to be the application entry point, responsible for setup, window creation, module instantiation, and dependency injection.

**File: `main.js`**

*   [ ] Keep `require('electron')` for `app`, `BrowserWindow`, `session`.
*   [ ] Keep `require('path')`.
*   [ ] Keep `require('fs')` *only* if needed for checks during production path loading (`fs.existsSync`, `fs.accessSync`). Remove if not directly used here.
*   [ ] Remove requires for `os`, `p-queue`, `lodash` (if any remain), `ignore`.
*   [ ] Add requires for all the new modules:
    *   `require('./config.js')` as `config`
    *   `require('./utils.js')` as `utils`
    *   `require('./ignore-handler.js')` as `ignoreHandler`
    *   `require('./file-processor.js')` as `fileProcessor`
    *   `require('./directory-processor.js')` as `directoryProcessor`
    *   `require('./watcher.js')` as `watcher`
    *   `require('./ipc-manager.js')` as `ipcManager`
*   [ ] Keep global `mainWindow` variable (`let mainWindow;`).
*   [ ] **Function: `createWindow`**
    *   [ ] Keep the creation of `BrowserWindow` with webPreferences.
    *   [ ] Keep CSP header setup using `session.defaultSession.webRequest.onHeadersReceived`.
    *   [ ] Keep window event handlers (`'closed'`, potentially `'focus'`/'`blur'` if relevant).
    *   [ ] Keep the `before-input-event` handler for 'Escape' key:
        *   Check `if (input.key === 'Escape' && directoryProcessor.isScanning()) { ... }`.
        *   Call `directoryProcessor.cancelScan('user');`.
        *   Keep `event.preventDefault()`.
    *   [ ] Keep `mainWindow.loadURL`/`loadFile` logic for dev/prod. Ensure production path (`prodPath`) calculation is correct.
    *   [ ] Keep `webContents.openDevTools()` for development.
    *   [ ] Keep `did-finish-load` logic if needed (`startup-mode`).
*   [ ] **App Lifecycle:**
    *   `app.whenReady().then(() => { ... });`
        *   Inside the `.then()`:
            *   Call `createWindow()`.
            *   **Instantiate/Inject Dependencies:** Create instances or pass modules. Example:
                ```javascript
                // No instantiation needed for functional modules like config, utils
                // Modules like ignoreHandler, fileProcessor manage their own state internally

                // Register IPC handlers, passing module references
                ipcManager.registerHandlers({
                  directoryProcessor: directoryProcessor,
                  ignoreHandler: ignoreHandler,
                  fileProcessor: fileProcessor,
                  watcher: watcher,
                  config: config // Pass config if needed by handlers directly
                  // Inject other modules if ipcManager needs them
                });
                console.log('[Main] IPC Handlers Registered.');
                ```
            *   Keep `app.on('activate', ...)` logic.
    *   `app.on('window-all-closed', () => { ... });`
        *   Keep platform check.
        *   Ensure `await watcher.shutdownWatcher();` is called before `app.quit()`.
    *   `app.on('before-quit', async (event) => { ... });`
        *   Ensure `await watcher.shutdownWatcher();` is called.
*   [ ] Remove all other functions and global variables that were moved to other modules. `main.js` should now be significantly smaller.
*   [ ] Remove the `module.exports` at the end of `main.js` (the exported functions were moved).

---

**Final Verification:**

*   [ ] Thoroughly test all application features:
    *   Opening folders.
    *   File listing accuracy (respecting ignore rules).
    *   Automatic vs. Global ignore mode switching.
    *   Applying custom ignore patterns (if UI supports it).
    *   Correct file exclusion (binary, size limits, default excludes).
    *   Token counts.
    *   File content concatenation and copying.
    *   Progress indicators and cancellation (Escape key, timeout).
    *   File watcher updates (add, change, remove files after initial load).
    *   Cache clearing functionality.
    *   Error handling (inaccessible folders, large files).
*   [ ] Check console logs in both main and renderer processes for errors or unexpected warnings.
*   [ ] Review file sizes to ensure they meet the guidelines where practical.
*   [ ] Confirm no original functionality has been lost or altered.