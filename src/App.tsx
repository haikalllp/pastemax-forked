import React, { useState, useEffect, useCallback } from "react";
import type { Dispatch, SetStateAction } from 'react';
import Sidebar from "./components/Sidebar";
import FileList from "./components/FileList";
import CopyButton from "./components/CopyButton";
import UserInstructions from "./components/UserInstructions";
import { FileData, RootFolder, TreeNode, SidebarProps, isFileData, isRootFolder, isTreeNode } from "./types/FileTypes";
import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";
import { PlusCircle, FolderOpen} from "lucide-react";

/**
 * Import path utilities for handling file paths across different operating systems.
 * While not all utilities are used directly, they're kept for consistency and future use.
 */
import * as pathUtils from "./utils/pathUtils";

// Ensure we have the critical path utilities, with fallbacks if needed
const {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual = (path1: string, path2: string): boolean => {
    // Fallback implementation if the imported version isn't available
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    return normalizePath(path1).toLowerCase() === normalizePath(path2).toLowerCase();
  },
  isSubPath = (parent: string, child: string): boolean => {
    // Fallback implementation if the imported version isn't available
    if (!parent || !child) return false;
    const normalizedParent = normalizePath(parent);
    const normalizedChild = normalizePath(child);
    return normalizedChild.toLowerCase().startsWith(normalizedParent.toLowerCase());
  },
  join = (...parts: string[]): string => parts.filter(Boolean).join('/'),
  basename = (path: string): string => {
    // Fallback implementation if the imported version isn't available
    if (!path) return "";
    const normalizedPath = normalizePath(path);
    const parts = normalizedPath.split("/");
    return parts[parts.length - 1] || "";
  }
} = pathUtils;

// Access the electron API from the window object
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (
          channel: string,
          func: (...args: any[]) => void,
        ) => void;
      };
    };
  }
}

/**
 * Keys used for storing app state in localStorage.
 * Keeping them in one place makes them easier to manage and update.
 */
const STORAGE_KEYS = {
  SELECTED_FOLDER: "pastemax-selected-folder",
  ROOT_FOLDERS: "pastemax-root-folders",
  SELECTED_FILES: "pastemax-selected-files",
  SORT_ORDER: "pastemax-sort-order",
  SEARCH_TERM: "pastemax-search-term",
  EXPANDED_NODES: "pastemax-expanded-nodes",
};

/**
 * The main App component that handles:
 * - File selection and management
 * - Folder navigation
 * - File content copying
 * - UI state management
 */
