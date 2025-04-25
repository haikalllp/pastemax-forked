# PasteMax Project Plan: Binary File Inclusion Feature

This checklist details the tasks required to add the ability to include binary file paths and types in the copied output, building upon the existing PasteMax application structure and features.

## 1. Binary File Inclusion Feature

- ### Story: Add toggle and state for including binary paths in output.

  - [x] **Define New Storage Key:** In `src/App.tsx`, add `STORAGE_KEYS.INCLUDE_BINARY_PATHS = 'pastemax-include-binary-paths';` to the `STORAGE_KEYS` object.
  - [x] **Add New State:** In `src/App.tsx`, add the state `const [includeBinaryPaths, setIncludeBinaryPaths] = useState(...)`.
  - [x] **Load State from localStorage:** Initialize `includeBinaryPaths` state by reading from `localStorage` using the new key: `useState(localStorage.getItem(STORAGE_KEYS.INCLUDE_BINARY_PATHS) === 'true')`. Handle the case where it's not in storage (defaults to `false`).
  - [x] **Persist State to localStorage:** In `src/App.tsx`, add a `useEffect` to save the `includeBinaryPaths` state to localStorage whenever it changes: `useEffect(() => { localStorage.setItem(STORAGE_KEYS.INCLUDE_BINARY_PATHS, String(includeBinaryPaths)); }, [includeBinaryPaths]);`.
  - [x] **Add Toggle UI:** In `src/App.tsx`, within the `.copy-button-wrapper` div, add a new `<label className="file-tree-option binary-option">` containing an `<input type="checkbox">`.
  - [x] **Bind Toggle to State:** Set the checkbox `checked` property to `includeBinaryPaths`.
  - [x] **Add Toggle Handler:** Attach an `onChange` handler to the checkbox that calls `setIncludeBinaryPaths(e.target.checked)`.
  - [x] **Pass State to Formatting:** In `src/App.tsx`, modify the `getSelectedFilesContent` function (which uses `formatContentForCopying`) to pass the `includeBinaryPaths` state as a parameter to `formatContentForCopying`.
  - [x] **Add Parameter to Formatting Function:** In `src/utils/contentFormatUtils.ts`, update the `FormatContentParams` interface to include `includeBinaryPaths: boolean;`.
  - [x] **Accept Parameter in Formatting Function:** Update the `formatContentForCopying` function signature to accept the `includeBinaryPaths` parameter via destructuring.

- ### Story: Modify formatting logic to separate and format binary paths.

  - [x] **Separate File Types:** In `src/utils/contentFormatUtils.ts`, inside `formatContentForCopying`, after sorting `selectedAndDisplayableFiles`, create two new arrays: `const textFiles = sortedSelected.filter(file => !file.isBinary);` and `const binaryFiles = sortedSelected.filter(file => file.isBinary);`.
  - [x] **Adjust Sorting Logic:** Modify the sorting logic within `formatContentForCopying` to handle the separation: sort text files by the chosen criteria, sort binary files separately (e.g., by name), and concatenate the sorted binary files after the sorted text files.
  - [x] **Format Text Files:** Keep the existing loop that iterates through `textFiles` and adds their content formatted with code fences.
  - [x] **Conditionally Add Binary Section:** After the text file loop, add an `if (includeBinaryPaths && binaryFiles.length > 0)` block.
  - [x] **Add Binary Section Header:** Inside the conditional block, if `textFiles.length > 0`, add a separator line like `# Binary Files\n\n`. If `textFiles.length === 0`, just add the header `# Binary Files\n`.
  - [x] **Format Binary File Entries:** Iterate through the `binaryFiles` array inside the conditional block. For each binary file, add its information formatted as `File: ${normalizePath(file.path)}\nThis is a file of the type: ${file.fileType || 'BINARY'}\n\n`. Use `normalizePath` for consistency.
  - [x] **Ensure Correct Tags:** Verify that all file entries (both text and binary) are included _within_ the `<file_contents>...</file_contents>` tags.

