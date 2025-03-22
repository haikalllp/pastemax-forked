# PasteMax Updates

## Overview
This document outlines the application hardening and security improvements made to the PasteMax application, with a focus on production-ready builds and cross-platform security.

## Summary of Key Improvements

### User Experience
- **Root Folder Navigation**: Added support for displaying the root folder as the highest level in the file tree
- **User Instructions**: New feature allowing users to add custom instructions to copied code with `<user_instructions>` tags
- **Selection Behavior**: Fixed folder selection to prevent directories from being selected when child files are selected (in FileList / 'Selected files' window)
- **Theme System**: Enhanced dark mode implementation with improved contrast ratios and accessibility

### Cross-Platform Support
- **Path Handling**: Comprehensive cross-platform path normalization and comparison utilities
- **Windows Support**: Improved case-insensitive path comparison and UNC path support
- **macOS Compatibility**: Enhanced support for case sensitivity options and bundle structures
- **Linux Support**: Better handling of symbolic links and file permissions
- **Safe Mode**: New recovery mechanism for handling startup issues across platforms

### Performance & Architecture
- **Tree Building**: Optimized file tree algorithm for large directory structures
- **Chunked Processing**: Implemented chunked directory processing to maintain UI responsiveness
- **Code Cleanup**: Eliminated redundant code through better function consolidation
- **Error Recovery**: Enhanced error handling for malformed files and inaccessible paths
- **Defensive Programming**: Added robust validation and fallbacks throughout the codebase

### Security Improvements
- **Content Security Policy**: Environment-specific CSP with nonce-based validation
- **Sandboxing**: Enhanced process isolation and permissions
- **Navigation Protection**: Controls to prevent navigation to non-local content
- **macOS Hardening**: Proper entitlements configuration for App Store compliance
- **File Handling Security**: Path validation and protection against traversal attacks

## 1. Application Security Hardening

### Production-Specific Content Security Policy (CSP)
- Implemented a comprehensive Content Security Policy with different configurations for development and production
- Added dynamic nonce generation using the crypto module for script-src directives in production
- Production CSP now features:
  - Strict default-src policy limiting resources to same origin ('self')
  - Nonce-based script-src validation to prevent XSS attacks
  - Restricted connect-src to prevent data exfiltration
  - object-src 'none' to prevent plugin-based attacks
  - base-uri and form-action restrictions to prevent redirects
  - frame-ancestors 'self' to prevent clickjacking
  - Automatic HTTP to HTTPS upgrades with upgrade-insecure-requests
- Added enhanced security headers:
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block
  - X-Frame-Options: SAMEORIGIN

### Browser Window Security Enhancements
- Implemented environment-specific security settings:
  - Disabled DevTools in production builds
  - Enabled sandbox mode in production for renderer process isolation
  - Enforced same-origin policy with webSecurity: true
- Added proper window navigation protection:
  - Blocked navigation to non-local content
  - Implemented window open handler to control external links
  - Forced external URLs to open in the default browser

### Runtime Security Controls
- Added protection against malicious navigation:
  - Monitoring and blocking of will-navigate events to external sites
  - Strict protocol checking for allowed destinations
  - Proper external URL handling through electron.shell.openExternal
- Implemented proper event unregistration to prevent memory leaks
- Added comprehensive error logging for security-relevant events

## 2. macOS Build Hardening

### Build Directory Structure and Purpose
- Created dedicated `build` directory to house platform-specific build configuration files
- Purpose of the directory:
  - Centralized location for build-time configuration files
  - Separation of build concerns from application code
  - Storage for platform-specific security requirements
  - Integration point with electron-builder packaging system
- Configuration is automatically detected and used by electron-builder during packaging
- Directory is excluded from tokenization and file processing through ignoreFilter

### Entitlements for macOS Security
- Created build/entitlements.mac.plist for proper App Store compliance and security
- Implemented sandboxing with com.apple.security.app-sandbox
- Configured file access permissions:
  - Limited read-only access to user-selected files
  - Controlled read-write access to specific user-selected files
