# Shared Path Utilities

This module provides cross-platform path handling utilities that work consistently across both Node.js (Electron backend) and browser (React frontend) environments.

## Purpose

The path utilities in this module aim to solve several common challenges when working with file paths:

1. **Cross-platform compatibility** - Handle path differences between Windows, macOS, and Linux
2. **Consistent normalization** - Normalize paths in a predictable way for comparison and storage
3. **Unified interface** - Provide the same API for both Node.js and browser environments
4. **Edge case handling** - Correctly manage special cases like UNC paths, drive letters, macOS app bundles, and resource forks

## Components

### Core Files
- `path-utils.js` - JavaScript implementation of path utilities
- `path-utils.d.ts` - TypeScript type definitions for the module

### Key Functions

| Function | Description |
|----------|-------------|
| `normalizePath` | Normalizes file paths to use forward slashes regardless of OS |
| `makeRelativePath` | Makes a path relative by removing drive letters and leading slashes |
| `basename` | Extracts the last part of a path string |
| `dirname` | Extracts everything except the last part of a path string |
| `join` | Joins multiple path segments together |
| `extname` | Retrieves the file extension from a path |
| `arePathsEqual` | Compares paths for equality, considering OS-specific case sensitivity |
| `isSubPath` | Checks if one path is a subpath of another |
| `safePathJoin` | Joins paths safely across different platforms |
| `safeRelativePath` | Calculates the relative path between two paths |
| `ensureAbsolutePath` | Ensures a path is absolute and normalized |
| `isValidPath` | Checks if a path is valid for the current OS |
| `getPathSeparator` | Returns the path separator for the current platform |

### Environment Detection

The module automatically detects the current environment and adjusts behavior accordingly:

- `isWindows` - Boolean flag indicating if running in a Windows environment
- `isMac` - Boolean flag indicating if running in a macOS environment
- `isNode` - Boolean flag indicating if running in a Node.js environment

## macOS-Specific Features

The utilities have several macOS-specific enhancements:

1. **Resource fork handling** - Properly normalizes paths containing `.namedfork` components
2. **Application bundles** - Special handling for `.app` bundle paths
3. **Case sensitivity** - Adapts to macOS file system case-insensitivity while maintaining compatibility with case-sensitive configurations
4. **Platform detection** - Correctly identifies macOS in both Node.js and browser environments

## Usage

### In JavaScript/Node.js

```javascript
const { 
  normalizePath, 
  basename, 
  join, 
  isWindows,
  isMac 
} = require('./shared/path-utils');

// Normalize a file path
const normalizedPath = normalizePath('C:\\Users\\name\\file.txt');
// Result: 'C:/Users/name/file.txt'

// Get the basename of a path
const fileBasename = basename('/path/to/file.txt');
// Result: 'file.txt'

// Join path segments
const joinedPath = join('path', 'to', 'file.txt');
// Result: 'path/to/file.txt'

// Check platform
if (isWindows) {
  console.log('Running on Windows');
} else if (isMac) {
  console.log('Running on macOS');
} else {
  console.log('Running on Linux or other platform');
}
```

### In TypeScript/React

```typescript
import { 
  normalizePath, 
  basename, 
  join, 
  isWindows,
  isMac 
} from '../../shared/path-utils';

// TypeScript usage is identical to JavaScript usage
// Type definitions are provided in path-utils.d.ts
```

## Integration with PasteMax

This module is used throughout the PasteMax application:

1. **Electron Backend**: Used in `main.js` for file system operations and gitignore handling
2. **React Frontend**: Used in `src/utils/pathUtils.ts` which re-exports these utilities
3. **Shared Utilities**: Used in `excluded-files.js` for consistent path handling with exclusion patterns

## Testing

A comprehensive test suite is available in `scripts/test-path-utils.js` to verify the functionality 
of all utilities across different environments.

## Guidelines for Extension

When extending or modifying this module:

1. Ensure all changes work in both Node.js and browser environments
2. Add corresponding TypeScript type definitions for new functions
3. Write tests to cover new functionality
4. Maintain the same API style for consistency
5. Document any new functions with JSDoc comments
