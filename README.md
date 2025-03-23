# PasteMax

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub issues](https://img.shields.io/github/issues/kleneway/pastemax)](https://github.com/kleneway/pastemax/issues)

A modern file viewer application for developers to easily navigate, search, and copy code from repositories. Ideal for pasting into ChatGPT or your LLM of choice. Built with Electron, React, and TypeScript.

![Screenshot 2025-03-05 at 6 50 55 PM](https://github.com/user-attachments/assets/1f5cd814-69db-44f7-b230-3648cdfcfa6f)

## Video
[YouTube Link](https://youtu.be/YV-pZSDNnPo)

## Features

- **File Tree Navigation**: Browse directories and files with an expandable tree view
- **Token Counting**: View the approximate token count for each file (useful for LLM context limits)
- **Search Capabilities**: Quickly find files by name or content
- **Selection Management**: Select multiple files and copy their contents together
- **Sorting Options**: Sort files by name, size, or token count
- **Dark Mode**: Toggle between light and dark themes for comfortable viewing in any environment
- **Binary File Detection**: Automatic detection and exclusion of binary files
- **Smart File Exclusion**: Automatically excludes common files like package-lock.json, binary files, and more by default
- **Cross-Platform Path Handling**: Consistent file path handling across Windows, macOS, and Linux

## Installation

### Download Binary

Download the latest version from the [releases page](https://github.com/kleneway/pastemax/releases).

### Or Build from Source

1. Clone the repository:

```
git clone https://github.com/kleneway/pastemax.git
cd pastemax
```

2. Install dependencies:

```
npm install
```

3. Build the app:

```
# Build with Electron-specific configuration
npm run build:electron

# Package the app for distribution
npm run package
```

**Note**: If you encounter issues with `npm run package`, you can try the platform-specific commands:

```
# Windows
npm run package:win

# macOS
npm run package:mac

# Linux
npm run package:linux
```

After successful build, you'll find the executable files in the `release-builds` directory:

#### Windows
- `PasteMax Setup 1.x.x.exe` - Installer version
- `PasteMax 1.x.x.exe` - Portable version

#### macOS
- `PasteMax-1.x.x.dmg` - Disk image installer
- `PasteMax-1.x.x-mac.zip` - Zipped application

#### Linux
- `pastemax_1.x.x_amd64.deb` - Debian/Ubuntu package
- `pastemax-1.x.x.AppImage` - AppImage (runs on most Linux distributions)
- `pastemax-1.x.x.x86_64.rpm` - Red Hat/Fedora package

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:

```
npm install
```

### Running in Development Mode

To run the application in development mode:

```
# Start the Vite dev server
npm run dev

# In a separate terminal, start Electron
npm run dev:electron
```

### Cleaning build

To clean dependencies and builds:

```
# Clean all of dependencies and builds
npm run clean

# Clean only builds
npm run clean:dist
```

### Building for Production

The build process has three main steps:

1. **Build the React app and utilities** (choose one):
   ```
   # Complete build with Electron-specific configuration
   npm run build:electron
   ```

2. **Package the application**:
   ```
   # Create distributables for your current platform
   npm run package
   ```

3. **Platform-specific packaging** (optional):
   ```
   # Windows only
   npm run package:win
   
   # macOS only
   npm run package:mac
   
   # Linux only
   npm run package:linux
   
   # All platforms
   npm run package:all
   ```

The build process flow is:
```
build → package → release
```

For a detailed explanation of the build process with visual flowcharts, see the [build process documentation](docs/build-process.md).

### Testing

The project includes several test scripts to verify functionality:

```
# Test path utilities (cross-platform path handling)
npm run test:path-utils

# Test gitignore functionality
npm run test:gitignore

# Test cross-platform gitignore compatibility
npm run test:gitignore:cross
```

### Utility Building

Path utilities can be built separately for use in both main and renderer processes:

```
# Build only the path utilities
npm run build:utils
```

## Project Structure

- `src/` - React application source code
  - `components/` - React components
  - `types/` - TypeScript type definitions
  - `styles/` - CSS styles
  - `utils/` - Utility functions
    - `pathUtils.ts` - Cross-platform path handling utilities
- `shared/` - Shared utilities between main and renderer processes
  - `pathUtils.js` - Adapter for path utilities in CommonJS format
  - `compiled/` - Compiled TypeScript utilities
- `main.js` - Electron main process
- `build.js` - Build script for production
- `excluded-files.js` - Configuration for files to exclude by default
- `docs/` - Documentation
  - `excluded-files.md` - Documentation for the file exclusion feature
  - `path-utilities.md` - Documentation for cross-platform path handling
- `scripts/` - Build and test scripts

## Libraries Used

- Electron - Desktop application framework
- React - UI library
- TypeScript - Type safety
- Vite - Build tool and development server
- tiktoken - Token counting for LLM context estimation
- ignore - .gitignore-style pattern matching for file exclusions

## Customization

You can customize which files are excluded by default by editing the `excluded-files.js` file. See the [excluded files documentation](docs/excluded-files.md) for more details.

## Troubleshooting

### "Cannot find module 'ignore'" error

If you encounter this error when running the packaged application:

```
Error: Cannot find module 'ignore'
Require stack:
- /Applications/PasteMax.app/Contents/Resources/app.asar/main.js
```

This is caused by dependencies not being properly included in the package. To fix it:

1. Run the dependency fixer script:

   ```
   node scripts/fix-dependencies.js
   ```

2. Rebuild the application:

   ```
   npm run build:electron && npm run package
   ```

3. Install the new version

### Build Command Issues

If you encounter issues with the standard `npm run package` command:

1. Try using the platform-specific build command:
   - Windows: `npm run package:win`
   - macOS: `npm run package:mac`
   - Linux: `npm run package:linux`

2. Check the `release-builds` directory for output files after building

### Other Issues

If you encounter other issues, please [report them on GitHub](https://github.com/kleneway/pastemax/issues).

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
