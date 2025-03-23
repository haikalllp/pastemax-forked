# Multiple Root Folders Test Case Document

## Test Environment Setup

### Required Test Folders
1. Small Test Folder
   - Size: 10-20 files
   - Structure: Mix of files and folders
   - Purpose: Quick loading tests

2. Medium Test Folder
   - Size: ~100 files
   - Structure: Nested directories, various file types
   - Purpose: Standard use case testing

3. Large Test Folder
   - Size: 500+ files
   - Structure: Deep nesting, multiple file types
   - Purpose: Performance testing

4. Empty Test Folder
   - Size: 0 files
   - Purpose: Edge case testing

5. Special Characters Folder
   - Name: "Test @ Folder #1 (特殊)"
   - Purpose: Character encoding testing

## Test Script

### 1. Initial State Tests
```
[ ] Application Launch
    - Application opens without errors
    - "Select Folder" button visible and enabled
    - "Add Another" button not displayed
    - "No folder selected" message visible

[ ] UI Layout Check
    - Sidebar width is ~300px
    - Files header visible
    - Search bar present and empty
    - Theme toggle functional

Results:
Status: Fixed - Pending Verification
Notes: Modified useEffect hook in App.tsx that was clearing localStorage, preventing rootFolders from being stored correctly. The fix needs to be verified visually to confirm the UI elements now display correctly.
```

### 2. Single Root Selection Tests
```
[ ] First Folder Selection
    - File dialog opens on button click
    - Loading indicator appears
    - Folder structure loads correctly
    - "Add Another" button appears
    - File tree displays properly

[ ] Tree Visualization
    - Directory structure is clear
    - Folders expand/collapse
    - File checkboxes work
    - Folder selection works

Results:
Status: Not Started
Notes:
```

### 3. Multiple Root Functionality Tests
```
[ ] Second Root Addition
    - "Add Another" opens file dialog
    - Loading indicator shows progress
    - Second root appears separately
    - Headers visually distinct
    - Both roots independently navigable

[ ] Third Root Addition
    - Special characters display correctly
    - All roots maintain hierarchy
    - Independent expand/collapse
    - Tree structure preserved

Results:
Status: Not Started
Notes:
```

### 4. Selection and Search Tests
```
[ ] Cross-Root Selection
    - Select files in first root
    - Select files in second root
    - "Select All" works across roots
    - "Deselect All" clears everything
    - Individual root selection preserved

[ ] Search Function
    - Search term filters across all roots
    - Results show from all roots
    - Clear search restores full view
    - Search highlights work

Results:
Status: Not Started
Notes:
```

### 5. Output Tests
```
[ ] Copy Functionality
    - Multi-root selection copies correctly
    - Root sections clearly separated
    - File paths accurate
    - Content properly formatted

[ ] Instructions Integration
    - Instructions appear at top
    - File tree toggle works
    - Format preserved
    - No content corruption

Results:
Status: Not Started
Notes:
```

### 6. Edge Case Tests
```
[ ] Empty Folder Test
    - Empty folder loads without errors
    - Appropriate message shown
    - UI remains stable
    - No console errors

[ ] Duplicate Folder Test
    - Same folder addition blocked
    - Error message shown
    - Existing tree preserved
    - Application stable

[ ] Large Folder Test
    - 500+ files load correctly
    - Performance acceptable
    - UI remains responsive
    - Memory usage stable

Results:
Status: Not Started
Notes:
```

### 7. Performance Tests
```
[ ] Load Time Measurements
    - Single root: ____ ms
    - Two roots: ____ ms
    - Three roots: ____ ms
    - Large folder: ____ ms

[ ] UI Responsiveness
    - Scrolling smooth
    - Selection responsive
    - Search performs well
    - No UI freezing

Results:
Status: Not Started
Notes:
```

### 8. Backwards Compatibility Tests
```
[ ] Legacy Features
    - Single root works as before
    - File selection unchanged
    - Copy format compatible
    - Previous features functional

Results:
Status: Not Started
Notes:
```

## Test Results Summary

### Overall Status
```
Tests Completed: 1/8
Tests Passed: 0
Tests Fixed: 1 (pending verification)
Tests Failed: 0
Tests Blocked: 7
```

### Critical Issues
```
List any critical issues found during testing:
1. UI elements for multiple roots not displaying - Initial state test failed because "Add Another" button and related UI components are not appearing in the interface.
   Root cause: There's a useEffect hook in App.tsx that's clearing localStorage for testing purposes:
   ```typescript
   // Clear saved folder on startup (temporary, for testing)
   useEffect(() => {
     localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
     localStorage.removeItem("hasLoadedInitialData");
     sessionStorage.removeItem("hasLoadedInitialData");
   }, []);
   ```
   This removes the selected folder but not ROOT_FOLDERS, and the "Add Another" button only shows when rootFolders.length > 0.
2. 
```

### Non-Critical Issues
```
List any non-critical issues or suggestions:
1. 
2. 
```

### Performance Metrics
```
Average Load Times:
- Single Root: ___ ms
- Multiple Roots: ___ ms
- Search Response: ___ ms
- Copy Operation: ___ ms
```

### Recommendations
```
1. Debug the UI components related to multiple root functionality - None of the expected new UI components are displaying.
2. Verify CSS and component rendering in the header section.
3. Remove or modify the localStorage clearing useEffect in App.tsx - Either comment it out or modify it for testing to preserve ROOT_FOLDERS data:
   ```typescript
   // For development only - remove for production
   useEffect(() => {
     // Uncomment to clear selected folder for testing
     // localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
     // Leave ROOT_FOLDERS intact for multiple root testing
     localStorage.removeItem("hasLoadedInitialData");
     sessionStorage.removeItem("hasLoadedInitialData");
   }, []);
   ```
4. Alternatively, if testing with a clean state is required, add code to populate rootFolders with test data.
```

## Test Execution Log

### Test Environment
```
OS Version: Windows 10.0.26100
Node Version: 23.8.0
Electron Version: (To be filled)
Screen Resolution: (To be filled)
```

### Test Timeline
```
Start Date/Time: (Current date)
End Date/Time: In progress
Total Duration: In progress
```

### Tester Information
```
Tester Name: (Your name)
Test Date: (Current date)
Build Version: (To be filled)
```

---

**Note:** Fill in all sections marked with [ ] during testing and provide detailed notes for any failures or unexpected behavior. Screenshots should be attached for any UI-related issues.