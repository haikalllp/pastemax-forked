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

- [ ] **Update Global State**
- [ ] Add `rootFolders` array to track all selected root directories.
- Progress: Not started.

- [ ] **Modify `open-folder` IPC Handler**
- [ ] Append new folder paths to `rootFolders`.
- [ ] Send updated `rootFolders` list to renderer via `root-folders-updated` event.
- Progress: Not started.

- [ ] **Update `request-file-list` IPC Handler**
- [ ] Process all root folders and return a combined file list with `rootId` identifiers.
- [ ] Handle errors and send status updates for multiple roots.
- Progress: Not started.

**TODO:**
- Implement `rootFolders` array initialization.
- Update `open-folder` to manage multiple roots.
- Refactor `request-file-list` to process each root folder sequentially or in parallel.

---

### 2. Frontend Modifications (Sidebar.tsx)
**Objective:** Update the UI to support multiple root folders, including the "Add Another" button and distinct file trees.

- [ ] **Update State**
- [ ] Modify `SidebarProps` in `FileTypes.ts` to use `selectedFolders: string[]`.
- [ ] Update `Sidebar.tsx` to track multiple roots with `selectedFolders`.
- Progress: Not started.

- [ ] **Add "Add Another" Button**
- [ ] Add button next to "Select Folder" with `disabled={!hasImportedFolder}`.
- [ ] Handle clicks by triggering `openFolder`.
- Progress: Not started.

- [ ] **Build Separate Trees**
- [ ] Group files by `rootId` and build separate `TreeNode` arrays.
- [ ] Render each root’s tree distinctly in the sidebar.
- Progress: Not started.

**TODO:**
- Update `FileTypes.ts` with `selectedFolders`.
- Add "Add Another" button with conditional disabling.
- Implement logic to render multiple root trees in the sidebar.

---

### 3. Copyable Output (App.tsx or Similar)
**Objective:** Ensure the copyable output distinguishes between each root folder.

- [ ] **Update Copy Logic**
- [ ] Group selected files by `rootId` and `rootPath`.
- [ ] Generate output with separate sections for each root (file tree + content).
- Progress: Not started.

**TODO:**
- Modify copy function to handle multiple roots.
- Test output format with sample multi-root data.

---

### 4. File Types Update (FileTypes.ts)
**Objective:** Extend `FileData` to include root folder metadata.

- [ ] **Update `FileData` Interface**
- [ ] Add `rootId?: string` and `rootPath?: string` to `FileData`.
- Progress: Not started.

**TODO:**
- Add new properties to `FileData` interface.
- Ensure downstream components handle these fields.

---

### 5. Styling Adjustments
**Objective:** Visually distinguish root folders and disable "Add Another" appropriately.

- [ ] **CSS Updates**
- [ ] Style level-0 tree items (root folders) with borders or bold text.
- [ ] Add disabled styles for "Add Another" button.
- Progress: Not started.

**TODO:**
- Write CSS rules for root folder distinction.
- Test styling with multiple roots.

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
- **Overall Progress:** 0% (0/5 steps completed)
- **Next Steps:**
1. Start with `FileTypes.ts` updates (Step 4) for foundational changes.
2. Implement backend changes in `main.js` (Step 1).
3. Update frontend in `Sidebar.tsx` (Step 2).

---

## Notes
- Use this document to track progress by checking off completed tasks.
- Update the "Progress" fields as work advances.
- Add comments or issues encountered below as needed.

**Comments/Issues:**
- (Add any notes here during implementation)