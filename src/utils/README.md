# Path Utilities for React/Browser Environment

This module provides path handling functionality for the React/browser part of the application. It re-exports utilities from the shared path module while adding browser-specific enhancements.

## Overview

`pathUtils.ts` serves as a bridge between the shared JavaScript path utilities and the TypeScript React frontend code. It:

1. Re-exports all functions from the shared path utilities module
2. Adds browser-specific functionality not needed in Node.js
3. Provides TypeScript types for all exported functions

## Key Components

### Imported Utilities

The following utilities are imported from the shared module and re-exported:

- `normalizePath` - Normalizes paths to use forward slashes
- `makeRelativePath` - Creates relative paths without drive letters
- `basename` - Gets the filename from a path
- `dirname` - Gets the directory name from a path
- `join` - Joins path segments together
- `extname` - Gets the file extension
- `arePathsEqual` - Compares paths for equality
- `isSubPath` - Checks if one path is a subpath of another
- `safePathJoin` - Safe path joining across platforms
- `safeRelativePath` - Gets the relative path between two paths
- `ensureAbsolutePath` - Ensures a path is absolute
- `isValidPath` - Validates a path
- `getPathSeparator` - Gets the current platform's path separator
- `isNode` - Flag indicating if running in Node.js

### Browser-Specific Additions

The module enhances the shared utilities with browser-specific functionality:

- `detectOS()` - Detects the operating system from the browser's user agent
- `isWindows()` - Function to check if running on Windows (using browser detection)
- `generateAsciiFileTree()` - Generates an ASCII representation of a file tree for UI display

## Usage Example

```typescript
import { 
  normalizePath, 
  basename, 
  detectOS, 
  generateAsciiFileTree 
} from './utils/pathUtils';

// Normalize a file path
const path = normalizePath('C:\\Users\\name\\file.txt');
// Result: 'C:/Users/name/file.txt'

// Get basename
const filename = basename(path);
// Result: 'file.txt'

// Detect operating system
const os = detectOS();
// Result: 'windows', 'mac', 'linux', or 'unknown'

// Generate ASCII file tree for UI display
const fileTree = generateAsciiFileTree(
  [{ path: '/folder/file1.txt' }, { path: '/folder/subfolder/file2.txt' }],
  '/folder'
);
// Result:
// └── file1.txt
// └── subfolder
//     └── file2.txt
```

## Architecture

This module follows a layered approach:

1. **Core utilities** - Provided by the shared `path-utils.js` module
2. **TypeScript wrapper** - This file adds type definitions and handles imports
3. **Browser-specific extensions** - Additional utilities specifically for the browser environment

## Extending the Module

When adding new functionality to this module:

1. If the functionality is useful across both Node.js and browser environments, add it to the shared `path-utils.js` module
2. If it's specific to the browser/React side, add it to this file
3. Always ensure new functions have proper TypeScript typing
4. Follow the existing patterns for consistency

## Relationship with `main.js`

The Electron main process (`main.js`) uses the shared path utilities directly rather than through this module. This allows both the main process and the renderer process to use the same core path functions while keeping browser-specific functionality separate. 