- Added hardened runtime entitlements:
  - JIT compilation support with appropriate restrictions
  - Controlled executable memory permissions
  - Inheritance of security settings from parent process

### Configuration for Production Builds
- Set up production environment flags to enable security features automatically
- Added conditional security settings based on NODE_ENV=production
- Enhanced error handling and reporting for production environments
- Implemented graceful degradation for improved reliability

## 3. Development Environment Improvements

### Development Mode Configurations
- Created specific development CSP that allows:
  - HMR (Hot Module Replacement) functionality with websocket connections
  - Vite development server connections
  - Appropriate 'unsafe-eval' permissions only in development
- Added clear console logging to distinguish between development and production mode
- Implemented automatic suppression of development-specific warnings

### Cross-Platform Path Handling
- Enhanced path normalization for consistent behavior across platforms
- Improved handling of Windows UNC paths and drive letters
- Added safe path joining functions to prevent path traversal issues
- Implemented better relative path calculation for cross-platform compatibility
- Implemented robust path comparison capabilities with the `arePathsEqual` function that respects platform-specific case sensitivity
- Added proper detection for Windows environments with isWindows() utility
- Enhanced subpath detection with platform-aware `isSubPath` function
- Improved basename and dirname extraction with cross-platform considerations
- Added comprehensive debugging logs for path operations to troubleshoot platform-specific issues

## 4. Build Process Security

### Safe Module Loading
- Added robust error handling for module loading failures
- Implemented fallbacks for critical dependencies
- Added comprehensive logging of module loading status
- Created defensive coding patterns to handle missing or incompatible modules

### File Handling Security
- Added validation of file paths before processing
- Implemented size limits for file reading to prevent DoS attacks
- Added proper binary file detection and handling
- Enhanced directory traversal protection with path validation
- Improved serialization of file objects between main and renderer processes
- Added safeguards to ensure the `isDirectory` property is properly transmitted in IPC communications
- Implemented better error recovery mechanisms when dealing with invalid files or paths
- Enhanced logging for debugging file access issues across different operating systems

## 5. CSS and Styling Improvements

### Enhanced CSS Documentation
- Completely restructured CSS documentation with standardized section headers
- Added a detailed table of contents with hierarchical organization:
  - 10 main sections with clear subsection breakdowns
  - Each component type grouped under appropriate categories
- Added extensive inline documentation:
  - Purpose description for every component
  - Explanation of property choices and behavior
  - Cross-browser compatibility notes
  - Theme-specific variations
- Enhanced code organization:
  - Logically grouped related styles together
  - Standardized comment format for better navigation
  - Added visual separator blocks for major sections
  - Documented relationships between interacting components

### Theme System Improvements
- Added detailed documentation for theme variables:
  - Organized variables into logical categories (backgrounds, typography, feedback colors)
  - Added descriptive comments for each color variable explaining its purpose
  - Documented specific color choices for design consistency
- Enhanced dark mode implementation:
  - Added explicit dark mode documentation
  - Improved contrast ratios for better accessibility
  - Documented component-specific dark mode adjustments

### Component Styling Consistency
- Standardized styling patterns across similar components:
  - Consistent spacing and sizing
  - Uniform hover and focus states
  - Standardized animation timings
- Documented reusable utility classes and patterns
- Added explicit browser support notes for cross-platform features

### User Instructions Feature
- Added a dedicated user instructions input area that allows users to:
  - Add custom instructions along with their code
  - Provide context to AI assistants about how to interpret the shared code
  - Communicate specific requirements when sharing code with others
- Enhanced the copy functionality to properly format user instructions:
  - Wrapped instructions in `<user_instructions>` tags for clear identification
  - Placed instructions at the beginning of copied content for immediate visibility
  - Applied consistent styling to the instructions component
- Implemented persistent state management for instructions:
  - Instructions text persists between copy operations
  - Clear visual indication when instructions are included
- Added smooth integration with the file tree feature:
  - Instructions are placed before file tree in copied output
  - Proper spacing ensures good readability when both features are used

