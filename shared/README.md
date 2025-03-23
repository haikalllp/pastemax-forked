# Shared Path Utilities

This directory contains utilities shared between the main process and renderer process.

## Path Utilities

The path utilities provide consistent cross-platform path handling for Windows, macOS, and Linux. They are designed to work in both development and production environments.

```text
src/utils/pathUtils.ts
       │
       │ (compiled by TypeScript during build)
       ▼
shared/compiled/pathUtils.js
       │
       │ (loaded by adapter if available)
       ▼
shared/pathUtils.js (adapter with fallback)
       │
       │ (used by main process)
       ▼
main.js and other Node.js scripts
```

### Key Features

- **Cross-platform compatibility**: Properly handles different path separators and formats
- **Production/Development support**: Works in both environments through fallback mechanisms
- **Error handling**: Gracefully handles errors and edge cases
- **TypeScript support**: Original implementation is in TypeScript with type definitions

### Usage

```javascript
// In main process (CommonJS)
const pathUtils = require('./shared/pathUtils');

// Example usage
const normalizedPath = pathUtils.normalizePath('C:\\path\\to\\file.txt');
const isExcluded = pathUtils.isSubPath('node_modules', 'node_modules/react/index.js');
```

### Implementation Details

The utilities are implemented in TypeScript (`src/utils/pathUtils.ts`) and compiled to JavaScript during the build process. The compiled files are stored in `shared/compiled/`.

The CommonJS adapter in `shared/pathUtils.js` serves as a bridge between TypeScript and CommonJS modules. It provides a fallback implementation for development environments when the compiled version is not available.

### Available Functions

- `normalizePath(path)` - Normalizes path separators to forward slashes
- `makeRelativePath(path)` - Makes a path relative by removing drive letters and leading slashes
- `isWindows()` - Detects if running on Windows
- `getPathSeparator()` - Returns the correct path separator for the current OS
- `ensureAbsolutePath(path, basePath)` - Ensures a path is absolute
- `safePathJoin(...parts)` - Safely joins path segments, handling errors
- `safeRelativePath(from, to)` - Safely calculates a relative path
- `arePathsEqual(path1, path2)` - Compares paths for equality with OS awareness
- `isValidPath(path)` - Checks if a path is valid for the current OS
- `isSubPath(parent, child)` - Checks if a path is a subpath of another
- `basename(path)` - Gets the last portion of a path
- `dirname(path)` - Gets the directory name of a path
- `extname(path)` - Gets the extension of a path
- `join(...paths)` - Joins path segments together

### Testing

Run the tests with:

```
npm run test-path-utils
```

The test suite verifies:
- Development mode functionality
- Production mode functionality
- Fallback mechanism when compiled files are unavailable

### Build Process

The utilities are compiled during the build process using:

```
npm run build:utils
```

This compiles `src/utils/pathUtils.ts` to `shared/compiled/` using the configuration in `tsconfig.utils.json`. 