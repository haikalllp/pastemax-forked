import React, { useState, useEffect, useRef } from "react";
import { SidebarProps, TreeNode, FileData, RootFolder } from "../types/FileTypes";
import SearchBar from "./SearchBar";
import TreeItem from "./TreeItem";
import { FolderOpen, Plus, X, Trash, Trash2 } from "lucide-react";

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
 * - Manage multiple root folders
 */
const Sidebar = ({
  rootFolders,
  selectedFolder,
  openFolder,
  addRootFolder,
  removeRootFolder,
  removeAllRootFolders,
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
}: SidebarProps) => {
  // State for managing the file tree and UI
  const [fileTree, setFileTree] = useState(() => [] as TreeNode[]);
  const [isTreeBuildingComplete, setIsTreeBuildingComplete] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const fileTreeRef = useRef(null) as { current: HTMLDivElement | null }; // Use proper type assertion

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
        // Create an array to hold all root nodes
        let rootTree: TreeNode[] = [];
        
        // If we have rootFolders, build trees for each one
        if (rootFolders && rootFolders.length > 0) {
          // Process each root folder without duplicates
          const processedRootIds = new Set<string>();
          
          rootFolders.forEach((rootFolder) => {
            // Skip if this root ID has already been processed
            if (processedRootIds.has(rootFolder.id)) {
              console.log(`Skipping duplicate root folder: ${rootFolder.name} (${rootFolder.id})`);
              return;
            }
            
            processedRootIds.add(rootFolder.id);
            const normalizedRootPath = normalizePath(rootFolder.path);
            
            // Find the root directory in allFiles
            const rootFolderItem = allFiles.find(file => 
              file && file.path && file.isDirectory && 
              arePathsEqual(normalizePath(file.path), normalizedRootPath) &&
              file.rootId === rootFolder.id
            );
            
            // Create a root node with the correct ID format
            const rootNode: TreeNode = {
              id: `node-${normalizedRootPath}`,
              name: rootFolder.name || basename(normalizedRootPath),
              path: normalizedRootPath,
              type: "directory", // Use directory type to maintain original UI
              level: 0,
              children: [],
              isExpanded: expandedNodes[`node-${normalizedRootPath}`] !== undefined 
                ? expandedNodes[`node-${normalizedRootPath}`] 
                : true,
              fileData: rootFolderItem,
              rootId: rootFolder.id
            };
            
            // Filter files for this root
            const rootFiles = allFiles.filter(file => file.rootId === rootFolder.id);
            
            // Build children tree for this root using standard directory handling
            buildChildrenTree(rootNode, rootFiles, normalizedRootPath);
            rootTree.push(rootNode);
          });
        } 
        // For backward compatibility, handle selectedFolder case
        else if (selectedFolder) {
          const normalizedSelectedFolder = normalizePath(selectedFolder);
          
          // Find the root folder item if it exists
          const rootFolderItem = allFiles.find(file => 
            file && file.path && file.isDirectory && 
            arePathsEqual(normalizePath(file.path), normalizedSelectedFolder)
          );
          
          if (rootFolderItem) {
            // Create a traditional single root node
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
            
            // Build children tree for backward compatibility
            buildChildrenTree(rootNode, allFiles, normalizedSelectedFolder);
            rootTree = [rootNode];
          }
        }

        // Count directory items for debugging
        const directoryItems = allFiles.filter(file => file.isDirectory);
        console.log(`Found ${directoryItems.length} directory items in allFiles`);
        
        if (directoryItems.length > 0) {
          // Log the first few directory items for debugging
          directoryItems.slice(0, 3).forEach(dir => {
            console.log(`Directory: ${dir.name}, path: ${dir.path}, isDirectory: ${dir.isDirectory}`);
          });
        }

        // Sort the top level (directories first, then by name)
        const sortedTree = rootTree.sort((a, b) => {
          if (a.type === "directory" && b.type === "file") return -1;
          if (a.type === "file" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });

        // Apply expanded state and set the tree
        setFileTree(sortedTree);
        setIsTreeBuildingComplete(true);
        console.log("Built tree with", sortedTree.length, "root items");
      } catch (error) {
        console.error("Error building file tree:", error);
        
        // Try a simpler approach as fallback
        try {
          console.warn("Trying fallback flat-tree approach");
          
          // Create a simple flat list of all files
          const flatTree = allFiles
            .filter(file => !file.excludedByDefault)
            .map(file => ({
              id: `node-${file.path}`,
              name: file.name || basename(file.path),
              path: file.path,
              type: file.isDirectory ? "directory" : "file",
              level: 0,
              fileData: file,
              isExpanded: true,
              rootId: file.rootId
            }))
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
          isExpanded: expandedNodes[nodeId] !== undefined 
                ? expandedNodes[nodeId] 
                : true,
          rootId: file.rootId
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
  }, [allFiles, selectedFolder, rootFolders, expandedNodes]);

  // Flatten the tree for rendering with proper indentation
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = [];

    nodes.forEach((node) => {
      // Add the current node
      result.push(node);

      // If it's a directory and it's expanded, add its children
      if (node.type === "directory" && node.isExpanded && node.children && node.children.length > 0) {
        console.log(`Flattening ${node.children.length} children of node ${node.id} (${node.name})`);
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
        {rootFolders && rootFolders.length > 0 ? (
          <div className="sidebar-actions">
            <button 
              className="sidebar-action-btn select-all"
              onClick={selectAllFiles}
              disabled={processingStatus?.status === "processing" || allFiles.length === 0}
            >
              Select All
            </button>
            <button
              className="sidebar-action-btn deselect-all"
              onClick={deselectAllFiles}
              disabled={processingStatus?.status === "processing" || selectedFiles.length === 0}
            >
              Deselect All
            </button>
            {rootFolders.length > 1 && (
              <button
                className="sidebar-action-btn remove-all"
                onClick={removeAllRootFolders}
                disabled={processingStatus?.status === "processing"}
                title="Remove all root folders"
              >
                <Trash2 size={14} />
                Remove All
              </button>
            )}
          </div>
        ) : selectedFolder ? (
          <div className="sidebar-folder-path">{selectedFolder}</div>
        ) : (
          <div className="sidebar-folder-path">
            <button
              className="select-folder-btn sidebar-select-btn"
              onClick={openFolder}
              disabled={processingStatus?.status === "processing"}
            >
              <FolderOpen size={14} />
              Select Folder
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-search">
        <SearchBar
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
        />
      </div>

      {!selectedFolder && rootFolders.length === 0 && (
        <div className="empty-folder-message">
          No folder selected. Please select a folder to view files.
        </div>
      )}

      {processingStatus?.status === "processing" && (
        <div className="sidebar-loading">
          <div className="spinner"></div>
          <span>{processingStatus.message}</span>
        </div>
      )}

      {/* File tree list */}
      <div className="file-tree" ref={fileTreeRef}>
        {fileTree.map((node: TreeNode) => (
          <TreeItem
            key={node.id}
            node={node}
            selectedFiles={selectedFiles}
            toggleFileSelection={toggleFileSelection}
            toggleFolderSelection={toggleFolderSelection}
            toggleExpanded={toggleExpanded}
            allFiles={allFiles}
            isRootNode={node.type === "root"}
            removeRootFolder={node.level === 0 ? removeRootFolder : undefined}
          />
        ))}
      </div>

      <div className="sidebar-resizer" onMouseDown={handleResizeStart}></div>
    </div>
  );
};

export default Sidebar;
