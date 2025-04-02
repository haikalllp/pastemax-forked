# Implementation Plan: Performance & .gitignore Improvements 1.2.2

This plan addresses performance issues and .gitignore handling based on the KnownIssue.md report. The goal is to optimize file scanning through caching, reordering processing checks, and enhancing file tree metadata while keeping all existing features intact.

---

## Objectives

1. **Performance Improvements**
   - **Reduce Load Times:** Optimize chunk processing and introduce caching for file metadata.
   - **Enhance UI Responsiveness:** Prevent UI slowdowns with large repositories.

2. **.gitignore Handling**
   - **Unified Ignore Filter:** Merge multiple `.gitignore` files from deep repositories into one unified filter.
   - **Persistent Cache:** Cache the ignore filter for the entire session.
   - **Reorder Checks:** Apply ignore filtering before expensive file I/O operations.
   - **Binary Exception Post-Ignores:** Only perform binary checks after the ignore filter has been applied.
   - **Binary Flag:** Propagate a `hasBinaries` flag in directory nodes to indicate the presence of binary files.

3. **Documentation & Code Comments**
   - Update inline comments and developer documentation to explain new caches, processing logic, and metadata enhancements.

Refer to this flow diagram for visual detail of change
![Flow Diagram](newCache.png)

---

## Task Checklist & Progress Tracking

### 1. Unified & Cached .gitignore Handling ✅

- [x] **Task 1.1: Create Global Ignore Cache**
  - **File:** `main.js`
  - **Action:** Declare an in‑memory cache (using a `Map`) keyed by the normalized root directory.
  - **Example:**
    ```js
    // Global cache for ignore filters
    const ignoreCache = new Map();
    ```
  - **Outcome:** Reuse the ignore filter for subsequent loads to reduce disk I/O.

- [x] **Task 1.2: Implement `collectCombinedGitignore(rootDir)`**
  - **File:** `main.js`
  - **Action:** Create an async function to traverse `rootDir`, find all `.gitignore` files, parse and merge unique patterns into a `Set`.
  - **Example:**
    ```js
    async function collectCombinedGitignore(rootDir) {
      const ignorePatterns = new Set();
      async function traverse(dir) {
        const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
          const fullPath = safePathJoin(dir, dirent.name);
          if (dirent.isDirectory()) {
            await traverse(fullPath);
          } else if (dirent.isFile() && dirent.name === '.gitignore') {
            try {
              const content = await fs.promises.readFile(fullPath, "utf8");
              content.split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'))
                .forEach(pattern => ignorePatterns.add(normalizePath(pattern)));
            } catch (err) {
              console.error(`Error reading ${fullPath}:`, err);
            }
          }
        }
      }
      await traverse(rootDir);
      return ignorePatterns;
    }
    ```
  - **Outcome:** All .gitignore patterns are collected and merged for the session.

- [x] **Task 1.3: Modify `loadGitignore(rootDir)` to Use the Cache**
  - **File:** `main.js`
  - **Action:** Update `loadGitignore` to first check the cache. If not cached, add default patterns, merge excluded files, then asynchronously add the combined .gitignore patterns and cache the result.
  - **Example:**
    ```js
    function loadGitignore(rootDir) {
      rootDir = ensureAbsolutePath(rootDir);
      if (ignoreCache.has(rootDir)) {
        return ignoreCache.get(rootDir);
      }
      
      const ig = ignore();
      // Add default ignores
      ig.add([".git", "node_modules", ".DS_Store", "Thumbs.db", "desktop.ini", ".idea", ".vscode", "dist", "build", "out"]);
      ig.add(excludedFiles.map(pattern => normalizePath(pattern)));
      
      collectCombinedGitignore(rootDir)
        .then(patterns => {
          ig.add(Array.from(patterns));
          ignoreCache.set(rootDir, ig);
        })
        .catch(err => console.error("Error merging .gitignore files:", err));
      
      return ig;
    }
    ```
  - **Outcome:** Efficient, unified ignore processing for the duration of the session.

---

### 2. File Metadata Caching ✅

- [x] **Task 2.1: Introduce Global File Cache**
  - **File:** `main.js`
  - **Action:** Declare a global cache using a `Map` to store file metadata (size, content, token count) keyed by full file path.
  - **Example:**
    ```js
    const fileCache = new Map();
    ```
  - **Outcome:** Minimizes redundant file reads during scanning.

