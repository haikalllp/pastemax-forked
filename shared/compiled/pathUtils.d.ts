/**
 * @file pathUtils.ts
 * @description Centralized path utilities for cross-platform path handling
 *
 * This file serves as the single source of truth for all path-related operations
 * across both main and renderer processes. It provides a consistent API for
 * normalizing paths, comparing paths, extracting path components, and other
 * path-related operations.
 *
 * Usage in renderer process:
 * ```typescript
 * import { normalizePath, basename } from "../utils/pathUtils";
 *
 * const normalizedPath = normalizePath(filePath);
 * const fileName = basename(filePath);
 * ```
 *
 * Usage in main process (via shared adapter):
 * ```javascript
 * const { normalizePath, basename } = require("./shared/pathUtils");
 *
 * const normalizedPath = normalizePath(filePath);
 * const fileName = basename(filePath);
 * ```
 *
 * @module pathUtils
 */
/**
 * Browser-compatible path utilities to replace Node.js path module
 */
/**
 * Normalizes a file path to use forward slashes regardless of operating system
 * This helps with path comparison across different platforms.
 * Also handles UNC paths on Windows.
 *
 * @param filePath The file path to normalize
 * @returns The normalized path with forward slashes
 */
export declare function normalizePath(filePath: string): string;
/**
 * Makes a path relative by removing drive letters and leading slashes
 * This is particularly useful for gitignore pattern matching
 *
 * @param filePath The file path to make relative
 * @returns The path without drive letter and leading slashes
 */
export declare function makeRelativePath(filePath: string): string;
/**
 * Detects the operating system
 *
 * @returns The detected operating system ('windows', 'mac', 'linux', or 'unknown')
 */
export declare function detectOS(): 'windows' | 'mac' | 'linux' | 'unknown';
/**
 * Quick check if we're running on Windows.
 * Useful when we need to handle Windows-specific path quirks.
 */
export declare function isWindows(): boolean;
/**
 * Get the platform-specific path separator
 *
 * @returns The path separator for the current OS (\ for Windows, / for others)
 */
export declare function getPathSeparator(): string;
/**
 * Ensures a path is absolute and normalized for the current platform
 *
 * @param inputPath The path to normalize
 * @returns Normalized absolute path
 */
export declare function ensureAbsolutePath(inputPath: string): string;
/**
 * Safely joins paths across different platforms
 *
 * @param paths Path segments to join
 * @returns Normalized joined path
 */
export declare function safePathJoin(...paths: string[]): string;
/**
 * Safely calculates relative path between two paths
 * Handles different OS path formats and edge cases
 *
 * @param from Base path
 * @param to Target path
 * @returns Normalized relative path
 */
export declare function safeRelativePath(from: string, to: string): string;
/**
 * Compares two paths for equality, handling different OS path separators
 * and platform-specific case sensitivity
 *
 * @param path1 First path to compare
 * @param path2 Second path to compare
 * @returns True if the paths are equivalent, false otherwise
 */
export declare function arePathsEqual(path1: string, path2: string): boolean;
/**
 * Extract the basename from a path string
 * @param path The path to extract the basename from
 * @returns The basename (last part of the path)
 */
export declare function basename(path: string | null | undefined): string;
/**
 * Extract the directory name from a path string
 * @param path The path to extract the directory from
 * @returns The directory (everything except the last part)
 */
export declare function dirname(path: string | null | undefined): string;
/**
 * Join path segments together
 * @param segments The path segments to join
 * @returns The joined path
 */
export declare function join(...segments: (string | null | undefined)[]): string;
/**
 * Get the file extension
 * @param path The path to get the extension from
 * @returns The file extension including the dot
 */
export declare function extname(path: string | null | undefined): string;
/**
 * Checks if one path is a subpath of another, handling platform-specific
 * path separators and case sensitivity
 *
 * @param parent The potential parent path
 * @param child The potential child path
 * @returns True if child is a subpath of parent
 */
export declare function isSubPath(parent: string, child: string): boolean;
/**
 * Generate an ASCII representation of the file tree for the selected files
 * @param files Array of selected FileData objects
 * @param rootPath The root directory path
 * @returns ASCII string representing the file tree
 */
export declare function generateAsciiFileTree(files: {
    path: string;
}[], rootPath: string): string;
/**
 * Checks if a path is a valid path for the current OS
 * @param path The path to validate
 * @returns True if path is valid
 */
export declare function isValidPath(path: string): boolean;
