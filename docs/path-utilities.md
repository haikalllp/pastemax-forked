# Path Utilities

This document explains the cross-platform path utilities in PasteMax and how they're used throughout the application.

## Overview

PasteMax includes a robust set of path utilities designed to handle file paths consistently across Windows, macOS, and Linux. This is particularly important for:

- Correctly processing `.gitignore` patterns
- Comparing file paths from different sources
- Handling drive letters on Windows
- Normalizing path separators (slashes)
- Extracting filenames and directories

## Architecture

The path utilities follow a hybrid architecture to work seamlessly in both Electron's main process (Node.js) and renderer process (browser):

1. **Source of Truth**: `src/utils/pathUtils.ts` (TypeScript implementation)
2. **Compiled Output**: `shared/compiled/pathUtils.js` (CommonJS module)
3. **CommonJS Adapter**: `shared/pathUtils.js` (with fallback implementation)

This design ensures:
- Type safety during development
- Consistent behavior across processes
- Graceful fallbacks when compiled files aren't available

## Key Functions

| Function | Description |
|----------|-------------|
| `normalizePath(path)` | Normalizes path separators to forward slashes |
| `makeRelativePath(path)` | Makes a path relative by removing drive letters and leading slashes |
| `isWindows()` | Detects if running on Windows |
| `getPathSeparator()` | Returns the correct path separator for the current OS |
| `ensureAbsolutePath(path)` | Ensures a path is absolute |
| `safePathJoin(...parts)` | Safely joins path segments, handling errors |
| `safeRelativePath(from, to)` | Safely calculates a relative path |
| `arePathsEqual(path1, path2)` | Compares paths for equality with OS awareness |
| `isValidPath(path)` | Checks if a path is valid for the current OS |
| `isSubPath(parent, child)` | Checks if a path is a subpath of another |
| `basename(path)` | Gets the last portion of a path |
| `dirname(path)` | Gets the directory name of a path |
| `extname(path)` | Gets the extension of a path |
| `join(...paths)` | Joins path segments together |

## Usage Examples

### In Renderer Process (TypeScript)

```typescript
import { normalizePath, basename, isSubPath } from "../utils/pathUtils";

// Normalize a path
const normalizedPath = normalizePath('C:\\Users\\username\\Documents\\file.txt');
// Result: 'C:/Users/username/Documents/file.txt'

// Get the filename from a path
const fileName = basename('/Users/username/Documents/file.txt');
// Result: 'file.txt'

// Check if a path is a subpath of another
const isSubDirectory = isSubPath('/Users/username', '/Users/username/Documents/file.txt');
// Result: true
```

### In Main Process (JavaScript)

```javascript
const { normalizePath, basename, isSubPath } = require('./shared/pathUtils');

// Normalize a path
const normalizedPath = normalizePath('C:\\Users\\username\\Documents\\file.txt');
// Result: 'C:/Users/username/Documents/file.txt'

// Get the filename from a path
const fileName = basename('/Users/username/Documents/file.txt');
// Result: 'file.txt'

// Check if a path is a subpath of another
const isSubDirectory = isSubPath('/Users/username', '/Users/username/Documents/file.txt');
// Result: true
```

## Special Handling

### Windows Drive Letters

Drive letters (like `C:`) are handled specially to ensure consistent behavior across platforms:

```javascript
makeRelativePath('C:\\Users\\username\\Documents\\file.txt')
// Returns: 'Users/username/Documents/file.txt'
```

### UNC Paths

Windows UNC paths (network paths starting with `\\`) are preserved while normalizing:

```javascript
normalizePath('\\\\server\\share\\file.txt')
// Returns: '\\\\server/share/file.txt'
```

## Testing

You can test the path utilities with the included test script:

```
npm run test-path-utils
```

This script tests:
- Path normalization across different formats
- Path comparison and equality checking
- Subpath detection
- Windows-specific handling (drive letters, etc.)
- Fallback behavior when compiled files aren't available

## Implementation Details

The path utilities are implemented to handle both Node.js and browser environments:

- In Node.js environments, they use the native `path` module when available
- In browser environments, they provide compatible implementations
- Error handling is robust to prevent crashes from malformed paths

The TypeScript implementation includes full type definitions and documentation. 