- [x] **Task 2.2: Integrate Cache in `readFilesRecursively`**
  - **File:** `main.js`
  - **Action:** In the chunk loop, check the cache before processing each file. If the file data exists in the cache, return it; otherwise, process and then cache the data.
  - **Example:**
    ```js
    const fullPath = safePathJoin(dir, dirent.name);
    if (fileCache.has(fullPath)) {
      return fileCache.get(fullPath);
    }
    // Process file (stats, content, etc.)
    // After processing:
    fileCache.set(fullPath, fileData);
    return fileData;
    ```
  - **Outcome:** Reduces repeated I/O and speeds up file processing.

---

### 3. Reordering File Processing Checks ✅

- [x] **Task 3.1: Update Order in `readFilesRecursively`**
  - **File:** `main.js`
  - **Action:** After calculating the `relativePath` of a file, immediately check if it should be ignored using the ignore filter. Only process the file further (e.g., size and binary checks) if it is not ignored.
  - **Example:**
    ```js
    // After calculating relativePath:
    if (ignoreFilter && ignoreFilter.ignores(relativePath)) {
      console.log(`Ignoring file: ${relativePath}`);
      return null;
    }
    // Continue with file size check and binary file detection...
    ```
  - **Outcome:** Prevents unnecessary file processing, improving performance.

- [x] **Task 3.2: Validate Return Structure**
  - **Status:** Verified - Output structure maintains compatibility with downstream components
  - **Action:** Verify that the output from `readFilesRecursively` remains consistent with previous behavior.
  - **Outcome:** Ensures no downstream functionality (file sorting, UI updates, copying) is affected.

---

### 4. Propagating a `hasBinaries` Flag in the File Tree ✅

- [x] **Task 4.1: Update the Data Model**
  - **File:** `FileTypes.ts`
  - **Action:** Extended the `TreeNode` interface to include `hasBinaries` property
  - **Status:** Completed - Interface updated and working

- [x] **Task 4.2: Update Tree Building in `Sidebar.tsx`**
  - **File:** `Sidebar.tsx`
  - **Action:** Implemented binary flag propagation through tree structure
  - **Status:** Completed - Binary detection properly propagates up the tree
  - **Implementation:**
    ```ts
    const updateBinaryFlag = (node: TreeNode): boolean => {
      if (node.type === "file") {
        return node.fileData?.isBinary || false;
      }
      if (node.children) {
        node.hasBinaries = node.children.some(child => updateBinaryFlag(child));
        return node.hasBinaries;
      }
      return false;
    };
    ```

- [x] **Task 4.3: Update UI in `TreeItem.tsx`**
  - **File:** `TreeItem.tsx` and `index.css`
  - **Action:** Added badges for both binary files and folders containing binaries
  - **Status:** Completed - Includes:
    - Distinct styling for file vs folder badges
    - Theme compatibility for both light and dark modes
    - Text updates ("Binary" for files, "Has Binary Files" for folders)

---

### 5. Documentation & Code Comments

- [x] **Task 5.1: Update Inline Comments in `main.js`**
  - **Action:** All new components fully documented with JSDoc comments
  - **Status:** Completed - Added clear documentation for caching mechanisms and processing logic

- [x] **Task 5.2: Revise Comments in `Sidebar.tsx` and `FileTypes.ts`**
  - **Action:** Added documentation for:
    - `hasBinaries` property in TreeNode interface
    - Binary flag propagation logic in Sidebar.tsx
    - Badge rendering logic in TreeItem.tsx
  - **Status:** Completed with clear documentation of binary handling

- [x] **Task 5.3: Update Developer Documentation**
  - **Status:** Completed all documentation updates including performance improvements
  - **Action:** Add a section to the project CHANGELOG.md summarizing the performance improvements and caching strategies.
  - **Outcome:** Ensures that all team members understand the new architecture.

---

## Final Testing & Rollout

- **Manual Verification:**  
  - Confirm folder selection, file tree generation, file copying, and search functionalities behave as before.
  - Validate performance improvements on large repositories.
- **Regression Testing:**  
  - Ensure that caching and new ignore filters do not introduce inconsistencies.
- **Performance Monitoring:**  
  - Check load times and UI responsiveness to verify improvements meet the project’s objectives.

---

## Progress Reporting

- Update this checklist in your project management tool or through commit messages as tasks are completed.
- Schedule regular code reviews to ensure that new changes do not break existing functionality.
- Merge changes incrementally, running regression tests after each major task.

