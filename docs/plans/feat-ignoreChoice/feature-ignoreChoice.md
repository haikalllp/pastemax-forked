Below is a very detailed markdown checklist broken down into one-story-point tasks for every story in this project plan. Each task is represented by an unchecked checkbox. This checklist covers all modifications in the main process, the renderer/UI, data structures/interfaces, styling, and documentation. Use this list as a step‐by‐step guide for the autonomous AI Coding Agent.

---

# Global vs. Automatic Ignore Mode Feature Implementation Checklist

## 1. Main Process (main.js) Modifications

### 1.1. Update the `loadGitignore` Function

- [x] **Add New Parameters:**
  - Modify the function signature of `loadGitignore` to accept two new parameters:
    - `mode` (type: `'automatic' | 'global'`, defaulting to `'automatic'`)
    - `customIgnores` (type: `string[]`, defaulting to an empty array)
- [x] **Create Composite Cache Key:**
  - In `loadGitignore`, generate a cache key using the normalized `rootDir`, the chosen `mode`, and `JSON.stringify(customIgnores)`.
- [x] **Check Cache Using Composite Key:**
  - Verify if the ignore filter for the composite key exists in `ignoreCache` and return it if available.
- [x] **Global Mode – Build Global Ignore Filter:**
  - If `mode` is `'global'`:
    - [x] Combine `excludedFiles` and `customIgnores` into a single array (globalPatterns).
    - [x] Initialize the ignore filter with `ig.add(globalPatterns)`.
    - [x] Log a message showing the global ignore filter creation along with the patterns used.
    - [x] Cache the ignore filter and the patterns using the composite cache key, storing the patterns in a structure such as `{ global: globalPatterns }`.
    - [x] Return the ignore filter.
- [x] **Automatic Mode – Preserve Gitignore Scanning:**
  - If `mode` is `'automatic'`:
    - [x] Remove any redundant default patterns (if present) from previous implementations.
    - [x] Add `excludedFiles` to the ignore filter with `ig.add(excludedFiles)` and log the addition.
    - [x] Call `collectGitignoreMapRecursive` to obtain a map of .gitignore patterns.
    - [x] For each entry in the gitignore map:
      - [x] Generate `patternsToAdd` by prepending directory context when necessary.
      - [x] Add these patterns to the ignore filter with `ig.add(patternsToAdd)`.
      - [x] Keep a running total of the added patterns and log the count.
    - [x] Cache the ignore filter using the composite key, storing the patterns in a structure like `{ gitignoreMap: ... }`.
    - [x] Return the ignore filter.

### 1.2. Update the IPC Handler for `get-ignore-patterns`

- [x] **Change Parameter Format:**
  - Modify the IPC handler to expect an object instead of a string. The object should have:
    - `folderPath` (string)
    - `mode` (either `'automatic'` or `'global'`, defaulting to `'automatic'`)
    - `customIgnores` (string[], defaulting to an empty array)
- [x] **Destructure and Validate Options:**
  - In the IPC handler, destructure the object to extract `folderPath`, `mode`, and `customIgnores`.
  - Ensure that `folderPath` is provided; if not, return an error.
- [x] **Call the Updated `loadGitignore`:**
  - Pass `folderPath`, `mode`, and `customIgnores` to `loadGitignore`.
- [x] **Retrieve and Return Cached Patterns:**
  - Use the composite key (constructed in the same way as in `loadGitignore`) to retrieve cached patterns.
  - Log the mode and folder details before returning.
  - Return the patterns or an error if retrieval fails.

---

## 2. Renderer Process (UI) Modifications

### 2.1. Update the Ignore Patterns Viewer Modal (src/components/IgnorePatternsViewer.tsx)

- [x] **Add Ignore Mode Toggle Control:**
  - Create a new state variable `ignoreMode` (type: `'automatic' | 'global'`, defaulting to `'automatic'`).
  - [x] Add a UI control (e.g., a segmented button or toggle switch) at the top of the modal with two buttons:
    - One labeled “Automatic Gitignore”
    - One labeled “Global Ignore”
  - [x] Implement onClick handlers so that selecting one button sets `ignoreMode` and visually deactivates the other.
- [x] **Implement Custom Global Ignores Section:**
  - [x] When `ignoreMode` is `'global'`, render a new section below the toggle.
  - [x] Create a state variable `customIgnoreInput` for the text input and `customIgnores` (an array of strings).
  - [x] Add an input field with a placeholder (e.g., “Enter additional ignore pattern”).
  - [x] Add an “Add Pattern” button that, when clicked:
    - Trims the input.
    - Appends the pattern to `customIgnores`.
    - Clears the input field.
  - [x] Render a list (e.g., `<ul>`) displaying each custom ignore pattern.
