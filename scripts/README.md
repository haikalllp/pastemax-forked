# Build Scripts

This directory contains various utility scripts for building, packaging, and debugging the Electron application.

## Available Scripts

### `verify-build.js`

Verifies that your package.json build configuration is correct for Electron builds. It checks that all required fields are present and that the main file exists.

Usage:

```bash
npm run verify-build
```

### `test-local-build.js`

Tests the complete build and packaging process for Electron locally. This is useful for debugging issues with the build process before pushing to GitHub.

Usage:

```bash
# Test the build for the current platform
npm run test-build

# Test for a specific platform
npm run test-build:mac
npm run test-build:win
npm run test-build:linux
```

### `test-gitignore.js` and `test-gitignore-crossplatform.js`

Tests the gitignore functionality to ensure files are excluded correctly according to gitignore patterns.

Usage:

```bash
# Standard gitignore test
npm run test-gitignore

# Cross-platform gitignore test (for Windows, macOS, and Linux)
npm run test-gitignore:cross
```

### `test-path-utils.js`

Tests the shared path utilities to ensure they work correctly in both development and production environments. 
This comprehensive test verifies:

1. Path normalization and handling across different platforms
2. Path joining, comparison, and relative path calculations
3. The fallback mechanism when compiled TypeScript files are not available
4. Error handling for edge cases

Usage:

```bash
npm run test-path-utils
```

## Debugging GitHub Actions

If you're having issues with GitHub Actions not building the binaries correctly, use the debug workflow:

1. Run the debug-gh-release script to create a debug tag:

   ```bash
   npm run debug-gh-release
   ```

2. This will trigger the `.github/workflows/debug-build.yml` workflow, which includes extensive logging.

3. Check the GitHub Actions logs for detailed information about the build process.

## Troubleshooting Common Issues

### No binaries in release

If your GitHub release only contains source code and no binaries:

1. Check that the workflow actually ran (look in GitHub Actions tab)
2. Verify that the workflow is configured to upload artifacts to the release
3. Make sure your electron-builder configuration in package.json is correct
4. Run the test-build script locally to see if it works on your machine
5. Use the debug-gh-release script to create a debug build with extra logging

### Incorrect artifact paths

If the workflow is failing to find artifacts:

1. Check that the output directory in package.json matches the paths in the workflow
2. Verify that electron-builder is actually creating the files in the expected location
3. Look at the logs to see where the files are actually being created
