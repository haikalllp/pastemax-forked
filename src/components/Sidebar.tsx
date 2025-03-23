import React, { useState, useEffect, useRef } from "react";
import { SidebarProps, TreeNode, FileData } from "../types/FileTypes";
import SearchBar from "./SearchBar";
import TreeItem from "./TreeItem";

/**
 * Import path utilities for handling file paths across different operating systems.
 * While not all utilities are used directly, they're kept for consistency and future use.
 */
import * as pathUtils from "../utils/pathUtils";

// Ensure we have the critical path utilities, with fallbacks if needed
const {
  normalizePath = (path: string): string => path?.replace(/\\/g, '/') || path,
  join = (...parts: string[]): string => parts.filter(Boolean).join('/'),
  isSubPath = (parent: string, child: string): boolean => {
    if (!parent || !child) return false;
    const normalizedParent = normalizePath(parent).replace(/\/+$/, '') + '/';
    const normalizedChild = normalizePath(child);
    return normalizedChild.toLowerCase().startsWith(normalizedParent.toLowerCase());
  },
  arePathsEqual = (path1: string, path2: string): boolean => {
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    return normalizePath(path1).toLowerCase() === normalizePath(path2).toLowerCase();
  },
  basename = (path: string): string => {
    if (!path) return '';
    const parts = normalizePath(path).split('/');
    return parts[parts.length - 1] || '';
  },
  safeRelativePath = (from: string, to: string): string => {
    // Simple implementation that just returns the base path if both are provided
    if (!from || !to) return to || '';
    return to;
  },
  makeRelativePath = (from: string, to: string): string => {
    // Simplified fallback that just returns the target path
    return to || '';
  }
} = pathUtils;

/**
 * The Sidebar component displays a tree view of files and folders, allowing users to:
 * - Navigate through the file structure
 * - Select/deselect files and folders
 * - Search for specific files
 * - Resize the sidebar width
 */