---

# Additional Implementation Plan: UI Performance & Backend Reliability 1.2.3

This section outlines further improvements focusing on UI responsiveness for large repositories and backend loading robustness.

---

## Additional Objectives

1.  **Backend Reliability & Feedback:**
    *   Improve chunk loading mechanism in `main.js` to be time-based, preventing main thread blockage.
    *   Enhance IPC progress messages with more granular details (counts, current directory).
2.  **Frontend UI Performance:**
    *   Implement UI virtualization for the file tree in `Sidebar.tsx` to handle large datasets efficiently.
    *   Optimize `TreeItem.tsx` rendering using memoization.
    *   Review and optimize state update logic for selection/expansion in `App.tsx`.
3.  **Documentation:**
    *   Update this plan and `CHANGELOG.md` to reflect these new enhancements.

---

## Additional Task Checklist & Progress Tracking

### 6. Backend Reliability & Feedback (main.js)

-   [ ] **Task 6.1: Implement Dynamic Chunking**
    *   **File:** `main.js`
    *   **Action:** Modify `readFilesRecursively` to process files based on time slices (e.g., 50ms per chunk) instead of a fixed count. Use `process.nextTick` or `setImmediate` to yield control back to the event loop between chunks.
    *   **Outcome:** More reliable scanning for large/deep repos, preventing crashes due to prolonged main thread blocking.

-   [ ] **Task 6.2: Enhance Progress Reporting**
    *   **File:** `main.js`
    *   **Action:** Modify `readFilesRecursively` to track `processedCount`, `totalFileCount` (estimated initially, refined as scanning progresses), and `currentDirectory`. Send these details via `file-processing-status` IPC events.
    *   **Outcome:** More informative loading indicator in the UI, providing better user feedback.

#### Explanation:
Refer to [ChunkLoad](chunkLoad.png)

- **Initiation**: The Renderer requests the file list.
- **Start Scan**: `main.js` starts `readFilesRecursively` and sends an initial "processing" status.
- **Directory Loop**: It reads directories from the file system.
- **Time-Sliced Chunk Loop**: Instead of a fixed number of files, it processes files within a time budget (e.g., 50ms).
- **File Processing**: Inside the chunk loop, it performs checks (ignore, cache), reads file info if needed (stat, readFile), counts tokens, caches the result, and adds it to the list.
- **Yield & Report**: After each time slice (or chunk), it sends a detailed file-processing-status update to the UI (including counts and current directory) and then yields control back to the event loop `(setImmediate or process.nextTick)` to keep the application responsive.
- **Completion**: Once all files/directories are processed, it sends the final "complete" status and the full file list data.



---

### 7. Frontend UI Performance Optimization (React Components)

-   [ ] **Task 7.1: Improve Visual Loading Progress Indicator**
    *   **File:** `src/components/Sidebar.tsx`
    *   **Action:** Update the loading indicator UI (`tree-loading` div) to utilize the enhanced progress data received from `main.js` (via `file-processing-status` IPC). Display details like "Processed X/Y files" and the current directory being scanned. Consider adding a visual progress bar.
    *   **Outcome:** Provides users with much clearer feedback on the loading progress, especially for large repositories.

-   [ ] **Task 7.2: Implement Tree Virtualization**
    *   **File:** `src/components/Sidebar.tsx`
    *   **Action:** Integrate `react-window` (FixedSizeList) or `react-virtualized` (List) to render only the visible `TreeItem` components based on scroll position. Calculate item heights accurately.
    *   **Outcome:** Significant improvement in UI responsiveness (scrolling, interaction) for repositories with thousands of files/folders.

-   [ ] **Task 7.3: Memoize TreeItem Component**
    *   **File:** `src/components/TreeItem.tsx`
    *   **Action:** Wrap the `TreeItem` component export with `React.memo`. Ensure props passed down are stable where possible.
    *   **Outcome:** Reduces unnecessary re-renders of individual tree items, improving overall rendering performance during state changes.

-   [ ] **Task 7.4: Optimize Selection/Expansion Logic**
    *   **Files:** `src/App.tsx`, `src/components/Sidebar.tsx`
    *   **Action:** Analyze how `selectedFiles` and `expandedNodes` state updates trigger re-renders. Optimize state update functions (`toggleFileSelection`, `toggleFolderSelection`, `toggleExpanded`) to minimize unnecessary recalculations or broad state changes. Consider using more targeted updates if possible.
                    *   **Outcome:** Faster and smoother user interactions when selecting/deselecting items or expanding/collapsing folders.

