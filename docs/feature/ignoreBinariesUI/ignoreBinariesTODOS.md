# PasteMax: Binary File Exclusion & User-Defined Ignore Patterns

## Overview
This document tracks the implementation of centralized binary file exclusion and user-defined ignore patterns in PasteMax. These features will allow users to create, edit, and apply custom exclusion rules for filtering files during folder loading, while maintaining compatibility with existing .gitignore functionality.

## Progress Tracking

### Phase 1: Backend Changes (Overall: 0%)

- [ ] Update excluded-files.js to centralize binary extension handling (0%)
- [ ] Create ignore-config.js module for custom pattern storage (0%)
- [ ] Update main process integration for ignore patterns (0%)
- [ ] Implement IPC handlers for pattern management (0%)

### Phase 2: Preload API Changes (Overall: 0%)

- [ ] Update preload.js to expose pattern management APIs (0%)
- [ ] Add events for UI updates when patterns change (0%)

### Phase 3: Frontend Changes (Overall: 0%)

- [ ] Create IgnoreSettings component (0%)
- [ ] Create IgnorePatternList component (0%)
- [ ] Create PatternEditor component (0%)
- [ ] Create ImportDialog component for .gitignore imports (0%)
- [ ] Update FileList to show pattern-based exclusions (0%)
- [ ] Add CSS styles for ignore pattern UI components (0%)

### Phase 4: Testing and Documentation (Overall: 0%)

- [ ] Install required dependencies (0%)
- [ ] Test functionality across platforms (0%)
- [ ] Add documentation for ignore patterns (0%)

## Progress Key
- [x] Completed (100%)
- [~] In Progress (with percentage)
- [ ] Not Started (0%)
- [!] Blocked

## Data Structures

### Pattern Format
```javascript
{
  pattern: string;       // The ignore pattern
  description?: string;  // Optional description of what the pattern does
  enabled: boolean;      // Whether the pattern is active
  source: 'default' | 'gitignore' | 'custom';  // Where the pattern came from
}
```

## Detailed Implementation Plan

### 1. Update excluded-files.js to centralize binary extension handling
- Maintain existing exports (excludedFiles, binaryExtensions)
- Add helper functions for binary file detection
- Add documentation on pattern formats and usage
- Ensure backward compatibility for existing code

### 2. Create ignore-config.js module for custom pattern storage
- Add electron-store for persistent storage
- Create a storage schema for custom patterns
- Implement functions to load/save/reset patterns
- Add functions to import patterns from .gitignore
- Create utility functions to combine patterns from different sources
- Ensure proper error handling for storage operations

### 3. Update main process integration for ignore patterns
- Update file loading logic to apply custom patterns
- Modify the `shouldExcludeByDefault` function to incorporate custom patterns
- Ensure proper handling of pattern changes during runtime
- Add safety mechanisms for invalid patterns

### 4. Implement IPC handlers for pattern management
- Add handlers for adding/editing/removing patterns
- Implement handler for enabling/disabling patterns
- Add handler for importing from .gitignore
- Ensure proper validation and error handling
- Add event emitters for pattern changes to update UI

### 5. Update preload.js to expose pattern management APIs
- Add exposed APIs for getting all patterns (default, gitignore, custom)
- Add exposure for pattern creation/deletion/update
- Expose API for enabling/disabling patterns
- Add event listeners for pattern changes
- Ensure proper contextBridge usage for security

### 6. Create IgnoreSettings component
- Create a container component for ignore settings
- Implement tab view for default vs. custom patterns
- Add buttons for managing patterns
- Ensure proper styling with theme compatibility

### 7. Create IgnorePatternList component
- Implement a list view of patterns
- Show pattern source (default, gitignore, custom)
- Add ability to enable/disable patterns
- Provide buttons for editing/removing patterns (custom only)
- Include tooltips for pattern explanation

### 8. Create PatternEditor component
- Implement form for editing pattern and description
- Add pattern validation
- Include help text for pattern syntax
- Add preview of affected files
- Implement save/cancel with proper error handling

### 9. Create ImportDialog component for .gitignore imports
- Implement dialog to import from .gitignore
- Allow selecting specific patterns to import
- Add option to modify patterns before adding
- Include preview of affected files
- Add proper validation and error handling

### 10. Update FileList to show pattern-based exclusions
- Add visual indicator for files excluded by patterns
- Show different indicators for different exclusion sources
- Add tooltip to explain exclusion reason
- Ensure proper styling for accessibility and theme compatibility

### 11. Add CSS styles for ignore pattern UI components
- Create styles for IgnoreSettings
- Create styles for IgnorePatternList
- Create styles for PatternEditor and ImportDialog
- Ensure dark/light theme compatibility
- Create responsive styles for different screen sizes

### 12. Install required dependencies
- Verify electron-store is properly installed
- Ensure ignore module is properly configured
- Add any UI dependencies for modals/dialogs if needed

### 13. Test functionality across platforms
- Test on Windows, macOS, and Linux if possible
- Verify path handling works correctly on all platforms
- Test with large directories and various file types
- Ensure theme compatibility on all platforms

### 14. Add documentation for ignore patterns
- Add user documentation explaining how to use ignore patterns
- Update existing documentation to reference the new features
- Add inline comments and JSDoc for new functions and components
- Create a simple help UI in the application

## Cross-Platform Considerations
- Path handling must be normalized across all platforms (Windows, macOS, Linux)
- Different line endings in files must be properly handled
- Storage locations should respect platform conventions
- UI should adapt to platform-specific design patterns where appropriate

## Development vs Production
- Development environments will use a separate storage location for patterns
- Production builds will use optimized, minified code for the UI components
- Different Content-Security-Policy settings for dev and prod environments
- Logging levels should differ between environments
