import React, { useState, useEffect, useRef } from "react";
import { TreeNode, FileData, RootFolder, isDirectoryNode, NodeType } from "../types/FileTypes";
import SearchBar from "./SearchBar";
import TreeItem from "./TreeItem";
import { FolderOpen, Plus, X, Trash, Trash2 } from "lucide-react";
import { IpcRendererEvent } from 'electron';
import { FolderPlus, RefreshCw } from 'lucide-react';

/**
 * Import path utilities for handling file paths across different operating systems.
 * While not all utilities are used directly, they're kept for consistency and future use.
 */
import * as pathUtils from "../utils/pathUtils";

/**
 * Constants for localStorage keys
 */
const STORAGE_KEYS = {
  EXPANDED_NODES: "pastemax-expanded-nodes",
};

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

interface StateCleanupData {
  type: 'root-removed' | 'all-roots-removed' | 'cache-cleared';
  rootId?: string;
}

interface SidebarProps {
  rootFolders: RootFolder[];
  selectedFolder: string | null;
  openFolder: () => void;
  addRootFolder: () => void;
  removeRootFolder: (rootId: string) => void;
  removeAllRootFolders: () => void;
  allFiles: FileData[];
  selectedFiles: FileData[];
  toggleFileSelection: (file: FileData) => void;
  toggleFolderSelection: (folder: RootFolder) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  expandedNodes: Set<string>;
  toggleExpanded: (node: TreeNode) => void;
  processingStatus: { status: string; message: string } | null;
  onExpandedNodesChange: (nodes: Set<string>) => void;
  onSelectedFileChange: (file: FileData | null) => void;
  selectedFile: FileData | null;
}

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
  onExpandedNodesChange,
  onSelectedFileChange,
  selectedFile,
}: SidebarProps) => {
  // Use type assertions to satisfy TypeScript
  const [fileTree, setFileTree] = useState([] as TreeNode[]);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem("pastemax-sidebar-width");
    return savedWidth ? parseInt(savedWidth, 10) : 300; // Default width
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef(null as HTMLDivElement | null);
  const resizeHandleRef = useRef(null as HTMLDivElement | null);

  // Build file tree when files change or when processing status changes
  // useEffect(() => {
  //   console.log("Building file tree...");
    
  //   if (processingStatus.status === "processing") {
  //     // Don't build tree while processing
  //     return;
  //   }

  //   // When backend processing completes, build the tree
  //   const tree = buildFileTree(allFiles, rootFolders, expandedNodes);
  //   setFileTree(tree);
    
  //   // We'll handle auto-expanding root folders in a different way
  // }, [allFiles, rootFolders, processingStatus, expandedNodes]);

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
      // Save sidebar width to localStorage for persistence
      localStorage.setItem("pastemax-sidebar-width", sidebarWidth.toString());
    };

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", handleResizeEnd);

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [isResizing, sidebarWidth]);

  // Load saved sidebar width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem("pastemax-sidebar-width");
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  // Build file tree structure from flat list of files
  useEffect(() => {
    if (allFiles.length === 0) {
      setFileTree([]);
      return;
    }

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
              (!file.rootId || file.rootId === rootFolder.id) // Handle both new and old files
            );
            
            // Create a root node with the correct ID format
            const rootNode: TreeNode = {
              id: `node-${normalizedRootPath}-${rootFolder.id}`,
              name: rootFolder.name || basename(normalizedRootPath),
              path: normalizedRootPath,
              type: 'root' as NodeType,
              level: 0,
              children: [],
              isExpanded: expandedNodes.has(`node-${normalizedRootPath}-${rootFolder.id}`),
              rootId: rootFolder.id,
              fileData: rootFolderItem || {
                name: rootFolder.name || basename(normalizedRootPath),
                path: normalizedRootPath,
                isDirectory: true,
                rootId: rootFolder.id,
                content: "",
                tokenCount: 0,
                size: 0,
                isBinary: false,
                isSkipped: false,
                excludedByDefault: false
              }
            };
            
            // Filter files for this root
            const rootFiles = allFiles.filter(file => 
              !file.rootId || file.rootId === rootFolder.id
            );
            
            // Build children tree for this root
            buildChildrenTree(rootNode, rootFiles, normalizedRootPath, rootFolder.id);
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
              type: 'root' as NodeType,
              level: 0,
              children: [],
              isExpanded: expandedNodes.has(`node-${normalizedSelectedFolder}`),
              fileData: rootFolderItem
            };
            
            // Build children tree for backward compatibility
            buildChildrenTree(rootNode, allFiles, normalizedSelectedFolder);
            rootTree = [rootNode];
          }
        }

        setFileTree(rootTree);
      } catch (error) {
        console.error("Error building file tree:", error);
        setFileTree([]);
      }
    };

    buildTree();
  }, [allFiles, rootFolders, selectedFolder, expandedNodes]);

  // Helper function to build children tree
  const buildChildrenTree = (
    parentNode: TreeNode,
    files: FileData[],
    parentPath: string,
    rootId: string | null = null
  ) => {
    // Get immediate children
    const children = files.filter(file => {
      if (!file || !file.path) return false;
      
      const normalizedFilePath = normalizePath(file.path);
      const normalizedParentPath = normalizePath(parentPath);
      
      // Check if this file belongs to this root
      if (rootId && file.rootId && file.rootId !== rootId) {
        return false;
      }
      
      // Check if this is an immediate child
      const isChild = isSubPath(normalizedParentPath, normalizedFilePath) &&
        normalizedFilePath.split('/').length === normalizedParentPath.split('/').length + 1;
      
      return isChild;
    });

    // Sort children (directories first, then alphabetically)
    children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    // Create TreeNode for each child
    children.forEach(child => {
      const childPath = normalizePath(child.path);
      const nodeId = rootId ? 
        `node-${childPath}-${rootId}` : 
        `node-${childPath}`;
      
      const childNode: TreeNode = {
        id: nodeId,
        name: child.name,
        path: childPath,
        type: child.isDirectory ? 'folder' : 'file' as NodeType,
        level: (parentNode.level || 0) + 1,
        children: [],
        isExpanded: expandedNodes.has(nodeId),
        rootId: rootId || undefined,
        fileData: child
      };

      if (child.isDirectory) {
        buildChildrenTree(childNode, files, childPath, rootId);
      }

      if (!parentNode.children) {
        parentNode.children = [];
      }
      parentNode.children.push(childNode);
    });
  };

  // Flatten the tree for rendering with proper indentation
  const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
    let result: TreeNode[] = [];

    nodes.forEach((node) => {
      // Add the current node
      result.push(node);

      // If it's a directory and it's expanded, add its children
      if (isDirectoryNode(node) && node.isExpanded && node.children && node.children.length > 0) {
        console.log(`Flattening ${node.children.length} children of node ${node.id} (${node.name})`);
        result = [...result, ...flattenTree(node.children)];
      }
    });

    return result;
  };

  // Filter the tree based on search term
  const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
    if (!term) {
      return nodes.filter(node => {
        if (node.fileData?.excludedByDefault && !node.fileData?.isBinary) {
          return false;
        }
        
        if (isDirectoryNode(node) && node.children) {
          const filteredChildren = node.children.filter(child => 
            child.fileData?.isBinary || !child.fileData?.excludedByDefault
          );
          
          if (filteredChildren.length === 0) {
            return false;
          }
          
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
      if (isDirectoryNode(node) && node.children) {
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

  // Add state cleanup handler
  useEffect(() => {
    const handleStateCleanup = (_event: IpcRendererEvent, data: StateCleanupData) => {
      console.log('Handling state cleanup:', data.type);
      
      switch (data.type) {
        case 'root-removed':
          if (data.rootId) {
            // Clear expanded nodes for this root
            const newExpandedNodes = new Set<string>();
            const currentNodes = Array.from(expandedNodes);
            currentNodes.forEach(nodeId => {
              if (typeof nodeId === 'string' && !nodeId.startsWith(data.rootId!)) {
                newExpandedNodes.add(nodeId);
              }
            });
            onExpandedNodesChange(newExpandedNodes);
            localStorage.setItem('expandedNodes', JSON.stringify(Array.from(newExpandedNodes)));
            
            // Clear selection if it was in this root
            if (selectedFile && selectedFile.path && selectedFile.path.startsWith(data.rootId)) {
              onSelectedFileChange(null);
            }
          }
          break;
          
        case 'all-roots-removed':
          // Clear all expanded nodes
          onExpandedNodesChange(new Set<string>());
          localStorage.removeItem('expandedNodes');
          
          // Clear selection
          onSelectedFileChange(null);
          break;
          
        case 'cache-cleared':
          // Clear all state
          onExpandedNodesChange(new Set<string>());
          localStorage.removeItem('expandedNodes');
          onSelectedFileChange(null);
          break;
      }
    };
    
    window.electron.ipcRenderer.on('state-cleanup', handleStateCleanup);
    
    return () => {
      window.electron.ipcRenderer.removeListener('state-cleanup', handleStateCleanup);
    };
  }, [expandedNodes, selectedFile, onExpandedNodesChange, onSelectedFileChange]);

  // Add clear cache button
  const handleClearCache = () => {
    window.electron.ipcRenderer.send('clear-cache');
  };

  return (
    <div 
      className={`sidebar ${isResizing ? 'resizing' : ''}`} 
      style={{ width: `${sidebarWidth}px` }}
    >
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
            <button onClick={handleClearCache} title="Clear Cache">
              <RefreshCw className="w-4 h-4" />
            </button>
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
      <div className="file-tree" ref={sidebarRef}>
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

      <div className="sidebar-resizer" onMouseDown={handleResizeStart} ref={resizeHandleRef}></div>
    </div>
  );
};

export default Sidebar;
