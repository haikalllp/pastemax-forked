"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.makeRelativePath = makeRelativePath;
exports.detectOS = detectOS;
exports.isWindows = isWindows;
exports.getPathSeparator = getPathSeparator;
exports.ensureAbsolutePath = ensureAbsolutePath;
exports.safePathJoin = safePathJoin;
exports.safeRelativePath = safeRelativePath;
exports.arePathsEqual = arePathsEqual;
exports.basename = basename;
exports.dirname = dirname;
exports.join = join;
exports.extname = extname;
exports.isSubPath = isSubPath;
exports.generateAsciiFileTree = generateAsciiFileTree;
exports.isValidPath = isValidPath;
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
function normalizePath(filePath) {
    if (!filePath)
        return filePath;
    // Handle Windows UNC paths - special case for network paths
    if (isWindows() && filePath.startsWith('\\\\')) {
        // Preserve the UNC path format but normalize separators
        return '\\\\' + filePath.slice(2).replace(/\\/g, '/');
    }
    // Replace backslashes with forward slashes
    return filePath.replace(/\\/g, '/');
}
/**
 * Makes a path relative by removing drive letters and leading slashes
 * This is particularly useful for gitignore pattern matching
 *
 * @param filePath The file path to make relative
 * @returns The path without drive letter and leading slashes
 */
