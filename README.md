# PasteMax

<p align="center">
   <img src="https://github.com/user-attachments/assets/fe5ed9f2-fcb1-41d7-bc38-fb130fadf116" width="150" alt="PasteMaxIcon">
</p>

<p align="center">
   A modern file viewer application for developers to easily navigate, search, and copy code from repositories.<br/>
   Ideal for pasting into ChatGPT or your LLM of choice. Built with Electron, React, and TypeScript.
</p>

<p align="center">
   <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
   <a href="https://github.com/kleneway/pastemax/issues"><img src="https://img.shields.io/github/issues/kleneway/pastemax" alt="GitHub issues"></a>
   <a href="https://github.com/kleneway/pastemax/releases/latest"><img src="https://img.shields.io/github/v/release/kleneway/pastemax" alt="GitHub releases"></a>
</p>

## Overview

PasteMax is a simple desktop app built for developers using AI coding assistants. It makes sharing your code with LLMs easy, thanks to a smart file explorer with token counting, file filtering, quick copy, and a previewer. Select the files you need, skip binaries and junk, and get clean, formatted snippets ready for your LLM.

![PasteMax](https://github.com/user-attachments/assets/d2a2cecc-47aa-4c14-a2b8-db9c2213d8da)
![IgnoreList](https://github.com/user-attachments/assets/24e44bd2-710c-476e-85d1-26814476e4ba)
![FilePreview](https://github.com/user-attachments/assets/432661ab-ff05-42b0-85d4-3f9b40fe1fd4)

## Video

[YouTube Link](https://youtu.be/YV-pZSDNnPo)

## Features

- **File Tree Navigation**: Browse directories and files with an expandable tree view.
- **Token Counting**: View the approximate token count for each file (useful for LLM context limits).
- **Search Capabilities**: Quickly find files by name or content.
- **Selection Management**: Select multiple files and copy their contents together.
- **Sorting Options**: Sort files by name, size, or token count.
- **File Previewer**: View file contents in a dedicated preview pane.
- **Dark Mode**: Toggle between light and dark themes for comfortable viewing in any environment.
- **Binary File Detection**: Automatic detection and exclusion of binary files.
- **Smart File Exclusion**: Automatically excludes common files like package-lock.json, binary files, and more by default.
- **File Change Watcher**: Automatically updates the files whenever changes are detected.
- **Automatic Update Checker**: Automatically check for new updates from Latest Github Release.

## Installation

### Download Binary

Download the latest PasteMax version from the [releases page](https://github.com/kleneway/pastemax/releases/latest).

### Build from Source

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
npm run build:electron
npm run package
```

**Note**: If you encounter issues with `npm run package`, you can try the platform-specific command:

```
npm run package:win
npm run package:mac
npm run package:linux
```

After successful build, you'll find the executable files inside the `release-builds` directory:

**Windows:**

- `PasteMax Setup 1.0.0.exe` - Installer version
- `PasteMax 1.0.0.exe` - Portable version

**Mac:**

- `PasteMax 1.0.0.dmg` - Installer version
- `PasteMax 1.0.0.zip` - Portable version

**Linx:**

- `PasteMax 1.0.0.deb` - Installer version (Deb package)
- `PasteMax 1.0.0.rpm` - Installer version (RPM package)
- `PasteMax 1.0.0.AppImage` - Portable version

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Running in Development Mode

To run the application in development mode:

```
# Start the Vite dev server
npm run dev

# In a separate terminal, start Electron
npm run dev:electron
```

### Building for Production

To build the application for production:

```
# Build the React app with Vite and update paths for Electron
npm run build:electron

# Create platform-specific distributables
npm run package
```

## Project Structure

- `src/` - React application source code
  - `components/` - React components
  - `context/` - React context providers
  - `hooks/` - Custom React hooks
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `styles/` - CSS styles
  - `assets/` - Static assets like images
- `electron/` - Electron-Backend related files
  - `main.js` - Electron main process
  - `preload.js` - Preload script for secure IPC
  - `renderer.js` - Renderer process utilities
  - `build.js` - Build script for production
  - `dev.js` - Development script
  - `excluded-files.js` - Configuration for files to exclude by default
  - `file-processor.js` - File processing utilities
  - `ignore-manager.js` - Ignore pattern management
  - `update-checker.js` - Update checking functionality
  - `update-manager.js` - Update management
  - `utils.js` - Utility functions
  - `watcher.js` - File change watcher
- `public/` - Public assets (favicon, etc.)
- `scripts/` - Utility scripts for building and testing
- `docs/` - Documentation

## Libraries Used

- Electron - Desktop application framework
- React - UI library
- TypeScript - Type safety
- Vite - Build tool and development server
- tiktoken - Token counting for LLM context estimation
- ignore - .gitignore-style pattern matching for file exclusions
- chokidar - File Watcher

## Troubleshooting

### Getting "Warning: Not trusted" on Windows

If you see a warning about the app not being trusted, you can bypass this by clicking "run anyways". This is a common issue with Electron apps, especially since PasteMax is not signed.

### Getting "App not responding" on Mac

If you encounter an "App not responding" message on Mac, it may be due to macOS security settings. You can try the following:

1. Open System Preferences.
2. Go to Security & Privacy.
3. Under the General tab, look for the "Allow apps downloaded from" section.
4. Look for "PasteMax" and click "Open Anyway".

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

## Star History ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=kleneway/pastemax&type=Date)](https://www.star-history.com/#kleneway/pastemax&Date)

---
