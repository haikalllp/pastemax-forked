# PasteMax Build Process

This document explains the build process for PasteMax, including the different options available for building and packaging the application.

## Overview

PasteMax's build process consists of three main steps:

1. **Build the utilities** - Compiles TypeScript utilities to JavaScript
2. **Build the React app** - Bundles the React application with Vite
3. **Package the application** - Creates executable files with Electron Builder

## Build Process Flowchart

```
┌─────────────────┐
│                 │
│  npm install    │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  npm run        │     │  npm run        │
│  build:utils    │────▶│  build:app      │
│                 │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                                 │
         ┌─────────────────┐     │
         │                 │     │
         │  npm run        │◀────┘
         │  package        │
         │                 │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │                 │
         │  Application    │
         │  Executables    │
         │                 │
         └─────────────────┘
```

Alternatively, you can use the `build:electron` command which combines multiple steps:

```
┌─────────────────┐
│                 │
│  npm run        │
│  build:electron │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│                 │
│  npm run        │
│  package        │
│                 │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│                 │
│  Application    │
│  Executables    │
│                 │
└─────────────────┘
```

## Available Build Commands

### Core Build Commands

| Command | Description |
|---------|-------------|
| `build:utils` | Compiles TypeScript utilities for use in both processes |
| `build:app` | Builds React app and utilities (for production) |
| `build:electron` | Complete build with Electron-specific configuration |

### Packaging Commands

| Command | Description |
|---------|-------------|
| `package` | Creates executables for current platform |
| `package:win` | Creates Windows executables |
| `package:mac` | Creates macOS executables |
| `package:linux` | Creates Linux executables |
| `package:all` | Creates executables for all platforms |

### Testing Commands

| Command | Description |
|---------|-------------|
| `test:path-utils` | Tests path utilities functionality |
| `test:gitignore` | Tests gitignore pattern handling |
| `test:gitignore:cross` | Tests cross-platform gitignore compatibility |

## Command Details

### `npm run build:utils`

This command:
1. Cleans the compiled utilities directory
2. Runs TypeScript compiler on path utilities
3. Generates JavaScript files in `shared/compiled/`

### `npm run build:app`

This command:
1. Cleans the distribution directory
2. Builds path utilities
3. Runs Vite to build the React app

### `npm run build:electron`

This command:
1. Cleans the distribution directory
2. Builds path utilities
3. Runs build.js for Electron-specific configuration

### `npm run package`

This command:
1. Runs `npm run build:app` (if not already done)
2. Runs electron-builder to create platform-specific executables
3. Places results in the `release-builds` directory

## Development vs Production

- **Development**: Use `npm run dev` and `npm run dev:electron`
- **Production**: Use `npm run build:app` followed by `npm run package`

The utilities always have a fallback mechanism if compilation fails, ensuring the application works correctly in both development and production environments. 