- ### Story: Allow selection of non-excluded binary files in the UI.

  - [x] **Refine Checkbox Disabled Logic:** In `src/components/TreeItem.tsx`, modify the `isCheckboxDisabled` computed property (using `useMemo`). It should return `true` _only if_ `fileData.isSkipped` or `fileData.excludedByDefault` is true. It should return `false` for binary files that are _not_ skipped or excluded.
  - [x] **Update Checkbox Change Handler:** In `TreeItem.tsx`, modify `handleCheckboxChange` to check `isCheckboxDisabled`. If true, call `e.preventDefault()` and `e.stopPropagation()`, then return.
  - [x] **Update Item Click Handler:** In `TreeItem.tsx`, modify `handleItemClick` to only call `toggleFileSelection(path)` if `type === 'file' && !isCheckboxDisabled`.
  - [x] **Update Directory Selection Helpers:** In `TreeItem.tsx`, modify the `areAllFilesInDirectorySelected` and `isAnyFileInDirectorySelected` callbacks. Update the filtering of `selectableChildren` to include binary files _unless_ they are `isSkipped` or `excludedByDefault`. The filter condition should be `child.type === 'directory' || !(child.fileData?.isSkipped || child.fileData?.excludedByDefault)`. Ensure the base cases for files in these recursive helpers correctly handle `isSkipped` and `excludedByDefault` (they should be excluded from the "selectable" count).
  - [x] **Update Initial Selection:** In `src/App.tsx`, in the `stableHandleFileListData` function, modify the initial default selection logic (`if (selectedFiles.length === 0)` block). The `selectablePaths` filter should now include binary files _unless_ they are `isSkipped` or `excludedByDefault`: `!file.isSkipped && !file.excludedByDefault`.
  - [x] **Update Select/Deselect All:** In `src/App.tsx`, modify the `selectAllFiles` and `deselectAllFiles` callbacks. The filtering of `displayedFiles` to get paths (`selectablePaths` in `selectAllFiles`, `displayedPathsToDeselect` in `deselectAllFiles`) should include binary files _unless_ they are `isSkipped` or `excludedByDefault`: `!file.isSkipped && !file.excludedByDefault`.

- ### Story: Display selected binary files in the file list view.

  - [x] **Include Binary Files in Display List:** In `src/components/FileList.tsx`, modify the `displayableFiles` filter (using `useMemo`). The filter should include files that are in `selectedFiles` AND are _not_ `isSkipped` AND are _not_ `excludedByDefault`. This will now include selected binary files.
  - [x] **Handle Binary File Card Display:** In `src/components/FileCard.tsx`, update the component to render binary files differently.
  - [x] **Binary Icon:** Use `useMemo` to determine the icon (`FileText` vs `FileWarning`) based on `file.isBinary`. Render this icon.
  - [x] **Binary Info:** Modify the `.file-card-info` section. If `file.isBinary`, display `file.fileType` (or 'BINARY') and `file.size` (formatted, e.g., KB) instead of `tokenCount`. Use conditional rendering based on `file.isBinary`.
  - [x] **Binary Card Styling:** Add a class (e.g., `binary-card`) to the root `.file-card` div based on `file.isBinary` for CSS styling.
  - [x] **Individual Copy Button for Binary:** In `FileCard.tsx`, modify the `textToCopy` memo. If the file is binary _and_ not skipped/excluded, the text should be formatted as `File: ${normalizePath(filePathNormalized)}\nThis is a file of the type: ${fileType || 'BINARY'}\n`. Otherwise, use `file.content`. Pass this `textToCopy` to the individual `CopyButton`.

- ### Story: Add CSS styles for binary files and the new toggle.
  - [x] **Add CSS:** In your main CSS file (e.g., `src/App.css` or `src/index.css`), add styles for the new classes:
    - `.file-tree-option.binary-option` (layout for the new checkbox label).
    - `.copy-button-wrapper label` (general label alignment).
    - `.copy-button-wrapper input[type="checkbox"]` (checkbox spacing).
    - `.copy-button-wrapper` (flex layout for buttons/checkboxes).
    - `.copy-button-main` (main copy button flexibility).
    - `.tree-item.binary-card` (style binary files in tree).
    - `.tree-item .tree-item-badge.tree-item-badge-binary-file` (style binary badge in tree).
    - `.tree-item .tree-item-size` (style size display in tree).
    - `.tree-item.disabled-item` (style skipped/excluded in tree).
    - `.tree-item .tree-item-badge.tree-item-badge-skipped` (style skipped badge).
    - `.tree-item .tree-item-badge.tree-item-badge-excluded` (style excluded badge).
    - `.file-card.binary-card` (style binary file cards).
    - `.file-card.binary-card .file-card-icon svg` (style binary card icon).
    - `.file-card.disabled-item` (style skipped/excluded file cards).
    - `.file-card .file-card-type` (style type display in card).
    - `.file-card .file-card-size` (style size display in card).
    - `.file-card-actions .file-card-action.disabled` (style disabled action buttons).

This checklist focuses solely on the implementation tasks required to add the binary file path inclusion feature, assuming the existing structure and features are already in place.
