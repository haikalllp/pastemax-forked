# DONE! [X]

# Plan: View Applied Ignore Patterns Feature

## 1. Goal

Allow users to view the complete, combined set of ignore patterns (default, `excluded-files.js`, and repository `.gitignore` files) currently being applied to the selected folder within the PasteMax application. This enhances transparency and helps users diagnose why specific files might be excluded.

## 2. Backend Implementation (`main.js`)

### 2.1. Store Raw Patterns Alongside Ignore Object

- **Modify `loadGitignore` function:**
  - When collecting patterns (default, `excludedFiles`, and from `collectCombinedGitignore`), store these raw pattern strings in separate arrays or a structured object.
  - When caching the `ignore` instance (`ig`) in `ignoreCache`, store this structured list of raw patterns alongside it. The cache entry for a `rootDir` could look like: `{ ig: ignoreInstance, patterns: { default: [...], excluded: [...], gitignore: [...] } }`.
  - Ensure the function still returns the `Promise<object>` resolving to the `ignore` instance (`ig`) for its primary use in filtering.

```javascript
// Example structure for ignoreCache entry
// ignoreCache.set(rootDir, { ig: igInstance, patterns: categorizedPatterns });

// Example categorizedPatterns structure
// const categorizedPatterns = {
//   default: ["pattern1", "pattern2"],
//   excludedFiles: ["patternA", "patternB"],
//   gitignore: ["repoPatternX", "repoPatternY"]
// };
```

### 2.2. Create IPC Handler to Retrieve Patterns

- **Implement `ipcMain.handle('get-ignore-patterns', ...)`:**
  - This handler will take the `rootDir` (the currently selected folder path) as an argument.
  - It should first ensure the ignore rules for that `rootDir` are loaded and cached by calling `await loadGitignore(rootDir)`. This leverages the existing logic and caching.
  - Retrieve the cached entry from `ignoreCache` for the given `rootDir`.
  - Extract the structured list of raw patterns (`categorizedPatterns`) from the cached entry.
  - Return this structured list to the renderer process.
  - Handle cases where the `rootDir` might not be in the cache yet or if loading fails.

```javascript
ipcMain.handle('get-ignore-patterns', async (event, rootDir) => {
  if (!rootDir) {
    return { error: 'No directory selected' };
  }
  try {
    // Ensure rules are loaded and cached (leverages existing caching)
    await loadGitignore(rootDir);

    const cachedData = ignoreCache.get(ensureAbsolutePath(rootDir));
    if (cachedData && cachedData.patterns) {
      console.log(
        `Returning ${cachedData.patterns.default?.length || 0} default, ${cachedData.patterns.excludedFiles?.length || 0} excluded, ${cachedData.patterns.gitignore?.length || 0} gitignore patterns for ${rootDir}`
      );
      return { patterns: cachedData.patterns };
    } else {
      console.warn(`No cached patterns found for ${rootDir}, attempting reload.`);
      // Attempt a reload just in case, though loadGitignore should have handled it
      const ig = await loadGitignore(rootDir); // Re-trigger load/cache
      const reloadedCachedData = ignoreCache.get(ensureAbsolutePath(rootDir));
      if (reloadedCachedData && reloadedCachedData.patterns) {
        return { patterns: reloadedCachedData.patterns };
      }
      return { error: 'Could not retrieve ignore patterns.' };
    }
  } catch (error) {
    console.error('Error retrieving ignore patterns:', error);
    return { error: `Failed to get ignore patterns: ${error.message}` };
  }
});
```

## 3. Frontend Implementation (`src/`)

### 3.1. Add UI Trigger Button (`src/App.tsx`)

- **Placement:** Add a new button, potentially near the "Select Folder" and "Clear Data" buttons in the header, or perhaps within the Sidebar near the file list controls. Consider an icon button (e.g., info icon `ⓘ` or filter list icon) with a descriptive tooltip like "View Applied Ignore Rules".
- **Styling:** Ensure the button style matches the application's current theme (light/dark modes). Use existing CSS classes or add new ones as needed.
- **Action:** The button's `onClick` handler will trigger the process to fetch and display the ignore patterns.

### 3.2. State Management (`src/App.tsx`)

- Add state variables:
  - `isIgnoreViewerOpen` (boolean): To control the visibility of the patterns viewer (modal/panel).
  - `ignorePatterns` (object | null): To store the structured list of patterns fetched from the main process.
  - `ignorePatternsError` (string | null): To store any error message during fetching.