### File Tree Inclusion Feature
- Added "Include File Tree" checkbox option for enhanced code sharing:
  - Generates an ASCII representation of the selected files' directory structure
  - Wraps the tree in `<file_map>` tags for clear identification
  - Displays the root folder path at the top of the tree for context
- Implemented proper sorting in the tree visualization:
  - Directories appear before files for better readability
  - Files and directories are sorted alphabetically within their groups
  - Visual indicators (└── and ├──) clearly show relationships between items
- Enhanced with cross-platform path handling:
  - Consistently normalizes paths before generating the tree
  - Properly handles path separators across different operating systems
  - Accounts for relative paths from the selected root folder
- Optimized for clarity and usability:
  - Tree is only included when explicitly requested via checkbox
  - Indent levels are properly maintained for clarity
  - ASCII representation is universally compatible across systems

## 6. File Tree Navigation Improvements

### Root Folder Display Enhancement
- Added support for displaying the root folder as the highest level in the navigation tree
- Improved file system hierarchy representation with clear parent-child relationships
- Enhanced the `FileData` interface to include an `isDirectory` property for better type safety
- Implemented proper handling of the root folder in directory traversal and selection logic
- Added diagnostic logging to debug root folder identification across platforms

### Selection Behavior Refinement
- Fixed selection behavior to prevent directories from being inadvertently selected when child files are selected
- Improved the `toggleFolderSelection` function to handle recursive selection of files in folders and subfolders
- Eliminated redundant code by removing the duplicate `selectAllInFolder` function
- Added clear visual indicators for folder selection states (selected, partially selected, unselected)
- Enhanced error handling for malformed folders or inaccessible file paths

### TreeItem Component Enhancements
- Improved the TreeItem component to better handle directory selection states
- Enhanced checking logic to verify only immediate child files in directory selection
- Added conditions to exclude binary, skipped, or excluded files from selection counts
- Implemented clear visual distinction between directories and files in the navigation tree
- Ensured component rendering is consistent across all supported platforms

### Performance Optimization
- Improved file tree building algorithm to handle large directory structures more efficiently
- Added chunked processing of directories to maintain UI responsiveness
- Implemented better caching of directory structure to reduce unnecessary rebuilds
- Enhanced error recovery to gracefully handle permissions issues or inaccessible paths
- Added proper cleanup of resources when switching between projects or folders

## 7. Cross-Platform Compatibility

### Windows-Specific Enhancements
- Improved handling of Windows paths with proper case-insensitive path comparison
- Added support for Windows UNC paths and network drives
- Enhanced backslash/forward slash normalization for consistent path handling
- Fixed Windows-specific file selection issues related to drive letters and path casing
- Added specific handling for Windows path length limitations

### macOS Compatibility
- Enhanced support for macOS file system case sensitivity options
- Improved handling of macOS-specific path formats including resource forks
- Fixed issues with hidden files and .DS_Store handling
- Added proper handling of macOS bundle structures
- Improved compatibility with macOS sandboxing requirements

### Linux Support
- Enhanced path handling for various Linux distributions
- Improved support for symbolic links and hard links in Linux file systems
- Fixed issues with file permissions and ownership on Linux platforms
- Added better error handling for Linux-specific file access errors
- Enhanced compatibility with various Linux desktop environments

### Debug Capabilities
- Added enhanced logging for platform-specific operations
- Implemented a Safe Mode feature to recover from failed startup
- Added diagnostic tools to identify platform-specific issues
- Enhanced error messages with platform-specific troubleshooting guidance
- Implemented defensive programming patterns to handle platform differences gracefully

## Next Steps
- Consider implementing ASAR archive encryption for additional protection
- Investigate Electron's contextBridge for more secure IPC
- Review and enhance application auto-update security
- Conduct a comprehensive security audit of all application components
- Further enhance cross-platform compatibility with broader testing across operating systems
- Implement more advanced file tree navigation features like bookmarks and favorites
- Add multi-selection capabilities for easier bulk operations
- Consider adding drag-and-drop functionality for file selection
