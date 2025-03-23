/**
 * Type definitions for shared path utilities
 * These definitions make the JavaScript module usable in TypeScript files
 */

/**
 * Normalizes file paths to use forward slashes regardless of OS
 * Handles special cases like Windows UNC paths and macOS-specific paths
 */
export function normalizePath(filePath: string): string;

/**
 * Makes a path relative by removing drive letters and leading slashes
 * Useful for gitignore pattern matching
 */
export function makeRelativePath(filePath: string): string;

/**
 * Extract the basename from a path string
 */
export function basename(path: string | null | undefined): string;

/**
 * Extract the directory name from a path string
 */
export function dirname(path: string | null | undefined): string;

/**
 * Join path segments together
 */
export function join(...segments: (string | null | undefined)[]): string;

/**
 * Get the file extension
 */
export function extname(path: string | null | undefined): string;

/**
 * Compares two paths for equality, handling different OS path separators
 * and platform-specific case sensitivity
 */
export function arePathsEqual(path1: string, path2: string): boolean;

/**
 * Checks if one path is a subpath of another
 */
export function isSubPath(parent: string, child: string): boolean;

/**
 * Safely joins paths across different platforms
 */
export function safePathJoin(...paths: string[]): string;

/**
 * Safely calculates relative path between two paths
 * Handles different OS path formats and edge cases
 */
export function safeRelativePath(from: string, to: string): string;

/**
 * Ensures a path is absolute and normalized
 */
export function ensureAbsolutePath(inputPath: string): string;

/**
 * Checks if a path is valid for the current OS
 */
export function isValidPath(pathToCheck: string): boolean;

/**
 * Gets the path separator for the current platform
 */
export function getPathSeparator(): string;

/**
 * Flag indicating if we're running in a Windows environment
 */
export const isWindows: boolean;

/**
 * Flag indicating if we're running in a macOS environment
 */
export const isMac: boolean;

/**
 * Flag indicating if we're running in a Node.js environment
 */
export const isNode: boolean; 