const App = (): JSX.Element => {
  // Clear saved folder on startup (temporary, for testing)
  useEffect(() => {
    // Commenting out for multiple root folders testing
    // localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
    
    // These can remain for session data management
    localStorage.removeItem("hasLoadedInitialData");
    sessionStorage.removeItem("hasLoadedInitialData");
    
    // For testing, we could initialize ROOT_FOLDERS with test data if needed
    // const testRootFolder = {
    //   id: "test-root-1",
    //   path: "C:/test-folder",
    //   name: "Test Root",
    //   isExpanded: true
    // };
    // localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify([testRootFolder]));
  }, []);

  // Load initial state from localStorage if available
  const savedFolder = localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER);
  const savedFiles = localStorage.getItem(STORAGE_KEYS.SELECTED_FILES);
  const savedSortOrder = localStorage.getItem(STORAGE_KEYS.SORT_ORDER);
  const savedSearchTerm = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(savedFolder);
  const [rootFolders, setRootFolders] = useState<RootFolder[]>(() => {
    const savedRoots = localStorage.getItem(STORAGE_KEYS.ROOT_FOLDERS);
    return (savedRoots ? JSON.parse(savedRoots) : []) as RootFolder[];
  });
  const [allFiles, setAllFiles] = useState<FileData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileData[]>([]);
  const [sortOrder, setSortOrder] = useState<string>(savedSortOrder || "tokens-desc");
  const [searchTerm, setSearchTerm] = useState<string>(savedSearchTerm || "");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [displayedFiles, setDisplayedFiles] = useState<FileData[]>([]);
  const [processingStatus, setProcessingStatus] = useState<{ status: string; message: string } | null>(null);
  const [includeFileTree, setIncludeFileTree] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);

  // State for sort dropdown
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // Check if we're running in Electron or browser environment
  const isElectron = window.electron !== undefined;

  const [isSafeMode, setIsSafeMode] = useState(false);

  // Load expanded nodes state from localStorage
  useEffect(() => {
    const savedExpandedNodes = localStorage.getItem(
      STORAGE_KEYS.EXPANDED_NODES,
    );
    if (savedExpandedNodes) {
      try {
        setExpandedNodes(new Set(JSON.parse(savedExpandedNodes)));
      } catch (error) {
        console.error("Error parsing saved expanded nodes:", error);
      }
    }
  }, []);

  // Persist selected folder when it changes
  useEffect(() => {
    if (selectedFolder) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_FOLDER, selectedFolder);
    } else {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
    }
  }, [selectedFolder]);

  // Persist selected files when they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SELECTED_FILES,
      JSON.stringify(selectedFiles),
    );
  }, [selectedFiles]);

  // Persist sort order when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, sortOrder);
  }, [sortOrder]);

  // Persist search term when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm);
  }, [searchTerm]);

  // Add a function to cancel directory loading
  const cancelDirectoryLoading = useCallback(() => {
    if (isElectron) {
      window.electron.ipcRenderer.send("cancel-directory-loading");
      setProcessingStatus({
        status: "idle",
        message: "Directory loading cancelled",
      });
    }
  }, [isElectron]);

  // Add this new useEffect for safe mode detection
  useEffect(() => {
    if (!isElectron) return;
    
    const handleStartupMode = (mode: { safeMode: boolean }) => {
      setIsSafeMode(mode.safeMode);
    
      // If we're in safe mode, don't auto-load the previously selected folder
      if (mode.safeMode) {
        console.log("Starting in safe mode - not loading saved folder");
        localStorage.removeItem("hasLoadedInitialData");
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
      }
    };
    
    window.electron.ipcRenderer.on("startup-mode", handleStartupMode);
    
    return () => {
      window.electron.ipcRenderer.removeListener("startup-mode", handleStartupMode);
    };
  }, [isElectron]);

  // Modify the existing useEffect for loading initial data
  useEffect(() => {
    if (!isElectron || !selectedFolder || isSafeMode) return;
    
    // Use a flag in sessionStorage to ensure we only load data once per session
    const hasLoadedInitialData = sessionStorage.getItem("hasLoadedInitialData");
    if (hasLoadedInitialData === "true") return;
    
    console.log("Loading saved folder on startup:", selectedFolder);
    setProcessingStatus({
      status: "processing",
      message: "Loading files from previously selected folder... (Press ESC to cancel)",
    });
    window.electron.ipcRenderer.send("request-file-list", selectedFolder);
    
    // Mark that we've loaded the initial data
    sessionStorage.setItem("hasLoadedInitialData", "true");
  }, [isElectron, selectedFolder, isSafeMode]);
  

  // Listen for folder selection from main process
  useEffect(() => {
    if (!isElectron) {
      console.warn("Not running in Electron environment");
      return;
    }

    const handleFolderSelected = (folderPath: string) => {
      // Check if folderPath is valid string
      if (typeof folderPath === "string") {
        console.log("Folder selected:", folderPath);
        setSelectedFolder(folderPath);
        // We'll select all files after they're loaded
        setSelectedFiles([]);
        setProcessingStatus({
          status: "processing",
          message: "Requesting file list...",
        });
        window.electron.ipcRenderer.send("request-file-list", folderPath);
      } else {
        console.error("Invalid folder path received:", folderPath);
        setProcessingStatus({
          status: "error",
          message: "Invalid folder path received",
        });
      }
    };

    const handleFileListData = (files: FileData[]) => {
      console.log("Received file list data:", files ? files.length : 0, "files");
      
      // Ensure we have a valid array of files
      if (!files || !Array.isArray(files)) {
        console.error("Invalid file list data received:", files);
        setProcessingStatus({
          status: "error",
          message: "Error: Received invalid file list data",
        });
        return;
      }
      
      // Log directory entries for debugging
      const directoryEntries = files.filter(file => file && file.isDirectory);
      console.log(`Directory entries in file list: ${directoryEntries.length}`);
      if (directoryEntries.length > 0) {
        directoryEntries.slice(0, 3).forEach(dir => {
          console.log(`Directory: ${dir.name}, path: ${dir.path}, isDirectory: ${dir.isDirectory}`);
        });
      }
      
      // Process files and ensure they have the correct structure
      setAllFiles(files);
      setProcessingStatus({
        status: "complete",
        message: `Loaded ${files.length} files`,
      });

      // Apply filters and sort to the new files
      applyFiltersAndSort(files, sortOrder, searchTerm);

      // Ensure the root folder is expanded by default if it exists
      const rootFolder = files.find(file => 
        file && file.path && file.isDirectory && 
        arePathsEqual(file.path, selectedFolder || '')
      );
      
      if (rootFolder) {
        console.log("Found root folder in file list:", rootFolder.name, rootFolder.path);
        setExpandedNodes((prev: Set<string>) => new Set([...prev, `node-${selectedFolder}`]));
      } else {
        console.log("Root folder not found in file list, selected folder is:", selectedFolder);
      }

      // Try to restore saved selection from localStorage, filtering for files that still exist
      const savedFiles = localStorage.getItem(STORAGE_KEYS.SELECTED_FILES);
      let newSelectedFiles: FileData[] = [];
      
      if (savedFiles) {
        try {
          const parsedSavedFiles: FileData[] = JSON.parse(savedFiles);
          // Filter saved files to ensure they exist in the new file list and are selectable
          newSelectedFiles = parsedSavedFiles.filter((file: FileData) =>
            files.some((f: FileData) =>
              f && f.path && file.path && 
              f.path === file.path && 
              !f.isBinary && !f.isSkipped && 
              !f.excludedByDefault && !f.isDirectory
            )
          );
        } catch (error) {
          console.error("Error parsing saved selected files:", error);
        }
      }

      // If no valid saved selection, default to selecting all non-binary, non-skipped, non-excluded files
      if (newSelectedFiles.length === 0) {
        newSelectedFiles = files
          .filter(
            (file: FileData) =>
              file && file.path && 
              !file.isBinary && !file.isSkipped && 
              !file.excludedByDefault && !file.isDirectory
          )
          .map((file: FileData) => file);
      }

      setSelectedFiles(newSelectedFiles);
    };

    const handleProcessingStatus = (status: {
      status: "idle" | "processing" | "complete" | "error" | "cancelled";
      message: string;
    }) => {
      console.log("Processing status:", status);
      
      // Always update the processing status immediately
      setProcessingStatus(status);
      
      // If we're completing, add a slight delay before updating state
      // This ensures UI transitions are smooth and user sees completion
      if (status.status === "complete") {
        // Keep the loading UI visible for a moment so user can see completion message
        setTimeout(() => {
          setProcessingStatus({
            status: "idle",
            message: status.message || "Processing complete"
          });
        }, 800); // 800ms delay gives user time to see the completion message
      } else if (status.status === "cancelled") {
        // Show cancelled status briefly before returning to idle
        setTimeout(() => {
          setProcessingStatus({
            status: "idle",
            message: ""
          });
        }, 1500);
      }
    };

    // New handler for root folder added event
    const handleRootFolderAdded = (newRoot: RootFolder) => {
      console.log("Root folder added:", newRoot);
      
      setRootFolders((prevRoots: RootFolder[]) => {
        // Ensure we're not duplicating roots
        const isRootAlreadyAdded = prevRoots.some(
          root => root.id === newRoot.id || arePathsEqual(root.path, newRoot.path)
        );
        
        if (isRootAlreadyAdded) {
          console.log("Root already exists, not adding duplicate", newRoot.path);
          return prevRoots;
        }
        
        // Add the new root to the existing roots
        const updatedRoots = [...prevRoots, newRoot];
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify(updatedRoots));
        return updatedRoots;
      });
      
      // Request file list for the new root
      setProcessingStatus({
        status: "processing",
        message: `Loading files from ${newRoot.name}...`,
      });
      window.electron.ipcRenderer.send("request-file-list", newRoot.path);
    };
    
    // Handler for root folder removed event
    const handleRootFolderRemoved = (rootId: string) => {
      console.log("Root folder removed:", rootId);
      
      setRootFolders((prevRoots: RootFolder[]) => {
        const updatedRoots = prevRoots.filter((root: RootFolder) => root.id !== rootId);
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify(updatedRoots));
        return updatedRoots;
      });
      
      // Remove files from this root from allFiles
      setAllFiles((prevFiles: FileData[]) => prevFiles.filter((file: FileData) => file.rootId !== rootId));
      
      // Update selected files
      setSelectedFiles((prevSelected: FileData[]) => 
        prevSelected.filter((file: FileData) => file.rootId !== rootId)
      );
      
      // Clean up expandedNodes for this root path
      setExpandedNodes((prev: Set<string>) => new Set([...prev].filter(node => !node.startsWith(`node-${rootId}`))));
      
      setProcessingStatus({
        status: "idle",
        message: `Removed folder: ${rootId}`
      });
    };
    
    // Handle root folder error
    const handleRootFolderError = (error: { error: string, path?: string, rootId?: string }) => {
      console.error("Root folder error:", error);
      
      // Set a detailed error message
      let errorMessage = error.error;
      if (error.path) {
        errorMessage += ` (${error.path})`;
      }
      
      // Update the UI with the error message
      setProcessingStatus({
        status: "error",
        message: errorMessage,
      });
      
      // Clear the error after 5 seconds
      setTimeout(() => {
        setProcessingStatus({
          status: "idle",
          message: "",
        });
      }, 5000);
    };

    // Add new handler for when all root folders are removed
    const handleAllRootFoldersRemoved = () => {
      console.log("All root folders removed event received from main process");
      // All state updates are already handled in the removeAllRootFolders function
      // This handler is mostly for confirmation or debugging
    };

    // Add event listeners
    window.electron.ipcRenderer.on("folder-selected", handleFolderSelected);
    window.electron.ipcRenderer.on("file-list-data", handleFileListData);
    window.electron.ipcRenderer.on("file-processing-status", handleProcessingStatus);
    
    // Add new event listeners for root folder events
    window.electron.ipcRenderer.on("root-folder-added", handleRootFolderAdded);
    window.electron.ipcRenderer.on("root-folder-removed", handleRootFolderRemoved);
    window.electron.ipcRenderer.on("root-folder-error", handleRootFolderError);
    window.electron.ipcRenderer.on("root-folders-all-removed", handleAllRootFoldersRemoved);

    return () => {
      window.electron.ipcRenderer.removeListener(
        "folder-selected",
        handleFolderSelected,
      );
      window.electron.ipcRenderer.removeListener(
        "file-list-data",
        handleFileListData,
      );
      window.electron.ipcRenderer.removeListener(
        "file-processing-status",
        handleProcessingStatus,
      );
      
      // Remove root folder event listeners
      window.electron.ipcRenderer.removeListener(
        "root-folder-added",
        handleRootFolderAdded,
      );
      window.electron.ipcRenderer.removeListener(
        "root-folder-removed",
        handleRootFolderRemoved,
      );
      window.electron.ipcRenderer.removeListener(
        "root-folder-error",
        handleRootFolderError,
      );
      window.electron.ipcRenderer.removeListener(
        "root-folders-all-removed",
        handleAllRootFoldersRemoved,
      );
    };
  }, [isElectron, sortOrder, searchTerm, allFiles]);

  const openFolder = () => {
    if (isElectron) {
      console.log("Opening folder dialog");
      setProcessingStatus({ status: "idle", message: "Select a folder..." });
      window.electron.ipcRenderer.send("open-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
  };

  // Add another root folder
  const addRootFolder = () => {
    if (isElectron) {
      console.log("Adding another root folder");
      setProcessingStatus({ status: "idle", message: "Select additional folder..." });
      window.electron.ipcRenderer.send("add-root-folder");
    } else {
      console.warn("Folder selection not available in browser");
    }
  };
  
  // Function to remove a root folder
  const removeRootFolder = useCallback((rootId: string) => {
    console.log("Removing root folder:", rootId);
    
    // First find the root to get its path for cleanup
    const rootToRemove = rootFolders.find((root: RootFolder) => root.id === rootId);
    
    if (rootToRemove) {
      // Send IPC message to main process to remove from its cache
      if (isElectron) {
        window.electron.ipcRenderer.send("remove-root-folder", rootId);
      }
      
      // Update rootFolders state
      setRootFolders((prevRoots: RootFolder[]) => {
        const updatedRoots = prevRoots.filter((root: RootFolder) => root.id !== rootId);
        // Save to localStorage
        localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify(updatedRoots));
        return updatedRoots;
      });
      
      // Remove files from this root from allFiles
      setAllFiles((prevFiles: FileData[]) => prevFiles.filter((file: FileData) => file.rootId !== rootId));
      
      // Update selected files
      setSelectedFiles((prevSelected: FileData[]) => 
        prevSelected.filter((file: FileData) => file.rootId !== rootId)
      );
      
      // Clean up expandedNodes for this root path
      setExpandedNodes((prev: Set<string>) => new Set([...prev].filter(node => !node.startsWith(`node-${rootId}`))));
      
      setProcessingStatus({
        status: "idle",
        message: `Removed folder: ${rootToRemove.name}`
      });
    }
  }, [allFiles, rootFolders, isElectron]);
  
  // Function to remove all root folders
  const removeAllRootFolders = useCallback(() => {
    console.log("Removing all root folders");
    
    // Send IPC message to main process to clear its cache
    if (isElectron) {
      window.electron.ipcRenderer.send("remove-all-root-folders");
    }
    
    // Clear all localStorage related to root folders and app state
    localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.EXPANDED_NODES, JSON.stringify(JSON.stringify(new Set())));
    
    // Consider clearing or resetting search terms if they're scoped to folders
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, "");
    setSearchTerm("");
    
    // Clear all in-memory state
    setRootFolders([]);
    setAllFiles([]);
    setSelectedFiles([]);
    setExpandedNodes(new Set());
    
    // Reset UI state
    setProcessingStatus({
      status: "idle",
      message: "All root folders removed"
    });
  }, [isElectron]);

  // Apply filters and sorting to files
  const applyFiltersAndSort = (
    files: FileData[],
    sort: string,
    filter: string,
  ) => {
    let filtered = files;

    // Apply filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = files.filter(
        (file) => {
          // Normalize paths before doing case-insensitive comparison
          const normalizedPath = normalizePath(file.path);
          
          return file.name.toLowerCase().includes(lowerFilter) ||
            normalizedPath.toLowerCase().includes(lowerFilter);
        }
      );
    }

    // Apply sort
    const sorted = sortFiles(filtered, sort);

    setDisplayedFiles(sorted);
  };

  // Update toggleFileSelection to accept FileData
  const toggleFileSelection = (file: FileData): void => {
    if (!isFileData(file)) return;
    
    const normalizedPath = normalizePath(file.path);
    setSelectedFiles((prevFiles: FileData[]) => {
      const isSelected = prevFiles.some(existingFile => 
        isFileData(existingFile) && arePathsEqual(existingFile.path, normalizedPath)
      );
      
      if (isSelected) {
        return prevFiles.filter(existingFile => 
          isFileData(existingFile) && !arePathsEqual(existingFile.path, normalizedPath)
        );
      } else {
        return [...prevFiles, file];
      }
    });
  };

  // Update toggleFolderSelection to accept RootFolder
  const toggleFolderSelection = (folder: RootFolder): void => {
    if (!isRootFolder(folder)) return;
    
    const normalizedFolderPath = normalizePath(folder.path);
    const folderRootId = folder.id;
    
    const filesInFolder = allFiles.filter((file: FileData) => {
      if (folderRootId && file.rootId !== folderRootId) {
        return false;
      }
      
      const inFolder = isSubPath(normalizedFolderPath, file.path);
      const selectable = !file.isBinary && !file.isSkipped && !file.excludedByDefault && !file.isDirectory;
      return inFolder && selectable;
    });
    
    setSelectedFiles((prevFiles: FileData[]) => {
      const allSelected = filesInFolder.every((file: FileData) => 
        prevFiles.some((p: FileData) => arePathsEqual(p.path, file.path))
      );
      
      if (allSelected) {
        return prevFiles.filter((p: FileData) => 
          !filesInFolder.some((f: FileData) => arePathsEqual(f.path, p.path))
        );
      } else {
        const newSelection = [...prevFiles];
        filesInFolder.forEach((file: FileData) => {
          if (!prevFiles.some((p: FileData) => arePathsEqual(p.path, file.path))) {
            newSelection.push(file);
          }
        });
        return newSelection;
      }
    });
  };

  // Update toggleExpanded to accept TreeNode
  const toggleExpanded = (node: TreeNode): void => {
    if (!isTreeNode(node)) return;
    
    setExpandedNodes((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(node.id)) {
        newSet.delete(node.id);
      } else {
        newSet.add(node.id);
      }
      
      // For debugging
      console.log(`Toggling node ${node.id} to ${newSet.has(node.id) ? 'expanded' : 'collapsed'}`);
      
      // If this is a root node, store its expanded state in the rootFolders state as well
      if (node.id.startsWith('node-') && rootFolders.length > 0) {
        const nodePath = node.path;
        
        // Find the matching root folder
        const updatedRootFolders = rootFolders.map((root: RootFolder) => {
          if (!isRootFolder(root)) return root;
          
          const normalizedRootPath = normalizePath(root.path);
          const normalizedNodePath = normalizePath(nodePath);
          
          // Check if this is the root node being toggled
          if (arePathsEqual(normalizedRootPath, normalizedNodePath)) {
            console.log(`Updating root folder ${root.name} expanded state to ${newSet.has(node.id)}`);
            return {
              ...root,
              isExpanded: newSet.has(node.id)
            };
          }
          return root;
        });
        
        // Update the rootFolders state and store in localStorage
        setRootFolders(updatedRootFolders);
        localStorage.setItem(STORAGE_KEYS.ROOT_FOLDERS, JSON.stringify(updatedRootFolders));
      }
      
      // Also store in localStorage for persistence
      localStorage.setItem(STORAGE_KEYS.EXPANDED_NODES, JSON.stringify(Array.from(newSet)));
      
      return newSet;
    });
  };

  // Update selectAllFiles with proper types
  const selectAllFiles = (): void => {
    setSelectedFiles((prevFiles: FileData[]) => {
      const newFiles = allFiles.filter((file: FileData) => 
        !file.isBinary && 
        !file.isSkipped && 
        !file.excludedByDefault && 
        !file.isDirectory &&
        !prevFiles.some((p: FileData) => arePathsEqual(p.path, file.path))
      );
      return [...prevFiles, ...newFiles];
    });
  };

  // Deselect all files
  const deselectAllFiles = (): void => {
    setSelectedFiles([]);
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    applyFiltersAndSort(allFiles, newSort, searchTerm);
    setSortDropdownOpen(false); // Close dropdown after selection
  };

  // Handle search change
  const handleSearchChange = (term: string): void => {
    setSearchTerm(term);
  };

  // Toggle sort dropdown
  const toggleSortDropdown = () => {
    setSortDropdownOpen(!sortDropdownOpen);
  };

  // Calculate total tokens from selected files
  const calculateTotalTokens = () => {
    return selectedFiles.reduce((total: number, path: string) => {
      // Use our safely imported arePathsEqual function
      const file = allFiles.find((f: FileData) => arePathsEqual(f.path, path));
      return total + (file ? file.tokenCount : 0);
    }, 0);
  };

  // NEW: State for user instructions
  const [userInstructions, setUserInstructions] = useState("");

  // Modify getSelectedFilesContent to organize content by root
  const getSelectedFilesContent = () => {
    // Get user instructions
    const instructionsElement = document.getElementById("user-instructions");
    const userInstructions = instructionsElement && 'value' in instructionsElement 
      ? (instructionsElement as HTMLTextAreaElement).value 
      : "";
    
    // Group selected files by root
    const rootGroups: Record<string, FileData[]> = {};
    
    selectedFiles.forEach((filePath: string) => {
      const file = allFiles.find((f: FileData) => f.path === filePath);
      if (file) {
        const rootId = file.rootId || 'default';
        if (!rootGroups[rootId]) {
          rootGroups[rootId] = [];
        }
        rootGroups[rootId].push(file);
      }
    });
    
    // Create output with root separation
    let output = userInstructions ? `${userInstructions}\n\n` : "";
    
    Object.entries(rootGroups).forEach(([rootId, files]) => {
      // Find root folder name
      let rootName = "Root Folder";
      const root = rootFolders.find((r: RootFolder) => r.id === rootId);
      if (root) {
        rootName = root.name;
      }
      
      // Add root section header
      output += `Root: ${rootName}\n`;
      
      // Add file tree for this root
      const rootFiles = allFiles.filter((f: FileData) => f.rootId === rootId);
      const rootPath = root?.path || files[0]?.rootPath;
      if (rootPath) {
        output += `File Structure:\n${generateAsciiFileTree(rootFiles, rootPath)}\n\n`;
      }
      
      // Add selected files content
      output += `Selected Files:\n`;
      files.forEach(file => {
        output += `\n---- ${file.path} ----\n${file.content}\n`;
      });
      
      output += `\n`;
    });
    
    return output;
  };

  // Sort options for the dropdown
  const sortOptions = [
    { value: "tokens-desc", label: "Tokens: High to Low" },
    { value: "tokens-asc", label: "Tokens: Low to High" },
    { value: "name-asc", label: "Name: A to Z" },
    { value: "name-desc", label: "Name: Z to A" },
  ];

  // Update sorting logic with proper type handling
  const sortFiles = (files: FileData[], order: string): FileData[] => {
    return [...files].sort((a: FileData, b: FileData) => {
      let comparison = 0;

      if (order === "name-asc" || order === "name-desc") {
        comparison = a.name.localeCompare(b.name);
      } else if (order === "tokens-asc" || order === "tokens-desc") {
        const aTokens = a.tokenCount || 0;
        const bTokens = b.tokenCount || 0;
        comparison = aTokens - bTokens;
      } else if (order === "size-asc" || order === "size-desc") {
        const aSize = a.size || 0;
        const bSize = b.size || 0;
        comparison = aSize - bSize;
      }

      return order.endsWith("-desc") ? -comparison : comparison;
    });
  };

  return (
    <ThemeProvider children={
      <div className="app-container">
        <header className="header">
          <h1>PasteMax</h1>
          <div className="header-actions">
            <ThemeToggle />
            <div className="folder-info">
              {selectedFolder ? (
                <div className="selected-folder">{selectedFolder}</div>
              ) : (
                <span>No folder selected</span>
              )}
              <div className="folder-buttons">
                <button
                  className="select-folder-btn"
                  onClick={openFolder}
                  disabled={processingStatus?.status === "processing"}
                >
                  <FolderOpen className="btn-icon" />
                  Select Folder
                </button>
                {rootFolders.length > 0 && (
                  <button
                    className="add-another-btn"
                    onClick={addRootFolder}
                    disabled={processingStatus?.status === "processing"}
                  >
                    <PlusCircle className="btn-icon" />
                    Add Another
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {processingStatus?.status === "processing" && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>{processingStatus.message}</span>
            <button
              className="cancel-btn"
              onClick={cancelDirectoryLoading}
            >
              Cancel
            </button>
          </div>
        )}

        {processingStatus?.status === "error" && (
          <div className="error-message">Error: {processingStatus.message}</div>
        )}

        {selectedFolder && (
          <div className="main-content">
            <Sidebar
              rootFolders={rootFolders}
              selectedFolder={selectedFolder}
              openFolder={openFolder}
              addRootFolder={addRootFolder}
              removeRootFolder={removeRootFolder}
              removeAllRootFolders={removeAllRootFolders}
              allFiles={allFiles}
              selectedFiles={selectedFiles}
              toggleFileSelection={toggleFileSelection}
              toggleFolderSelection={toggleFolderSelection}
              selectAllFiles={selectAllFiles}
              deselectAllFiles={deselectAllFiles}
              expandedNodes={expandedNodes}
              toggleExpanded={toggleExpanded}
              processingStatus={processingStatus}
              onExpandedNodesChange={setExpandedNodes}
              onSelectedFileChange={setSelectedFile}
              selectedFile={selectedFile}
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
            />
            <div className="content-area">
              <div className="content-header">
                <div className="content-title">Selected Files</div>
                <div className="content-actions">
                  <div className="sort-dropdown">
                    <button
                      className="sort-dropdown-button"
                      onClick={toggleSortDropdown}
                    >
                      Sort:{" "}
                      {sortOptions.find((opt) => opt.value === sortOrder)
                        ?.label || sortOrder}
                    </button>
                    {sortDropdownOpen && (
                      <div className="sort-options">
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className={`sort-option ${
                              sortOrder === option.value ? "active" : ""
                            }`}
                            onClick={() => handleSortChange(option.value)}
                          >
                            {option.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="file-stats">
                    {selectedFiles.length} files | ~
                    {calculateTotalTokens().toLocaleString()} tokens
                  </div>
                </div>
              </div>

              <FileList
                files={displayedFiles}
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection}
              />

              {/* Render the user instructions textbox */}
              <div className="user-instructions-container">
                <UserInstructions
                  instructions={userInstructions}
                  setInstructions={setUserInstructions}
                />
              </div>

              <div className="copy-button-container">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "100%", maxWidth: "400px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={includeFileTree}
                      onChange={() => setIncludeFileTree(!includeFileTree)}
                    />
                    <span>Include File Tree</span>
                  </label>
                  <CopyButton
                    text={getSelectedFilesContent()}
                    className="primary full-width"
                  >
                    <span>COPY ALL SELECTED ({selectedFiles.length} files)</span>
                  </CopyButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    } />
  );
};

export default App;