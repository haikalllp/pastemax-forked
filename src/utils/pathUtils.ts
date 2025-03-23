/**
 * A collection of path utilities that work in both browser and desktop environments.
 * These functions handle the tricky bits of working with file paths across different
 * operating systems (Windows, Mac, Linux) so you don't have to worry about it.
 * 
 * This file re-exports the shared path utilities from our common module and adds
 * React/browser-specific functionality.
 */

// Determine if pathUtils is available from a global or from an import
// This handles both the CommonJS and browser environments
let pathUtilsModule: any;

// Check if we're in a browser environment where pathUtils might be globally defined
if (typeof window !== 'undefined' && (window as any).pathUtils) {
  pathUtilsModule = (window as any).pathUtils;
} else if (typeof self !== 'undefined' && (self as any).pathUtils) {
  pathUtilsModule = (self as any).pathUtils;
} else if (typeof globalThis !== 'undefined' && (globalThis as any).pathUtils) {
  pathUtilsModule = (globalThis as any).pathUtils;
} else {
  // Try normal import as a fallback
  try {
    // Import from the shared module
    const sharedPathUtils = require('../../shared/path-utils');
    pathUtilsModule = sharedPathUtils.default || sharedPathUtils;
  } catch (e) {
    console.error('Failed to import path utilities', e);
    
    // Provide minimal fallback implementations for critical functions
    pathUtilsModule = {
      normalizePath: (path: string) => path?.replace(/\\/g, '/') || path,
      makeRelativePath: (path: string) => path?.replace(/^\//, '') || path,
      basename: (path: string) => {
        if (!path) return '';
        const parts = path.replace(/\\/g, '/').replace(/\/$/, '').split('/');
        return parts[parts.length - 1] || '';
      },
      dirname: (path: string) => {
        if (!path) return '.';
        const normalizedPath = path.replace(/\\/g, '/');
        const lastSlash = normalizedPath.lastIndexOf('/');
        return lastSlash === -1 ? '.' : normalizedPath.slice(0, lastSlash);
      },
      join: (...parts: string[]) => parts.filter(Boolean).join('/'),
      arePathsEqual: (path1: string, path2: string) => {
        if (!path1 && !path2) return true;
        if (!path1 || !path2) return false;
        return path1.replace(/\\/g, '/').toLowerCase() === 
               path2.replace(/\\/g, '/').toLowerCase();
      },
      isSubPath: (parent: string, child: string) => {
        if (!parent || !child) return false;
        const normalizedParent = parent.replace(/\\/g, '/').replace(/\/$/, '') + '/';
        const normalizedChild = child.replace(/\\/g, '/');
        return normalizedChild.toLowerCase().startsWith(normalizedParent.toLowerCase());
      },
      isNode: false,
      isWindows: typeof navigator !== 'undefined' && navigator.platform && /win/i.test(navigator.platform)
    };
  }
}

// Export individual functions to ensure they're always available
export const normalizePath = pathUtilsModule.normalizePath;
export const makeRelativePath = pathUtilsModule.makeRelativePath;
export const basename = pathUtilsModule.basename;
export const dirname = pathUtilsModule.dirname;
export const join = pathUtilsModule.join;
export const extname = pathUtilsModule.extname || ((path: string) => {
  const base = basename(path);
  const dotIndex = base.lastIndexOf('.');
  return dotIndex === -1 ? '' : base.slice(dotIndex);
});
export const arePathsEqual = pathUtilsModule.arePathsEqual;
export const isSubPath = pathUtilsModule.isSubPath;
export const safePathJoin = pathUtilsModule.safePathJoin || join;
export const safeRelativePath = pathUtilsModule.safeRelativePath || ((from: string, to: string) => {
  const normFrom = normalizePath(from);
  const normTo = normalizePath(to);
  if (normTo.startsWith(normFrom)) {
    return normTo.slice(normFrom.length).replace(/^\//, '');
  }
  return normTo;
});
export const ensureAbsolutePath = pathUtilsModule.ensureAbsolutePath || normalizePath;
export const isValidPath = pathUtilsModule.isValidPath || ((path: string) => {
  if (!path) return false;
  return typeof path === 'string' && 
         !path.includes('*') && 
         !path.includes('?') && 
         !path.includes('<') && 
         !path.includes('>') && 
         !path.includes('|');
});
export const getPathSeparator = pathUtilsModule.getPathSeparator || (() => '/');
export const isNode = !!pathUtilsModule.isNode;

// Handle isWindows which might be a function or a boolean
const _isWindows = typeof pathUtilsModule.isWindows === 'function' 
  ? pathUtilsModule.isWindows() 
  : !!pathUtilsModule.isWindows;

/**
 * Detects the operating system
 * 
 * @returns The detected operating system ('windows', 'mac', 'linux', or 'unknown')
 */
export function detectOS(): 'windows' | 'mac' | 'linux' | 'unknown' {
  if (_isWindows) {
    return 'windows';
  }
  
  if (typeof window !== 'undefined' && window.navigator) {
    const platform = window.navigator.platform.toLowerCase();
    
    if (platform.includes('mac')) {
      return 'mac';
    } else if (platform.includes('linux')) {
      return 'linux';
    }
  }
  
  return 'unknown';
}

/**
 * Quick check if we're running on Windows.
 * Useful when we need to handle Windows-specific path quirks.
 */
export function isWindows(): boolean {
  return _isWindows || detectOS() === 'windows';
}

/**
 * Generate an ASCII representation of the file tree for the selected files
 * @param files Array of selected FileData objects
 * @param rootPath The root directory path
 * @returns ASCII string representing the file tree
 */
export function generateAsciiFileTree(files: { path: string }[], rootPath: string): string {
  if (!files.length) return "No files selected.";

  // Normalize the root path for consistent path handling
  const normalizedRoot = normalizePath(rootPath).replace(/\/$/, "");
  
  // Create a tree structure from the file paths
  interface TreeNode {
    name: string;
    isFile: boolean;
    children: Record<string, TreeNode>;
  }
  
  const root: TreeNode = { name: basename(normalizedRoot), isFile: false, children: {} };
  
  // Insert a file path into the tree
  const insertPath = (filePath: string, node: TreeNode) => {
    const normalizedPath = normalizePath(filePath);
    
    // For cross-platform compatibility, use the relative path matching logic
    if (!isSubPath(normalizedRoot, normalizedPath)) return;
    
    const relativePath = makeRelativePath(normalizedPath).substring(makeRelativePath(normalizedRoot).length).replace(/^\//, "");
    if (!relativePath) return;
    
    const pathParts = relativePath.split("/");
    let currentNode = node;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (!part) continue; // Skip empty parts
      
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
  const generateAscii = (node: TreeNode, prefix = "", isLast = true, isRoot = true): string => {
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
        .map((child, index) =>
          generateAscii(child, prefix, index === children.length - 1, false)
        )
        .join("");
    } else {
      // Root node special handling
      const children = Object.values(node.children).sort((a, b) => {
        // Sort by type (directories first) then by name
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
      
      return children
        .map((child, index) =>
          generateAscii(child, prefix, index === children.length - 1, false)
        )
        .join("");
    }
  };
  
  return generateAscii(root);
}