const Sidebar = ({
  selectedFolder,
  allFiles,
  selectedFiles,
  toggleFileSelection,
  toggleFolderSelection,
  searchTerm,
  onSearchChange,
  selectAllFiles,
  deselectAllFiles,
  expandedNodes,
  toggleExpanded,
  processingStatus,
}: Omit<SidebarProps, 'openFolder'>) => {
  // State for managing the file tree and UI
  const [fileTree, setFileTree] = useState(() => [] as TreeNode[]);
  const [isTreeBuildingComplete, setIsTreeBuildingComplete] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  // Update UI based on backend processing status changes
  useEffect(() => {
    if (processingStatus?.status === "complete" || processingStatus?.status === "idle") {
      // Mark tree building as complete when backend processing finishes
      if (fileTree.length > 0 && !isTreeBuildingComplete) {
        setIsTreeBuildingComplete(true);
      }
    }
  }, [processingStatus, fileTree.length, isTreeBuildingComplete]);

  // Sidebar width constraints for a good UX
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;

  // Handle mouse down for resizing
  const handleResizeStart = (e: any) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Handle resize effect
  useEffect(() => {
    const handleResize = (e: any) => {
      if (isResizing) {
        const newWidth = e.clientX;
        if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(newWidth);
        }
      }
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing]);

  // Build file tree structure from flat list of files
  useEffect(() => {
    if (allFiles.length === 0) {
      setFileTree([]);
      setIsTreeBuildingComplete(false);
      return;
    }

    // Reset the tree building completion state
    setIsTreeBuildingComplete(false);

    const buildTree = () => {
      console.log("Building file tree from", allFiles.length, "files");

      try {
        // First, find the root folder item if it exists
        const normalizedSelectedFolder = selectedFolder ? normalizePath(selectedFolder) : '';
        
        if (!normalizedSelectedFolder) {
          console.warn("Selected folder path is empty, can't build tree");
          setFileTree([]);
          setIsTreeBuildingComplete(true);
          return;
        }
        
        // Check if we have any valid files to process
        if (!Array.isArray(allFiles) || allFiles.length === 0) {
          console.warn("No files to process for tree building");
          setFileTree([]);
          setIsTreeBuildingComplete(true);
          return;
        }
        
        const rootFolderItem = allFiles.find(file => 
          file && file.path && file.isDirectory && arePathsEqual(normalizePath(file.path), normalizedSelectedFolder)
        );
        
        console.log("Root folder item found:", rootFolderItem ? "yes" : "no", 
          rootFolderItem ? `(${rootFolderItem.path})` : "");
        
        // Count directory items for debugging
        const directoryItems = allFiles.filter(file => file.isDirectory);
        console.log(`Found ${directoryItems.length} directory items in allFiles`);
        
        if (directoryItems.length > 0) {
          // Log the first few directory items for debugging
          directoryItems.slice(0, 3).forEach(dir => {
            console.log(`Directory: ${dir.name}, path: ${dir.path}, isDirectory: ${dir.isDirectory}`);
          });
        }

        // Create the tree structure starting with the root
        let rootTree: TreeNode[] = [];
        
        if (rootFolderItem) {
          // If we found a root folder item, use it as the top-level node
          const rootNode: TreeNode = {
            id: `node-${normalizedSelectedFolder}`,
            name: rootFolderItem.name || basename(normalizedSelectedFolder),
            path: normalizedSelectedFolder,
            type: "directory",
            level: 0,
            children: [],
            isExpanded: expandedNodes[`node-${normalizedSelectedFolder}`] !== undefined 
              ? expandedNodes[`node-${normalizedSelectedFolder}`] 
              : true,
            fileData: rootFolderItem
          };
          
          // Then build the rest of the tree under this root
          buildChildrenTree(rootNode, allFiles, normalizedSelectedFolder);
          rootTree = [rootNode];
          console.log("Built tree with root node:", rootNode.name);
        } else {
          // If no root folder was found, build the tree from the files directly
          console.log("No root folder item found, building from direct file list");
          const fileMap: Record<string, any> = {};
          
          // First pass: create directories and files
          allFiles.forEach((file, index) => {
            if (!file.path) {
              console.log("Skipping file with no path");
              return;
            }
            
            // Skip excluded files
            if (file.excludedByDefault) {
              console.log("Skipping excluded file:", file.name);
              return;
            }
            
            const normalizedFilePath = normalizePath(file.path);
            
            // Skip the root folder itself as we're handling it separately
            if (arePathsEqual(normalizedFilePath, normalizedSelectedFolder)) {
              console.log("Skipping root folder in file loop:", normalizedFilePath);
              return;
            }
            
            // Get the relative path for non-root files
            const relativePath = normalizedSelectedFolder && isSubPath(normalizedSelectedFolder, normalizedFilePath)
              ? normalizedFilePath.substring(normalizedSelectedFolder.length + 1)
              : normalizedFilePath;
            
            // Use the path utilities to split the path properly
            const parts = makeRelativePath(relativePath).split('/').filter(Boolean);
            
            // Extra validation to prevent issues with malformed paths
            if (parts.length === 0) {
              console.log("Skipping invalid path:", relativePath);
              return;
            }
            
            let currentPath = '';
            let current = fileMap;
            
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (!part) continue;
              
              currentPath = currentPath ? join(currentPath, part) : part;
              const fullPath = normalizedSelectedFolder
                ? join(normalizedSelectedFolder, currentPath)
                : currentPath;
              
              if (i === parts.length - 1) {
                // This is a file
                current[part] = {
                  id: `node-${file.path}`,
                  name: part,
                  path: file.path,
                  type: "file",
                  level: i + 1,
                  fileData: file,
                };
              } else {
                // This is a directory
                if (!current[part]) {
                  current[part] = {
                    id: `node-${fullPath}`,
                    name: part,
                    path: fullPath,
                    type: "directory",
                    level: i + 1,
                    children: {},
                  };
                }
                current = current[part].children;
              }
            }
          });
          
          // Convert to TreeNode array
          rootTree = convertToTreeNodes(fileMap);
          console.log("Built tree from fileMap, found nodes:", rootTree.length);
        }

        // Sort the top level (directories first, then by name)
        const sortedTree = rootTree.sort((a, b) => {
          if (a.type === "directory" && b.type === "file") return -1;
          if (a.type === "file" && b.type === "directory") return 1;

          // Sort files by token count (largest first)
          if (a.type === "file" && b.type === "file") {
            const aTokens = a.fileData?.tokenCount || 0;
            const bTokens = b.fileData?.tokenCount || 0;
            return bTokens - aTokens;
          }

          return a.name.localeCompare(b.name);
        });

        // Apply expanded state directly during tree creation rather than in a separate effect
        const applyExpandedState = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map((node: TreeNode): TreeNode => {
            if (node.type === "directory") {
              const isExpanded =
                expandedNodes[node.id] !== undefined
                ? expandedNodes[node.id]
                : true; // Default to expanded if not in state
  
              return {
                ...node,
                isExpanded,
                children: node.children ? applyExpandedState(node.children) : [],
              };
            }
            return node;
          });
        };

        // Apply expanded state and sort in one operation
        const processedTree = applyExpandedState(sortedTree);
        
        // Set the fully processed tree only once
        setFileTree(processedTree);
        setIsTreeBuildingComplete(true);
        
        console.log("Tree building complete, nodes:", processedTree.length);
      } catch (err) {
        console.error("Error building file tree:", err);
        // On error, try to build a simple flat tree as a fallback
        try {
          console.log("Attempting to build a simple flat tree as fallback");
          const flatTree = allFiles
            .filter(file => 
              !arePathsEqual(normalizePath(file.path), selectedFolder ? normalizePath(selectedFolder) : '') && 
              !file.excludedByDefault // Filter out excluded files
            )
            .map((file) => {
              return {
                id: `node-${file.path}`,
                name: file.name,
                path: file.path,
                type: file.isDirectory ? "directory" as const : "file" as const,
                level: 0,
                fileData: file,
                isExpanded: true
              };
            })
            .sort((a, b) => {
              // Sort directories first
              if (a.type === "directory" && b.type === "file") return -1;
              if (a.type === "file" && b.type === "directory") return 1;
              return a.name.localeCompare(b.name);
            });
            
          setFileTree(flatTree);
          setIsTreeBuildingComplete(true);
          console.log("Built simple flat tree with", flatTree.length, "items");
        } catch (fallbackError) {
          console.error("Fallback tree building also failed:", fallbackError);
          setFileTree([]);
          setIsTreeBuildingComplete(true);
        }
      }
    };

    // Helper function to build children tree under a parent node
    const buildChildrenTree = (parentNode: TreeNode, files: any[], parentPath: string) => {
      // Get all files that are direct children of the parent path
      const childFiles = files.filter(file => {
        // Skip files without a path
        if (!file.path) return false;
        
        // Skip files that are excluded by gitignore or default exclusions
        if (file.excludedByDefault) return false;
        
        const normalizedFilePath = normalizePath(file.path);
        const normalizedParentPath = normalizePath(parentPath);
        
        // Skip the parent folder itself
        if (arePathsEqual(normalizedFilePath, normalizedParentPath)) return false;
        
        // Check if this file is a direct child of the parent
        // We need to handle both Unix and Windows path separators
        if (isSubPath(normalizedParentPath, normalizedFilePath)) {
          // Get the relative path after the parent path using our utility
          const relPath = safeRelativePath(normalizedParentPath, normalizedFilePath);
          
          // Count path segments to ensure it's a direct child (only one level deep)
          const segments = makeRelativePath(relPath).split('/').filter(Boolean);
          return segments.length === 1;
        }
        
        return false;
      });
      
      console.log(`Building children tree for ${parentNode.name}, found ${childFiles.length} direct children`);
      
      // Sort children (directories first, then files)
      const sortedChildren = childFiles.sort((a: any, b: any) => {
        // Make sure we treat isDirectory consistently
        const aIsDir = Boolean(a.isDirectory);
        const bIsDir = Boolean(b.isDirectory);
        
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Create tree nodes for children
      parentNode.children = sortedChildren.map((file: any, index: number) => {
        if (!file || !file.path) {
          console.warn("Skipping invalid file in children map");
          return null;
        }
        
        const nodePath = normalizePath(file.path);
        const nodeId = `node-${nodePath}`;
        const isDirectory = Boolean(file.isDirectory);
        
        const node: TreeNode = {
          id: nodeId,
          name: file.name || basename(nodePath),
          path: nodePath,
          type: isDirectory ? "directory" : "file",
          level: parentNode.level + 1,
          fileData: file,
          isExpanded: true // Default expanded state, will be updated in the next effect
        };
        
        if (isDirectory) {
          node.children = [];
          buildChildrenTree(node, files, nodePath);
        }
        
        return node;
      }).filter(node => node !== null) as TreeNode[]; // Filter out null values
    };

    // Helper function to convert the file map to TreeNode array
    const convertToTreeNodes = (node: Record<string, any>, level = 0): TreeNode[] => {
      const keys = Object.keys(node);
      return keys.map((key, index) => {
        const item = node[key];

        if (item.type === "file") {
          return item as TreeNode;
        } else {
          const children = convertToTreeNodes(item.children, level + 1);

          return {
            ...item,
            children: children.sort((a, b) => {
              if (a.type === "directory" && b.type === "file") return -1;
              if (a.type === "file" && b.type === "directory") return 1;
              if (a.type === "file" && b.type === "file") {
                const aTokens = a.fileData?.tokenCount || 0;
                const bTokens = b.fileData?.tokenCount || 0;
                return bTokens - aTokens;
              }
              return a.name.localeCompare(b.name);
            }),
            isExpanded: true, // Default state, will be updated later
          };
        }
      });
    };

    // Use a timeout to not block UI, but with a longer delay to prevent rapid re-renders
    const buildTreeTimeoutId = setTimeout(buildTree, 50);
    return () => clearTimeout(buildTreeTimeoutId);
  }, [allFiles, selectedFolder, expandedNodes]);

  // Flatten the tree for rendering with proper indentation
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = [];

    nodes.forEach((node) => {
      // Add the current node
      result.push(node);

      // If it's a directory and it's expanded, add its children
      if (node.type === "directory" && node.isExpanded && node.children) {
        result = [...result, ...flattenTree(node.children)];
      }
    });

    return result;
  };

  // Filter the tree based on search term
  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) {
      // When not searching, only filter out files marked as excludedByDefault
      // We want to show binary files in the tree with their "Binary" badge
      return nodes.filter(node => {
        // Skip excluded files/folders, but keep binary files
        if (node.fileData?.excludedByDefault && !node.fileData?.isBinary) {
          return false;
        }
        
        // For directories, also filter their children
        if (node.type === "directory" && node.children) {
          // Filter children recursively - keep binary files but filter out excludedByDefault
          const filteredChildren = node.children.filter(child => 
            child.fileData?.isBinary || !child.fileData?.excludedByDefault
          );
          
          // Only keep directories that have valid children after filtering
          if (filteredChildren.length === 0) {
            return false; // Skip empty directories after filtering
          }
          
          // Update the node's children to only include non-excluded items
          node.children = filterTree(filteredChildren, "");
        }
        
        return true;
      });
    }

    const lowerTerm = term.toLowerCase();

    // Function to check if a node or any of its children match the search
    const nodeMatches = (node: TreeNode): boolean => {
      // Always exclude files/folders marked as excludedByDefault, but keep binary files
      if (node.fileData?.excludedByDefault && !node.fileData?.isBinary) {
        return false;
      }
      
      // Check if the node name matches
      if (node.name.toLowerCase().includes(lowerTerm)) return true;
      
      // If it's a file, we're done
      if (node.type === "file") return false;

      // For directories, check if any children match
      if (node.children) {
        return node.children.some(nodeMatches);
      }
      
      return false;
    };
    
    // Filter the nodes
    return nodes.filter(nodeMatches).map((node) => {
      // If it's a directory, also filter its children
      if (node.type === "directory" && node.children) {
        return {
          ...node,
          children: filterTree(node.children, term),
          isExpanded: true, // Auto-expand directories when searching
        };
      }
      return node;
    });
  };

  // The final tree to render, filtered and flattened
  const visibleTree = flattenTree(filterTree(fileTree, searchTerm));

  return (
    <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="sidebar-header">
        <div className="sidebar-title">Files</div>
        <div className="sidebar-folder-path">{selectedFolder}</div>
      </div>

      <div className="sidebar-search">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          placeholder="Search files..."
        />
      </div>

      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={selectAllFiles}>
          Select All
        </button>
        <button className="sidebar-action-btn" onClick={deselectAllFiles}>
          Deselect All
        </button>
      </div>

      {allFiles.length > 0 ? (
        <>
          <div className="file-tree">
            {visibleTree.length > 0 ? (
              visibleTree.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  selectedFiles={selectedFiles}
                  toggleFileSelection={toggleFileSelection}
                  toggleFolderSelection={toggleFolderSelection}
                  toggleExpanded={toggleExpanded}
                  allFiles={allFiles}
                />
              ))
            ) : (
              <div className="tree-empty">No files match your search.</div>
            )}
          </div>
        </>
      ) : (
        <div className="tree-empty">No files found in this folder.</div>
      )}

      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar"
      ></div>
    </div>
  );
};

export default Sidebar;
