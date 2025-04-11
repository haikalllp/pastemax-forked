## 1. Ignore Mode Persistence and Backend Cache Clearing

### Overview

This change ensures that user-defined ignore settings persist even after a "Clear All" operation, preventing the application from reverting to the default 'automatic' mode.

### Original Problem

- User ignore settings were lost after using the "Clear All" function.
- The application reverted to default 'automatic' mode, disregarding customizations.

### Implemented Solution

#### Backend Changes

- **Updated `request-file-list` handler in `main.js`:**
  - Now properly uses the `ignoreMode` and `customIgnores` values sent from the frontend.

#### Frontend Changes

- **Persistent Flag:**
  - Added an `ignoreSettingsModified` flag in `src/hooks/useIgnorePatterns.ts` that is stored in `localStorage` under the key `pastemax-ignore-settings-modified`.
  - The flag is set when `setIgnoreMode` or `setCustomIgnores` is invoked.
- **Cache Management in `src/App.tsx`:**
  - Modified the "Clear All" process to preserve the `pastemax-ignore-settings-modified` flag.
  - In `handleFolderSelected`, if the flag is `true`, a `clear-main-cache` IPC message is sent to the backend before requesting the file list, then the flag is reset.

### User Benefits

- Settings persist after clearing data.
- More reliable and consistent behavior.
- Enhanced user experience.

## 2. .gitignore Handling Refactor

### Overview

Improved the logic handling `.gitignore` files to better support deep directory structures and monorepos.

### Changes Made

- **Recursive Traversal Refactor:**

  - Optimized `collectGitignoreMapRecursive` to better handle deep structures and potential permission errors.
  - Removed some hardcoded directory skips in favor of pattern-based exclusion.

- **Pattern Relativity Improvements:**
  - Modified `loadGitignore` so that patterns from nested `.gitignore` files are correctly interpreted relative to their location.
  - Merged default patterns and global exclusions from `excluded-files.js` with repository-specific rules for consistency.

### User Benefits

- More accurate and efficient ignore rule application.
- Better compatibility with monorepo structures where multiple `.gitignore` files coexist.

## 3. File Loading Performance Optimizations

### Overview

Optimized the core file loading and processing logic in `main.js` to improve responsiveness when handling large repositories or deep directory structures.

### Changes Made

- **Controlled Concurrency:**
  - Introduced a controlled concurrency mechanism (using a library like `p-queue`) to limit simultaneous file system operations and token counting.
- **Throttled IPC Communication:**
  - Reduced the frequency of IPC status updates (`file-processing-status`) to minimize UI overhead.
- **Enhanced Error Handling and Caching:**
  - Improved error handling within the file processing loop and refined caching strategies (`fileCache`, `fileTypeCache`) to reduce redundant operations.

### User Benefits

- Faster load times and reduced UI lag for large projects.
- More efficient resource use, particularly in deep or complex directory structures.
- Overall enhanced performance and a smoother user experience.

## Conclusion

These updates collectively address long-standing issues including ignore setting persistence, accurate application of .gitignore rules, and performance bottlenecks during file scanning. Users benefit from a more reliable and responsive application, especially when working with large or complex repositories.