---

### 8. Documentation Updates

-   [ ] **Task 8.1: Update `docs/fixesPlan.md`**
    *   **Action:** Ensure this section (Tasks 6-8) is correctly added and formatted. Mark tasks as complete as they are implemented.
    *   **Outcome:** Plan document accurately reflects current development goals.

-   [ ] **Task 8.2: Update `CHANGELOG.md`**
    *   **Action:** Add entries under "Unreleased" summarizing the backend reliability and frontend performance enhancements once implemented.
    *   **Outcome:** Changelog provides a clear record of improvements for users and developers.

---

*This additional plan focuses on enhancing robustness and UI performance for large-scale repositories, building upon the previous optimizations.*



## Refined Plan & Analysis (Tasks 6-8)

Based on code review of `main.js`, `Sidebar.tsx`, and `TreeItem.tsx`, the plan for Tasks 6-8 is confirmed with the following analysis:

**Task 6: Backend Reliability & Feedback (main.js)**
*   **6.1 (Dynamic Chunking):** Architecturally sound. Improves robustness by preventing main thread blocking during large scans using time-slicing instead of fixed counts. Builds upon existing `readFilesRecursively`.
*   **6.2 (Enhanced Progress Reporting):** Good enhancement. Provides much better UX during loading by sending more detailed progress info (counts, current directory) via IPC. Requires adding tracking within `readFilesRecursively`.
*   **Conclusion:** Task 6 is safe and beneficial.

**Task 7: Frontend UI Performance Optimization (React Components)**
*   **7.1 (Improve Loading Indicator):** Straightforward UI improvement, directly uses data from Task 6.2.
*   **7.2 (Implement Tree Virtualization):** **Necessary for large repositories.** The current `Sidebar.tsx` renders *all* visible nodes (`.map` over `visibleTree`), causing performance issues with thousands of files. Virtualization (using `react-window` or similar) renders only the on-screen items, directly solving this bottleneck. While it adds implementation complexity to `Sidebar.tsx`, it's the standard solution and optimizes the presentation layer significantly without altering core data flow.
*   **7.3 (Memoize TreeItem):** Highly recommended. `TreeItem.tsx` is complex; `React.memo` will prevent unnecessary re-renders, improving list performance.
*   **7.4 (Optimize Selection/Expansion Logic):** Important. Optimizing how `selectedFiles` and `expandedNodes` state is updated in `App.tsx` will reduce unnecessary work and re-renders in `Sidebar.tsx` and `TreeItem.tsx`.
*   **Conclusion:** Task 7 addresses identified performance bottlenecks. Virtualization (7.2) is key for large file counts, complemented by memoization (7.3) and state optimization (7.4).

**Task 8: Documentation Updates**
*   Standard updates to reflect implemented changes in this plan and the `CHANGELOG.md`.

**Architectural Integrity:**
*   Task 6 modifies the *how* of backend processing (time-slicing, better progress) but not the *what*.
*   Task 7 primarily affects the *rendering* layer (`Sidebar.tsx`, `TreeItem.tsx`) and state update *efficiency* (`App.tsx`), not fundamental data structures or application flow.

**Overall Flow Diagram:**

```mermaid
graph TD
    subgraph Backend - main.js
        A[Renderer requests files] --> B[readFilesRecursively]
        B -- Time-Sliced Chunks --> C{Process File Chunk}
        C -- Check Ignore/Cache --> D[Read File Info / Count Tokens]
        D --> E[Add to Results / Cache]
        C -- Yield setImmediate --> B
        B -- IPC: file-processing-status → --> F[IPC: file-processing-status - Detailed]
        B -- On Completion --> G[IPC: file-processing-complete - Full List]
    end

    subgraph Frontend - React
        F --> H[Sidebar: Update Loading Indicator]
        G --> I[App.tsx: Set allFiles state]
        I -- Optimized State Update --> J[Sidebar: Receives allFiles]
        J --> K{Build Tree Structure}
        K --> L[Sidebar: Render Tree]
        L -- Uses react-window --> M[Render Only Visible TreeItems]
        M -- Uses Memoized TreeItem --> N[Display Item]
        O[User Interaction: Select or Expand] -- Optimized Handler --> I
    end
```