function makeRelativePath(filePath) {
    if (!filePath)
        return filePath;
    // Normalize first
    let normalizedPath = normalizePath(filePath);
    // Remove drive letter (e.g., C:/) if present (Windows-specific)
    normalizedPath = normalizedPath.replace(/^[a-zA-Z]:\//, '');
    // Remove leading slash if present
    normalizedPath = normalizedPath.replace(/^\//, '');
    return normalizedPath;
}
/**
 * Detects the operating system
 *
 * @returns The detected operating system ('windows', 'mac', 'linux', or 'unknown')
 */
function detectOS() {
    if (typeof window !== 'undefined' && window.navigator) {
        const platform = window.navigator.platform.toLowerCase();
        if (platform.includes('win')) {
            return 'windows';
        }
        else if (platform.includes('mac')) {
            return 'mac';
        }
        else if (platform.includes('linux')) {
            return 'linux';
        }
    }
    else if (typeof process !== 'undefined' && process.platform) {
        // Node.js environment
        const platform = process.platform;
        if (platform === 'win32') {
            return 'windows';
        }
        else if (platform === 'darwin') {
            return 'mac';
        }
        else if (platform === 'linux') {
            return 'linux';
        }
    }
    return 'unknown';
}
/**
 * Quick check if we're running on Windows.
 * Useful when we need to handle Windows-specific path quirks.
 */
function isWindows() {
    return detectOS() === 'windows';
}
/**
 * Get the platform-specific path separator
 *
 * @returns The path separator for the current OS (\ for Windows, / for others)
 */
function getPathSeparator() {
    return isWindows() ? '\\' : '/';
}
/**
 * Ensures a path is absolute and normalized for the current platform
 *
 * @param inputPath The path to normalize
 * @returns Normalized absolute path
 */
function ensureAbsolutePath(inputPath) {
    if (typeof require !== 'undefined') {
        // Only available in Node.js environment
        try {
            const path = require('path');
            if (!path.isAbsolute(inputPath)) {
                inputPath = path.resolve(inputPath);
            }
        }
        catch (e) {
            console.warn('path module not available, cannot ensure absolute path');
        }
    }
    return normalizePath(inputPath);
}
/**
 * Safely joins paths across different platforms
 *
 * @param paths Path segments to join
 * @returns Normalized joined path
 */
function safePathJoin(...paths) {
    if (typeof require !== 'undefined') {
        // Only available in Node.js environment
        try {
            const path = require('path');
            const joined = path.join(...paths);
            return normalizePath(joined);
        }
        catch (e) {
            // Fallback if path module is not available
            console.warn('path module not available, using fallback join');
        }
    }
    // Fallback implementation using our own join function
    return join(...paths);
}
/**
 * Safely calculates relative path between two paths
 * Handles different OS path formats and edge cases
 *
 * @param from Base path
 * @param to Target path
 * @returns Normalized relative path
 */
function safeRelativePath(from, to) {
    // Normalize both paths to use the same separator format
    from = normalizePath(from);
    to = normalizePath(to);
    if (typeof require !== 'undefined') {
        // Only available in Node.js environment
        try {
            const path = require('path');
            const relativePath = path.relative(from, to);
            return normalizePath(relativePath);
        }
        catch (e) {
            // Fallback if path module is not available
            console.warn('path module not available, using basic relative path');
        }
    }
    // Basic implementation for browser environments
    // This is a simplified version that works for simple cases
    // For complex paths, Node's path.relative should be used
    if (to.startsWith(from)) {
        return to.substring(from.length).replace(/^\//, '');
    }
    // If paths don't share a common prefix, return the full target path
    return to;
}
/**
 * Compares two paths for equality, handling different OS path separators
 * and platform-specific case sensitivity
 *
 * @param path1 First path to compare
 * @param path2 Second path to compare
 * @returns True if the paths are equivalent, false otherwise
 */
function arePathsEqual(path1, path2) {
    // Handle null/undefined cases
    if (!path1 && !path2)
        return true;
    if (!path1 || !path2)
        return false;
    // Make both paths relative to handle drive letter differences
    const relativePath1 = makeRelativePath(path1);
    const relativePath2 = makeRelativePath(path2);
    // On Windows, paths are case-insensitive
    if (isWindows()) {
        return relativePath1.toLowerCase() === relativePath2.toLowerCase();
    }
    // On other systems (Mac, Linux), paths are case-sensitive
    return relativePath1 === relativePath2;
}
/**
 * Extract the basename from a path string
 * @param path The path to extract the basename from
 * @returns The basename (last part of the path)
 */
function basename(path) {
    if (!path)
        return "";
    // Ensure path is a string
    const pathStr = String(path);
    // Handle both forward and backslashes
    const normalizedPath = pathStr.replace(/\\/g, "/");
    // Remove trailing slashes
    const trimmedPath = normalizedPath.endsWith("/")
        ? normalizedPath.slice(0, -1)
        : normalizedPath;
    // Get the last part after the final slash
    const parts = trimmedPath.split("/");
    return parts[parts.length - 1] || "";
}
/**
 * Extract the directory name from a path string
 * @param path The path to extract the directory from
 * @returns The directory (everything except the last part)
 */
function dirname(path) {
    if (!path)
        return ".";
    // Ensure path is a string
    const pathStr = String(path);
    // Handle both forward and backslashes
    const normalizedPath = pathStr.replace(/\\/g, "/");
    // Remove trailing slashes
    const trimmedPath = normalizedPath.endsWith("/")
        ? normalizedPath.slice(0, -1)
        : normalizedPath;
    // Get everything before the final slash
    const lastSlashIndex = trimmedPath.lastIndexOf("/");
    return lastSlashIndex === -1 ? "." : trimmedPath.slice(0, lastSlashIndex);
}
/**
 * Join path segments together
 * @param segments The path segments to join
 * @returns The joined path
 */
function join(...segments) {
    return segments
        .filter(Boolean)
        .map((seg) => String(seg).replace(/^\/|\/$/g, '')) // Remove leading/trailing slashes
        .join("/");
}
/**
 * Get the file extension
 * @param path The path to get the extension from
 * @returns The file extension including the dot
 */
function extname(path) {
    if (!path)
        return "";
    const basenameValue = basename(path);
    const dotIndex = basenameValue.lastIndexOf(".");
    return dotIndex === -1 || dotIndex === 0 ? "" : basenameValue.slice(dotIndex);
}
/**
 * Checks if one path is a subpath of another, handling platform-specific
 * path separators and case sensitivity
 *
 * @param parent The potential parent path
 * @param child The potential child path
 * @returns True if child is a subpath of parent
 */
function isSubPath(parent, child) {
    // Handle null/undefined cases
    if (!parent || !child)
        return false;
    // Make both paths relative to handle drive letter differences
    const normalizedParent = makeRelativePath(parent);
    const normalizedChild = makeRelativePath(child);
    // Ensure parent path ends with a slash for proper subpath checking
    // This prevents '/foo/bar' from matching '/foo/bart'
    const parentWithSlash = normalizedParent.endsWith('/')
        ? normalizedParent
        : normalizedParent + '/';
    if (isWindows()) {
        // Case-insensitive comparison for Windows
        return normalizedChild.toLowerCase() === normalizedParent.toLowerCase() ||
            normalizedChild.toLowerCase().startsWith(parentWithSlash.toLowerCase());
    }
    // Case-sensitive comparison for other platforms
    return normalizedChild === normalizedParent ||
        normalizedChild.startsWith(parentWithSlash);
}
/**
 * Generate an ASCII representation of the file tree for the selected files
 * @param files Array of selected FileData objects
 * @param rootPath The root directory path
 * @returns ASCII string representing the file tree
 */
function generateAsciiFileTree(files, rootPath) {
    if (!files.length)
        return "No files selected.";
    // Normalize the root path for consistent path handling
    const normalizedRoot = normalizePath(rootPath).replace(/\/$/, "");
    const root = { name: basename(normalizedRoot), isFile: false, children: {} };
    // Insert a file path into the tree
    const insertPath = (filePath, node) => {
        const normalizedPath = normalizePath(filePath);
        // For cross-platform compatibility, use the relative path matching logic
        if (!isSubPath(normalizedRoot, normalizedPath))
            return;
        const relativePath = makeRelativePath(normalizedPath).substring(makeRelativePath(normalizedRoot).length).replace(/^\//, "");
        if (!relativePath)
            return;
        const pathParts = relativePath.split("/");
        let currentNode = node;
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            if (!part)
                continue; // Skip empty parts
            const isFile = i === pathParts.length - 1;
            if (!currentNode.children[part]) {
                currentNode.children[part] = {
                    name: part,
                    isFile,
                    children: {}
                };
            }
            currentNode = currentNode.children[part];
        }
    };
    // Insert all files into the tree
    files.forEach(file => insertPath(file.path, root));
    // Generate ASCII representation
    const generateAscii = (node, prefix = "", isLast = true, isRoot = true) => {
        if (!isRoot) {
            let result = prefix;
            result += isLast ? "└── " : "├── ";
            result += node.name;
            result += "\n";
            prefix += isLast ? "    " : "│   ";
            const children = Object.values(node.children).sort((a, b) => {
                // Sort by type (directories first) then by name
                if (a.isFile !== b.isFile) {
                    return a.isFile ? 1 : -1;
                }
                return a.name.localeCompare(b.name);
            });
            return result + children
                .map((child, index) => generateAscii(child, prefix, index === children.length - 1, false))
                .join("");
        }
        else {
            // Root node special handling
            const children = Object.values(node.children).sort((a, b) => {
                // Sort by type (directories first) then by name
                if (a.isFile !== b.isFile) {
                    return a.isFile ? 1 : -1;
                }
                return a.name.localeCompare(b.name);
            });
            return children
                .map((child, index) => generateAscii(child, prefix, index === children.length - 1, false))
                .join("");
        }
    };
    return generateAscii(root);
}
/**
 * Checks if a path is a valid path for the current OS
 * @param path The path to validate
 * @returns True if path is valid
 */
function isValidPath(path) {
    try {
        if (typeof require !== 'undefined') {
            // Node.js environment
            try {
                const pathModule = require('path');
                pathModule.parse(path);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        // Basic validation for browser environment
        return typeof path === 'string' && path.length > 0 && !path.includes('\0');
    }
    catch (err) {
        return false;
    }
}
//# sourceMappingURL=pathUtils.js.map