- [x] **Update the Fetch/Invocation Logic:**
  - Modify the `handleViewIgnorePatterns` function so that when the user triggers the view:
    - It invokes `window.electron.ipcRenderer.invoke('get-ignore-patterns', options)` with an object that contains:
      - `folderPath`: the currently selected folder.
      - `mode`: the current value of `ignoreMode`.
      - `customIgnores`: if `ignoreMode` is `'global'`, pass the `customIgnores` array; otherwise, pass an empty array.
  - [x] Ensure error handling and state updates are maintained.
  - [x] Log debugging information that includes the current mode and custom ignores.

### 2.2. Update the `useIgnorePatterns` Hook (src/hooks/useIgnorePatterns.ts)

- [x] **Add New State Variables in the Hook:**
  - Add state for `ignoreMode` (defaulting to `'automatic'`).
  - Add state for `customIgnores` (defaulting to an empty array).
- [x] **Expose New States and Setters:**
  - Update the hook’s return object to include `ignoreMode`, `setIgnoreMode`, `customIgnores`, and `setCustomIgnores` (if needed).
- [x] **Ensure Updated Invocation in the Hook:**
  - Modify the hook’s `handleViewIgnorePatterns` function to use the new states when invoking the IPC call.

---

## 3. Data Structure and Interface Updates

- [x] **Update IPC Parameter Types:**
  - Update TypeScript definitions and JSDoc comments for the IPC channel `get-ignore-patterns` to reflect that it now expects an object with:
    - `folderPath`: string
    - `mode`: `'automatic' | 'global'`
    - `customIgnores`: string[]
- [x] **Update Caching Key Logic:**
  - Confirm that the caching in `loadGitignore` uses a composite key based on the folder path, mode, and custom ignores.
- [x] **Update Documentation:**
  - Update inline documentation in main.js and related files to explain the new parameters and mode behavior.

---

## 4. CSS and UI Styling Adjustments (src/styles/index.css)

- [x] **Style the Ignore Mode Toggle Control:**
  - Create a new CSS class (e.g., `.ignore-mode-toggle`) for the container of the toggle buttons.
  - [x] Define styles for the active state of the toggle buttons.
  - [x] Ensure the toggle control matches the modern theme and integrates with existing header styles.
- [x] **Style the Custom Global Ignores Section:**
  - Create styles for the input field (e.g., `.custom-global-ignores input`) to match current input styling.
  - [x] Style the “Add Pattern” button to match the primary button theme.
  - [x] Style the list (e.g., `<ul>` and `<li>`) displaying custom ignore patterns.
- [x] **Ensure Consistent Layout:**
  - Verify that the new elements do not disrupt the overall modal layout.
  - [x] Adjust margins/padding as needed for a balanced appearance.

---

## 5. Documentation and Comments

- [x] **Update Function Comments in main.js:**
  - Add comments to `loadGitignore` explaining the new parameters `mode` and `customIgnores`.
  - [x] Document the caching mechanism and how the composite key is built.
- [x] **Update IPC Handler Comments:**
  - Clarify in comments the expected structure of the object passed to `get-ignore-patterns`.
- [x] **Update Comments in the Ignore Patterns Viewer Component:**
  - Document the new toggle functionality and the purpose of the custom global ignore section.
- [x] **Update the Hook Documentation:**
  - Ensure the new state variables (`ignoreMode` and `customIgnores`) are documented in the `useIgnorePatterns` hook.

---

## 6. Integration and Validation Considerations

- [x] **Validate Mode Switching:**
  - Ensure that when the user switches between “Automatic Gitignore” and “Global Ignore,” the view updates immediately to show the correct patterns and settings.
- [x] **Confirm Global Mode Behavior:**
  - In global mode, verify that the ignore filter is built solely from `excludedFiles` plus any user-added custom ignores.
- [x] **Confirm Automatic Mode Behavior:**
  - In automatic mode, verify that the original .gitignore scanning functionality remains intact.
- [x] **Test Cache Differentiation:**
  - Validate that changes in mode or custom ignore entries create new cache entries and do not reuse the wrong ignore filter.
- [x] **Persist User Preferences (Optional):**
  - Consider saving the selected ignore mode and custom ignores to localStorage so that user settings persist between sessions.
- [x] **Review Console Logs:**
  - Ensure that logging in both main.js and the UI components provides clear debugging information for the new functionality.

---

This exhaustive checklist covers every detail required for implementing the new feature. Each checkbox represents a one-story-point task that must be completed. This list should enable an autonomous AI Coding Agent to proceed with the implementation without missing any critical details.
