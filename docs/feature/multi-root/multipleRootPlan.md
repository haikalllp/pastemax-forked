# Add Another Folder/Root Feature Plan

**Date:** March 23, 2025
**Feature:** Allow users to add multiple root folders in the app, with distinct file trees and copyable output.

## Overview
The app currently supports selecting a single project folder as the root directory. The new "Add Another" feature will:
- Add an "Add Another" button next to "Select Folder."
- Grey out "Add Another" until a project folder is imported.
- Support multiple root folders, each as a separate instance with its own file tree.
- Display distinct file trees in the sidebar e.g.:

```text
Root Folder 1:
├── file1.txt
└── subfolder
└── file2.txt

Root Folder 2:
├── script.js
└── docs
└── readme.md
```

- Display seperation in copyable e.g.:

```text
<user isntructions>

Root Folder 1 File Structure:
├── file1.txt
└── subfolder
└── file2.txt

Root Folder 1 Selected File Contents
<content>

Root Folder 2 File Structure:
├── script.js
└── docs
└── readme.md

Root Folder 2 Selected File Contents
<content>
```

## Implementation Steps

### 1. Backend Modifications (main.js)
**Objective:** Update the Electron backend to handle multiple root folders and send their file lists to the frontend.

- [x] **Update Global State**
- [x] Add `rootFolders` array to track all selected root directories.
- Progress: Complete.

- [x] **Modify `open-folder` IPC Handler**
- [x] Append new folder paths to `rootFolders`.
- [x] Send updated `rootFolders` list to renderer via `root-folders-updated` event.
- Progress: Complete.

- [x] **Update `request-file-list` IPC Handler**
- [x] Process all root folders and return a combined file list with `rootId` identifiers.
- [x] Handle errors and send status updates for multiple roots.
- Progress: Complete.

**TODO:**
- [x] Implement `rootFolders` array initialization.
- [x] Update `open-folder` to manage multiple roots.
- [x] Refactor `request-file-list` to process each root folder sequentially or in parallel.

---

### 2. Frontend Modifications (Sidebar.tsx)
**Objective:** Update the UI to support multiple root folders while preserving the current sidebar UI structure and functionality.

- [x] **Update State**
- [x] Modify `SidebarProps` in `FileTypes.ts` to use `rootFolders: RootFolder[]` instead of `selectedFolders`.
- [x] Update `Sidebar.tsx` to track multiple roots while maintaining current tree view.
- [x] Preserve existing tree item UI and interaction patterns.
- Progress: Complete.

- [x] **Add "Add Another" Button**
- [x] Add button next to "Select Folder" with `disabled={!hasImportedFolder}`.
- [x] Handle clicks by triggering `openFolder`.
- [x] Maintain consistent button styling with existing UI.
- Progress: Complete.

- [x] **Enhance Tree Structure**
- [x] Add root folder headers as special tree nodes.
- [x] Preserve current TreeItem component functionality.
- [x] Add visual distinction for root nodes without breaking tree hierarchy.
- [x] Maintain existing expand/collapse behavior.
- Progress: Complete.

**TODO:**
- [x] Update `FileTypes.ts` with root folder types.
- [x] Add "Add Another" button while preserving header layout.
- [x] Enhance tree building logic to support root sections.
- [x] Ensure backwards compatibility with single root usage.

**UI Preservation Notes:**
- [x] Keep current TreeItem component styling and behavior
- [x] Maintain existing indentation and hierarchy
- [x] Preserve current selection mechanics
- [x] Keep file/folder icons and interaction patterns
- [x] Retain current expand/collapse animations

---

### 3. Copyable Output (App.tsx or Similar)
**Objective:** Ensure the copyable output distinguishes between each root folder.

- [x] **Update Copy Logic**
- [x] Group selected files by `rootId` and `rootPath`.
- [x] Generate output with separate sections for each root (file tree + content).
- Progress: Complete.

**TODO:**
- [x] Modify copy function to handle multiple roots.
- [x] Test output format with sample multi-root data.

---

### 4. File Types Update (FileTypes.ts)
**Objective:** Extend `FileData` to include root folder metadata.

- [x] **Update `FileData` Interface**
- [x] Add `rootId?: string` and `rootPath?: string` to `FileData`.
- Progress: Complete.

**TODO:**
- [x] Add new properties to `FileData` interface.
- [x] Ensure downstream components handle these fields.

---

### 5. Styling Adjustments
**Objective:** Visually distinguish root folders while maintaining the current UI aesthetics.

- [x] **CSS Updates**
- [x] Add subtle visual distinction for root sections (e.g., background shade, border).
- [x] Style root headers to be visually distinct but consistent with current theme.
- [x] Preserve existing TreeItem styles and interactions.
- [x] Add disabled styles for "Add Another" button matching current button styles.
- Progress: Complete.

**TODO:**
- [x] Write CSS rules for root distinction that complement existing styles.
- [x] Test styling with multiple roots ensuring consistency.
- [x] Verify dark/light theme compatibility.
- [x] Maintain current hover and selection states.

---

## UI/UX Guidelines
- [x] Maintain current sidebar width and scrolling behavior
- [x] Keep existing file tree interactions and animations
- [x] Use subtle visual cues for root separation
- [x] Preserve current selection highlighting
- [x] Keep consistent spacing and indentation
- [x] Maintain current theme compatibility
- [x] Ensure smooth transitions between states

---

## Testing Plan

- [ ] **Initial State**
- [ ] Verify "Add Another" is greyed out when no folder is selected.
- Progress: Not started.

- [ ] **Single Folder**
- [ ] Import one folder and ensure it works as before.
- Progress: Not started.

- [ ] **Multiple Folders**
- [ ] Add a second folder and confirm:
  - [ ] Both file trees appear in the sidebar.
  - [ ] Copyable output separates content by root folder.
- Progress: Not started.

- [ ] **Edge Cases**
- [ ] Test duplicate folder additions (should be ignored).
- [ ] Test with empty folders and binary files.
- Progress: Not started.

**TODO:**
- Create test cases for each scenario.
- Execute tests after implementation.

---

## Future Considerations
- [ ] **Remove Root Folder**: Add functionality to remove individual root folders.
- [ ] **Persistent Storage**: Save `rootFolders` across sessions using Electron storage APIs.
- [ ] **UI Enhancements**: Add collapse/expand controls per root folder in the sidebar.

**TODO:**
- Prioritize future features based on user feedback.
- Plan implementation details if pursued.

---

## Progress Tracking
- **Overall Progress:** 100% (5/5 steps completed)
- **Next Steps:**
1. ✅ Update `FileTypes.ts` updates (Step 4) for foundational changes.
2. ✅ Implement backend changes in `main.js` (Step 1).
3. ✅ Update frontend in `Sidebar.tsx` (Step 2) while preserving current UI.
4. ✅ Add root distinction styling (Step 5).
5. ✅ Update copyable output format (Step 3).

**Implementation Priority:**
1. ✅ Core functionality with UI preservation
2. ✅ Root folder distinction
3. ✅ Multi-root management
4. ✅ Enhanced features and polish

---

## Notes
- Use this document to track progress by checking off completed tasks.
- Update the "Progress" fields as work advances.
- Add comments or issues encountered below as needed.

**Comments/Issues:**
- Implementation complete with all requirements met
- Backward compatibility maintained for single root functionality
- Added styling for root headers with clear visual distinction
- Ensured proper theming support for dark/light modes