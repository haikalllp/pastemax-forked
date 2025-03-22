/**
 * A collection of path utilities that work in both browser and desktop environments.
 * These functions handle the tricky bits of working with file paths across different
 * operating systems (Windows, Mac, Linux) so you don't have to worry about it.
 */

/**
 * Browser-compatible path utilities to replace Node.js path module
 */

/**
 * Normalizes a file path to use forward slashes regardless of operating system
 * This helps with path comparison across different platforms
 * 
 * @param filePath The file path to normalize
 * @returns The normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  if (!filePath) return filePath;
  
  // Replace backslashes with forward slashes
  return filePath.replace(/\\/g, '/');
}

/**
 * Detects the operating system
 * 
 * @returns The detected operating system ('windows', 'mac', 'linux', or 'unknown')
 */
export function detectOS(): 'windows' | 'mac' | 'linux' | 'unknown' {
  if (typeof window !== 'undefined' && window.navigator) {
    const platform = window.navigator.platform.toLowerCase();
    
    if (platform.includes('win')) {
      return 'windows';
    } else if (platform.includes('mac')) {
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
  return detectOS() === 'windows';
}

/**
 * Compares two paths for equality, handling different OS path separators
 * and platform-specific case sensitivity
 * 
 * @param path1 First path to compare
 * @param path2 Second path to compare
 * @returns True if the paths are equivalent, false otherwise
 */
export function arePathsEqual(path1: string, path2: string): boolean {
  // Handle null/undefined cases
  if (!path1 && !path2) return true;
  if (!path1 || !path2) return false;
  
  const normalizedPath1 = normalizePath(path1);
  const normalizedPath2 = normalizePath(path2);
  
  // On Windows, paths are case-insensitive
  if (isWindows()) {
    return normalizedPath1.toLowerCase() === normalizedPath2.toLowerCase();
  }
  
  // On other systems (Mac, Linux), paths are case-sensitive
  return normalizedPath1 === normalizedPath2;
}

/**
 * Extract the basename from a path string
 * @param path The path to extract the basename from
 * @returns The basename (last part of the path)
 */
export function basename(path: string | null | undefined): string {
  if (!path) return "";

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
export function dirname(path: string | null | undefined): string {
  if (!path) return ".";

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
export function join(...segments: (string | null | undefined)[]): string {
  return segments
    .filter(Boolean)
    .map((seg) => String(seg))
    .join("/")
    .replace(/\/+/g, "/"); // Replace multiple slashes with a single one
}

/**
 * Get the file extension
 * @param path The path to get the extension from
 * @returns The file extension including the dot
 */
export function extname(path: string | null | undefined): string {
  if (!path) return "";

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
export function isSubPath(parent: string, child: string): boolean {
  // Handle null/undefined cases
  if (!parent || !child) return false;
  
  const normalizedParent = normalizePath(parent);
  const normalizedChild = normalizePath(child);
  
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
export function generateAsciiFileTree(files: { path: string }[], rootPath: string): string {
  if (!files.length) return "No files selected.";

  // Normalize the root path for consistent path handling
  const normalizedRoot = rootPath.replace(/\\/g, "/").replace(/\/$/, "");
  
  // Create a tree structure from the file paths
  interface TreeNode {
    name: string;
    isFile: boolean;
    children: Record<string, TreeNode>;
  }
  
  const root: TreeNode = { name: basename(normalizedRoot), isFile: false, children: {} };
  
  // Insert a file path into the tree
  const insertPath = (filePath: string, node: TreeNode) => {
    const normalizedPath = filePath.replace(/\\/g, "/");
    if (!normalizedPath.startsWith(normalizedRoot)) return;
    
    const relativePath = normalizedPath.substring(normalizedRoot.length).replace(/^\//, "");
    if (!relativePath) return;
    
    const pathParts = relativePath.split("/");
    let currentNode = node;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
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