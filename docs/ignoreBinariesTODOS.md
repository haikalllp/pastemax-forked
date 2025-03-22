# PasteMax: Binary File Exclusion & User-Defined Exclusion Presets

## Overview
This document tracks the implementation of centralized binary file exclusion and user-defined exclusion presets in PasteMax. These features will allow users to create, edit, and apply custom exclusion rules for filtering files during folder loading.

## Progress Tracking

### Backend Changes (Overall: 0%)

- [ ] Refactor excluded-files.js to support preset-based exclusion (0%)
- [ ] Add persistent storage for exclusion presets (0%)
- [ ] Update main.js to integrate exclusion presets (0%)
- [ ] Implement IPC handlers for preset management (0%)
- [ ] Update preload.js for exposing preset management APIs (0%)

### Frontend Changes (Overall: 0%)

- [ ] Create React types for exclusion presets (0%)
- [ ] Create ExclusionPresetContext for state management (0%)
- [ ] Create ExclusionPresetList component (0%)
- [ ] Create PresetEditor component (0%)
- [ ] Add ExclusionSettings component to App.tsx (0%)
- [ ] Update App.tsx to handle preset-based file exclusion (0%)
- [ ] Update FileList to show preset-based exclusions (0%)
- [ ] Add CSS styles for exclusion preset UI components (0%)

### Final Tasks (Overall: 0%)

- [ ] Install required dependencies (0%)
- [ ] Add documentation for exclusion presets (0%)
- [ ] Test cross-platform compatibility (0%)

## Progress Key
- [x] Completed (100%)
- [~] In Progress (with percentage)
- [ ] Not Started (0%)
- [!] Blocked

## Detailed Implementation Plan

### 1. Refactor excluded-files.js to support preset-based exclusion
- Convert current exclusion lists into a preset-based format
- Create a default preset using existing exclusion patterns
- Export functions to access and manipulate presets
- Ensure backward compatibility for existing code

### 2. Add persistent storage for exclusion presets
- Add electron-store for persistent storage
- Create a storage schema for presets
- Implement functions to load/save presets
- Add migration logic for existing configurations
- Ensure proper error handling for storage operations

### 3. Update main.js to integrate exclusion presets
- Update file loading logic to apply active preset exclusions
- Centralize binary file detection using the active preset
- Modify the `shouldExcludeByDefault` function to use presets
- Ensure proper handling of preset changes during runtime
- Add safety mechanisms for invalid presets

### 4. Implement IPC handlers for preset management
- Add handlers for CRUD operations on presets
- Implement handler for setting the active preset
- Add handler for copying the default preset
- Ensure proper validation and error handling
- Add event emitters for preset changes to update UI

### 5. Update preload.js for exposing preset management APIs
- Add exposed APIs for getting/setting presets
- Add exposure for preset creation/deletion/update
- Expose API for getting/setting the active preset
- Add event listeners for preset changes
- Ensure proper contextBridge usage for security

### 6. Create React types for exclusion presets
- Create types for exclusion presets
- Define type for the preset management context/hooks
- Update existing FileData types to include exclusion information
- Ensure type safety throughout the application

### 7. Create ExclusionPresetContext for state management
- Create a context provider component
- Implement hooks for accessing preset data
- Handle loading/error states
- Implement functions for CRUD operations
- Add event listeners for preset changes from main process

### 8. Create ExclusionPresetList component
- Implement a list view of available presets
- Add ability to select the active preset
- Provide buttons for creating/editing/deleting presets
- Include indicators for default vs. custom presets
- Ensure proper styling with theme compatibility

### 9. Create PresetEditor component for creating/editing presets
- Implement form for editing preset name and description
- Create pattern editor with add/remove functionality
- Add binary extension editor with add/remove functionality
- Implement validation for patterns
- Add save/cancel buttons with proper error handling
- Style with theme compatibility

### 10. Add ExclusionSettings component to App.tsx
- Create ExclusionSettings component as container for preset management
- Add navigation or button to access exclusion settings
- Integrate with App.tsx
- Ensure preset context is properly provided to the application
- Style with appropriate padding and theme compatibility
- Handle showing/hiding the settings UI

### 11. Update App.tsx to handle preset-based file exclusion
- Update file loading and filtering to use active preset
- Update UI to indicate files excluded by the active preset
- Handle changes in active preset during runtime
- Update existing state variables to account for preset-based exclusion
- Ensure proper handling of preset changes

### 12. Update FileList to show preset-based exclusions
- Add visual indicator for files excluded by active preset
- Update styles to show different states (selected, excluded by default, excluded by preset)
- Add tooltip or other information to explain exclusion reason
- Ensure proper handling of selection for excluded files
- Update styling for accessibility and theme compatibility

### 13. Add CSS styles for exclusion preset UI components
- Create styles for ExclusionPresetList
- Create styles for PresetEditor
- Create styles for modal overlay and container
- Ensure dark/light theme compatibility
- Add appropriate spacing and padding
- Create responsive styles for different screen sizes

### 14. Install required dependencies
- Add electron-store for persistent storage
- Ensure ignore module is properly installed
- Add any UI dependencies for modals/dialogs if needed
- Update package.json with new dependencies
- Add proper types for TypeScript

### 15. Add documentation for exclusion presets
- Add user documentation explaining how to use exclusion presets
- Add developer documentation for the preset system architecture
- Update existing documentation to reference the new features
- Add inline comments and JSDoc for new functions and components
- Create a simple help UI in the application

### 16. Test cross-platform compatibility
- Test on Windows, macOS, and Linux if possible
- Verify path handling works correctly on all platforms
- Test file selection and exclusions on different file systems
- Verify proper handling of different line endings in exclusion patterns
- Test with large directories and various file types
- Ensure theme compatibility on all platforms

## Cross-Platform Considerations
- Path handling must be normalized across all platforms (Windows, macOS, Linux)
- Different line endings in files must be properly handled
- Storage locations should respect platform conventions
- UI should adapt to platform-specific design patterns where appropriate

## Development vs Production
- Development environments will use a separate storage location for presets
- Production builds will use optimized, minified code for the UI components
- Different Content-Security-Policy settings for dev and prod environments
- Logging levels should differ between environments