### 3.3. Create Ignore Patterns Viewer Component (`src/components/IgnorePatternsViewer.tsx`)

- **Component Type:** Create a modal dialog or a slide-out panel component. A modal might be simpler initially.
- **Props:** It should accept `isOpen` (boolean), `onClose` (function), `patterns` (structured object), and `error` (string | null) as props.
- **Display Logic:**
  - If `isOpen` is false, render nothing.
  - If `error` is present, display the error message.
  - If `patterns` is available, display the patterns grouped by source (e.g., "Defaults", "Global Exclusions (`excluded-files.js`)", "Repository `.gitignore` Rules").
  - Use a scrollable container (`<pre>` or a styled `<div>`) to list the patterns within each group.
  - Include a prominent "Close" button that calls the `onClose` prop.
- **Styling:** Style the modal/panel and its contents consistently with the app theme. Ensure readability and good contrast.

### 3.4. Integrate Viewer and Fetch Logic (`src/App.tsx`)

- **Button `onClick` Handler:**
  - Set loading state (optional but good UX).
  - Call `window.electron.ipcRenderer.invoke('get-ignore-patterns', selectedFolder)`.
  - Use `.then()` and `.catch()` or `async/await` to handle the response.
  - On success: Update the `ignorePatterns` state with the received structured list and set `isIgnoreViewerOpen` to `true`. Clear any previous error.
  - On error: Update the `ignorePatternsError` state and set `isIgnoreViewerOpen` to `true` (so the error is shown in the modal). Clear the `ignorePatterns` state.
  - Clear loading state.
- **Render Viewer:** Conditionally render the `<IgnorePatternsViewer>` component based on `isIgnoreViewerOpen`, passing the necessary state variables and the `onClose` handler (which simply sets `isIgnoreViewerOpen` to `false`).

```tsx
// Example snippet in App.tsx

const [isIgnoreViewerOpen, setIsIgnoreViewerOpen] = useState(false);
const [ignorePatterns, setIgnorePatterns] = useState(null);
const [ignorePatternsError, setIgnorePatternsError] = useState(null);
// Add loading state if desired

const handleViewIgnorePatterns = async () => {
  if (!selectedFolder || !isElectron) return;
  // setLoading(true); // Optional
  setIgnorePatterns(null);
  setIgnorePatternsError(null);

  try {
    const result = await window.electron.ipcRenderer.invoke('get-ignore-patterns', selectedFolder);
    if (result.error) {
      setIgnorePatternsError(result.error);
    } else {
      setIgnorePatterns(result.patterns);
    }
  } catch (err) {
    console.error('Error invoking get-ignore-patterns:', err);
    setIgnorePatternsError(err.message || 'Failed to fetch ignore patterns.');
  } finally {
    // setLoading(false); // Optional
    setIsIgnoreViewerOpen(true);
  }
};

const closeIgnoreViewer = () => {
  setIsIgnoreViewerOpen(false);
  // Optionally clear patterns/error state here too
  // setIgnorePatterns(null);
  // setIgnorePatternsError(null);
};

// ... later in JSX ...

{
  /* Add the button somewhere strategic */
}
<button onClick={handleViewIgnorePatterns} title="View Applied Ignore Rules">
  View Ignores {/* Or use an icon */}
</button>;

{
  /* Render the modal */
}
<IgnorePatternsViewer
  isOpen={isIgnoreViewerOpen}
  onClose={closeIgnoreViewer}
  patterns={ignorePatterns}
  error={ignorePatternsError}
/>;
```

## 4. Styling (`src/styles/index.css`)

- Add CSS rules for the new "View Ignores" button.
- Add CSS rules for the `IgnorePatternsViewer` modal/panel, including:
  - Modal background/overlay.
  - Modal container positioning, padding, border-radius, background color (theme-aware).
  - Header/Title styling.
  - Content area styling (scrollable).
  - Pattern list styling (e.g., using `<pre>` or styled list items).
  - Close button styling.
  - Ensure responsiveness if necessary.

## 5. Testing

- Test with a folder that has no `.gitignore`.
- Test with a folder containing a simple `.gitignore`.
- Test with a folder containing nested `.gitignore` files.
- Test with the repository containing the `*.md` rule to verify it's displayed.
- Test light and dark modes.
- Test clicking the button before a folder is selected.
- Test error handling (e.g., simulate an error in the IPC handler).
