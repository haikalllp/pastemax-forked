/* ============================== IMPORTS ============================== */
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import FileList from './components/FileList';
import CopyButton from './components/CopyButton';
import { FileData, IgnoreMode } from './types/FileTypes';
import { ThemeProvider } from './context/ThemeContext';
import IgnorePatternsViewer from './components/IgnorePatternsViewer';
import ThemeToggle from './components/ThemeToggle';
import ViewIgnoresButton from './components/ViewIgnoresButton';
import { useIgnorePatterns } from './hooks/useIgnorePatterns';
import UserInstructions from './components/UserInstructions';

/**
 * Import path utilities for handling file paths across different operating systems.
 * While not all utilities are used directly, they're kept for consistency and future use.
 */
import {
  generateAsciiFileTree,
  normalizePath,
  arePathsEqual,
  isSubPath,
  join,
} from './utils/pathUtils';

/**
 * Import utility functions for content formatting and language detection.
 * The contentFormatUtils module handles content assembly and applies language detection
 * via the languageUtils module internally.
 */
import { formatContentForCopying } from './utils/contentFormatUtils';

/* ============================== GLOBAL DECLARATIONS ============================== */
// Access the electron API from the window object
declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data?: any) => void;
        on: (channel: string, func: (...args: any[]) => void) => void;
        removeListener: (channel: string, func: (...args: any[]) => void) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
      };
    };
  }
}

/* ============================== CONSTANTS ============================== */
/**
 * Keys used for storing app state in localStorage.
 * Keeping them in one place makes them easier to manage and update.
 */
const STORAGE_KEYS = {
  SELECTED_FOLDER: 'pastemax-selected-folder',
  SELECTED_FILES: 'pastemax-selected-files',
  SORT_ORDER: 'pastemax-sort-order',
  SEARCH_TERM: 'pastemax-search-term',
  EXPANDED_NODES: 'pastemax-expanded-nodes',
  IGNORE_MODE: 'pastemax-ignore-mode',
  IGNORE_SETTINGS_MODIFIED: 'pastemax-ignore-settings-modified',
};

/* ============================== MAIN APP COMPONENT ============================== */
/**
 * The main App component that handles:
 * - File selection and management
 * - Folder navigation
 * - File content copying
 * - UI state management
 */
const App = (): JSX.Element => {
  /* ============================== STATE: Load initial state from localStorage ============================== */
  const savedFolder = localStorage.getItem(STORAGE_KEYS.SELECTED_FOLDER);
  const savedFiles = localStorage.getItem(STORAGE_KEYS.SELECTED_FILES);
  const savedSortOrder = localStorage.getItem(STORAGE_KEYS.SORT_ORDER);
  const savedSearchTerm = localStorage.getItem(STORAGE_KEYS.SEARCH_TERM);
  const savedIgnoreMode = localStorage.getItem(STORAGE_KEYS.IGNORE_MODE);

  /* ============================== STATE: Core App State ============================== */
  const [selectedFolder, setSelectedFolder] = useState(
    savedFolder ? normalizePath(savedFolder) : null
  );
  const isElectron = window.electron !== undefined;
  const [allFiles, setAllFiles] = useState([] as FileData[]);

  /* ============================== STATE: Ignore Patterns ============================== */
  const {
    isIgnoreViewerOpen,
    ignorePatterns,
    ignorePatternsError,
    handleViewIgnorePatterns,
    closeIgnoreViewer,
    ignoreMode,
    setIgnoreMode,
    customIgnores,
    ignoreSettingsModified,
    resetIgnoreSettingsModified,
  } = useIgnorePatterns(selectedFolder, isElectron);

  /* ============================== STATE: File Selection and Sorting ============================== */
  const [selectedFiles, setSelectedFiles] = useState(
    (savedFiles ? JSON.parse(savedFiles).map(normalizePath) : []) as string[]
  );
  const [sortOrder, setSortOrder] = useState(savedSortOrder || 'tokens-desc');
  const [searchTerm, setSearchTerm] = useState(savedSearchTerm || '');
  const [expandedNodes, setExpandedNodes] = useState({} as Record<string, boolean>);
  const [displayedFiles, setDisplayedFiles] = useState([] as FileData[]);
  const [processingStatus, setProcessingStatus] = useState({ status: 'idle', message: '' } as {
    status: 'idle' | 'processing' | 'complete' | 'error';
    message: string;
  });
  const [includeFileTree, setIncludeFileTree] = useState(false);

  /* ============================== STATE: UI Controls ============================== */
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [isSafeMode, setIsSafeMode] = useState(false);

  /* ============================== STATE: User Instructions ============================== */
  const [userInstructions, setUserInstructions] = useState('');

  // This useEffect was clearing saved data on every reload
  // It was marked as "temporary, for testing" but was preventing
  // selections from persisting after a page refresh (Ctrl+R)
  /* 
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
    localStorage.removeItem("hasLoadedInitialData");
    sessionStorage.removeItem("hasLoadedInitialData");
  }, []);
  */

  // Utility function to clear all saved state and reset the app
  const clearSavedState = useCallback(() => {
    console.time('clearSavedState');
    // Clear all localStorage items except ignore mode, custom ignores, and ignore settings modified flag
    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key !== STORAGE_KEYS.IGNORE_MODE && key !== STORAGE_KEYS.IGNORE_SETTINGS_MODIFIED) {
        localStorage.removeItem(key);
      }
    });

    // Clear any session storage items
    sessionStorage.removeItem('hasLoadedInitialData');

    // Reset all state to initial values
    setSelectedFolder(null);
    setAllFiles([]);
    setSelectedFiles([]);
    setDisplayedFiles([]);
    setSearchTerm('');
    setSortOrder('tokens-desc');
    setExpandedNodes({});
    setIncludeFileTree(false);
    setProcessingStatus({ status: 'idle', message: 'All saved data cleared' });

    // Also cancel any ongoing directory loading and clear main process caches
    if (isElectron) {
      window.electron.ipcRenderer.send('cancel-directory-loading');
      window.electron.ipcRenderer.send('clear-main-cache');
    }

    console.log('All saved state cleared');

    // Reload the application window
    console.timeEnd('clearSavedState');
    window.location.reload();
  }, [isElectron]); // Added isElectron dependency

  /* ============================== EFFECTS ============================== */

  // Load expanded nodes state from localStorage
  useEffect(() => {
    const savedExpandedNodes = localStorage.getItem(STORAGE_KEYS.EXPANDED_NODES);
    if (savedExpandedNodes) {
      try {
        setExpandedNodes(JSON.parse(savedExpandedNodes));
      } catch (error) {
        console.error('Error parsing saved expanded nodes:', error);
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
    localStorage.setItem(STORAGE_KEYS.SELECTED_FILES, JSON.stringify(selectedFiles));
  }, [selectedFiles]);

  // Persist sort order when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SORT_ORDER, sortOrder);
  }, [sortOrder]);

  // Persist search term when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm);
  }, [searchTerm]);

  // Persist ignore mode when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.IGNORE_MODE, ignoreMode);
  }, [ignoreMode]);

  // Add this new useEffect for safe mode detection
  useEffect(() => {
    if (!isElectron) return;

    const handleStartupMode = (mode: { safeMode: boolean }) => {
      setIsSafeMode(mode.safeMode);

      // If we're in safe mode, don't auto-load the previously selected folder
      if (mode.safeMode) {
        console.log('Starting in safe mode - not loading saved folder');
        localStorage.removeItem('hasLoadedInitialData');
        localStorage.removeItem(STORAGE_KEYS.SELECTED_FOLDER);
      }
    };

    window.electron.ipcRenderer.on('startup-mode', handleStartupMode);

    return () => {
      window.electron.ipcRenderer.removeListener('startup-mode', handleStartupMode);
    };
  }, [isElectron]);

  // Modify the existing useEffect for loading initial data
  useEffect(() => {
    // Prevent this hook from running if not in Electron, no folder selected, in safe mode, or already processing
    if (!isElectron || !selectedFolder || isSafeMode || processingStatus.status === 'processing')
      return;

    // Always reload the folder data when the component mounts (after page refresh)
    // We want to ensure the exact same state is restored, including all selected files
    console.log('Loading saved folder on startup:', selectedFolder);
    setProcessingStatus({
      status: 'processing',
      message: 'Loading files from previously selected folder...',
    });
    // Request file list from the main process
    console.log('[useEffect Load] Sending request-file-list:', {
      folderPath: selectedFolder,
      ignoreMode,
      customIgnores,
      ignoreSettingsModified,
    });
    window.electron.ipcRenderer.send('request-file-list', {
      folderPath: selectedFolder,
      ignoreMode,
      customIgnores,
      ignoreSettingsModified,
    });

    // We intentionally don't set any session flags because we want this to run
    // on every refresh to ensure state is fully restored
  }, [isElectron, selectedFolder, isSafeMode]);

  // Listen for folder selection from main process
  useEffect(() => {
    if (!isElectron) {
      console.warn('Not running in Electron environment');
      return;
    }

    const handleFolderSelected = (folderPath: string) => {
      // Check if folderPath is valid string
      if (typeof folderPath !== 'string') {
        console.error('Invalid folder path received:', folderPath);
        setProcessingStatus({
          status: 'error',
          message: 'Invalid folder path received',
        });
        return;
      }

      // Prevent redundant processing if the same folder is selected and already loaded/loading
      if (
        arePathsEqual(folderPath, selectedFolder) &&
        (allFiles.length > 0 || processingStatus.status === 'processing')
      ) {
        console.log('Folder already selected and loaded/loading, skipping request:', folderPath);
        return;
      }

      const normalizedFolderPath = normalizePath(folderPath); // Normalize before setting
      console.log('Folder selected:', normalizedFolderPath);
      // Set processing status *before* setting the folder to prevent useEffect duplicate request
      setProcessingStatus({
        status: 'processing',
        message: 'Requesting file list...',
      });
      setSelectedFolder(normalizedFolderPath); // Set normalized path
      // Reset selections when a *new* folder is selected
      const currentFolder = selectedFolder; // Capture the current folder value locally
      if (!arePathsEqual(normalizedFolderPath, currentFolder)) {
        // Compare with the captured value
        setSelectedFiles([]);
      }
      console.log('[handleFolderSelected] Sending request-file-list:', {
        folderPath,
        ignoreMode,
        customIgnores,
        ignoreSettingsModified,
      });
      window.electron.ipcRenderer.send('request-file-list', {
        folderPath,
        ignoreMode,
        customIgnores,
        ignoreSettingsModified,
      });
      resetIgnoreSettingsModified();
    };

    const handleFileListData = (files: FileData[]) => {
      console.log('Received file list data:', files.length, 'files');
      // Set the files, but let the separate useEffect handle filtering/sorting
      setAllFiles(files);
      setProcessingStatus({
        status: 'complete',
        message: `Loaded ${files.length} files`,
      });

      // Preserve selected files after reload
      if (selectedFiles.length > 0) {
        console.log('Preserving', selectedFiles.length, 'file selections from before reload');

        // Validate that selected files still exist in the newly loaded files
        // and remove any that don't (they might have been deleted)
        const validSelectedFiles = selectedFiles.filter((selectedPath: string) =>
          files.some((file) => arePathsEqual(file.path, selectedPath))
        );

        if (validSelectedFiles.length !== selectedFiles.length) {
          console.log(
            'Removed',
            selectedFiles.length - validSelectedFiles.length,
            'invalid selections'
          );
          setSelectedFiles(validSelectedFiles);
        }
      } else {
        // If no files were selected, auto-select non-binary files
        console.log('No existing selections, selecting all eligible files');
        const selectablePaths = files
          .filter((file: FileData) => !file.isBinary && !file.isSkipped && !file.excludedByDefault)
          .map((file: FileData) => file.path);

        setSelectedFiles(selectablePaths);
      }
    };

    const handleProcessingStatus = (status: {
      status: 'idle' | 'processing' | 'complete' | 'error';
      message: string;
    }) => {
      console.log('Processing status:', status);
      setProcessingStatus(status);
    };

    window.electron.ipcRenderer.on('folder-selected', handleFolderSelected);
    window.electron.ipcRenderer.on('file-list-data', handleFileListData);
    window.electron.ipcRenderer.on('file-processing-status', handleProcessingStatus);

    return () => {
      window.electron.ipcRenderer.removeListener('folder-selected', handleFolderSelected);
      window.electron.ipcRenderer.removeListener('file-list-data', handleFileListData);
      window.electron.ipcRenderer.removeListener('file-processing-status', handleProcessingStatus);
    };
  }, [isElectron, selectedFolder, allFiles, processingStatus]); // Added dependencies to ensure up-to-date values

  // Apply filters and sort whenever relevant state changes
  useEffect(() => {
    applyFiltersAndSort(allFiles, sortOrder, searchTerm);
  }, [allFiles, sortOrder, searchTerm]); // Added allFiles dependency

  /* ============================== HANDLERS & UTILITIES ============================== */

  // Add a function to cancel directory loading
  const cancelDirectoryLoading = useCallback(() => {
    if (isElectron) {
      window.electron.ipcRenderer.send('cancel-directory-loading');
      setProcessingStatus({
        status: 'idle',
        message: 'Directory loading cancelled',
      });
    }
  }, [isElectron]);

  const openFolder = () => {
    if (isElectron) {
      console.log('Opening folder dialog');
      setProcessingStatus({ status: 'idle', message: 'Select a folder...' });
      window.electron.ipcRenderer.send('open-folder');
    } else {
      console.warn('Folder selection not available in browser');
    }
  };

  // Apply filters and sorting to files
  const applyFiltersAndSort = useCallback(
    (files: FileData[], sort: string, filter: string) => {
      let filtered = files;

      // Apply filter
      if (filter) {
        const lowerFilter = filter.toLowerCase();
        filtered = files.filter(
          (file) =>
            file.name.toLowerCase().includes(lowerFilter) ||
            file.path.toLowerCase().includes(lowerFilter)
        );
      }

      // Apply sort
      const [sortKey, sortDir] = sort.split('-');
      const sorted = [...filtered].sort((a, b) => {
        let comparison = 0;

        if (sortKey === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortKey === 'tokens') {
          comparison = a.tokenCount - b.tokenCount;
        } else if (sortKey === 'size') {
          comparison = a.size - b.size;
        }

        return sortDir === 'asc' ? comparison : -comparison;
      });

      setDisplayedFiles(sorted);
    },
    [setDisplayedFiles]
  );

  // Listen for live file changes from main process
  useEffect(() => {
    if (!isElectron) return;

    const handleFileAdded = (newFile: FileData) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('<<< IPC RECEIVED: file-added >>>', newFile);
      }
      setAllFiles((prevFiles: FileData[]) => {
        // Avoid duplicates
        if (prevFiles.some((f: FileData) => arePathsEqual(f.path, newFile.path))) {
          console.log('[State Update] File already exists, ignoring:', newFile.path);
          return prevFiles;
        }
        const updatedFiles = [...prevFiles, newFile];
        applyFiltersAndSort(updatedFiles, sortOrder, searchTerm);
        return updatedFiles;
      });
      // Optionally auto-select the new file if it meets criteria
      if (!newFile.isBinary && !newFile.isSkipped && !newFile.excludedByDefault) {
        setSelectedFiles((prev: string[]) => [...prev, normalizePath(newFile.path)]);
      }
    };

    const handleFileUpdated = (updatedFile: FileData) => {
      console.log('<<< IPC RECEIVED: file-updated >>>', updatedFile);
      setAllFiles((prevFiles: FileData[]) => {
        const updatedFiles = prevFiles.map((file: FileData) =>
          arePathsEqual(file.path, updatedFile.path) ? updatedFile : file
        );
        applyFiltersAndSort(updatedFiles, sortOrder, searchTerm);
        return updatedFiles;
      });
    };

    const handleFileRemoved = (filePath: string) => {
      console.log('<<< IPC RECEIVED: file-removed >>>', filePath);
      const normalizedPath = normalizePath(filePath);
      setAllFiles((prevFiles: FileData[]) => {
        const updatedFiles = prevFiles.filter(
          (file: FileData) => !arePathsEqual(file.path, normalizedPath)
        );
        applyFiltersAndSort(updatedFiles, sortOrder, searchTerm);
        return updatedFiles;
      });
      setSelectedFiles((prevSelected: string[]) =>
        prevSelected.filter((path: string) => !arePathsEqual(path, normalizedPath))
      );
    };

    window.electron.ipcRenderer.on('file-added', handleFileAdded);
    window.electron.ipcRenderer.on('file-updated', handleFileUpdated);
    window.electron.ipcRenderer.on('file-removed', handleFileRemoved);

    return () => {
      window.electron.ipcRenderer.removeListener('file-added', handleFileAdded);
      window.electron.ipcRenderer.removeListener('file-updated', handleFileUpdated);
      window.electron.ipcRenderer.removeListener('file-removed', handleFileRemoved);
    };
  }, [isElectron, sortOrder, searchTerm, applyFiltersAndSort]);

  // Toggle file selection
  const toggleFileSelection = (filePath: string) => {
    // Normalize the incoming file path
    const normalizedPath = normalizePath(filePath);

    setSelectedFiles((prev: string[]) => {
      // Check if the file is already selected using case-sensitive/insensitive comparison as appropriate
      const isSelected = prev.some((path) => arePathsEqual(path, normalizedPath));

      if (isSelected) {
        // Remove the file from selected files
        return prev.filter((path: string) => !arePathsEqual(path, normalizedPath));
      } else {
        // Add the file to selected files
        return [...prev, normalizedPath];
      }
    });
  };

  // Toggle folder selection (select/deselect all files in folder)
  const toggleFolderSelection = (folderPath: string, isSelected: boolean) => {
    console.log('toggleFolderSelection called with:', { folderPath, isSelected });

    // Normalize the folder path for cross-platform compatibility
    const normalizedFolderPath = normalizePath(folderPath);
    console.log('Normalized folder path:', normalizedFolderPath);

    // Function to check if a file is in the given folder or its subfolders
    const isFileInFolder = (filePath: string, folderPath: string): boolean => {
      // Ensure paths are normalized with consistent slashes
      let normalizedFilePath = normalizePath(filePath);
      let normalizedFolderPath = normalizePath(folderPath);

      // Add leading slash to absolute paths if missing (common on macOS)
      if (!normalizedFilePath.startsWith('/') && !normalizedFilePath.match(/^[a-z]:/i)) {
        normalizedFilePath = '/' + normalizedFilePath;
      }

      if (!normalizedFolderPath.startsWith('/') && !normalizedFolderPath.match(/^[a-z]:/i)) {
        normalizedFolderPath = '/' + normalizedFolderPath;
      }

      // A file is in the folder if:
      // 1. The paths are equal (exact match)
      // 2. The file path is a subpath of the folder
      const isMatch =
        arePathsEqual(normalizedFilePath, normalizedFolderPath) ||
        isSubPath(normalizedFolderPath, normalizedFilePath);

      if (isMatch) {
        console.log(`File ${normalizedFilePath} is in folder ${normalizedFolderPath}`);
      }

      return isMatch;
    };

    // Filter all files to get only those in this folder (and subfolders) that are selectable
    const filesInFolder = allFiles.filter((file: FileData) => {
      const inFolder = isFileInFolder(file.path, normalizedFolderPath);
      const selectable = !file.isBinary && !file.isSkipped && !file.excludedByDefault;
      return selectable && inFolder;
    });

    console.log('Found', filesInFolder.length, 'selectable files in folder');

    // If no selectable files were found, do nothing
    if (filesInFolder.length === 0) {
      console.log('No selectable files found in folder, nothing to do');
      return;
    }

    // Extract just the paths from the files and normalize them
    const folderFilePaths = filesInFolder.map((file: FileData) => normalizePath(file.path));
    console.log('File paths in folder:', folderFilePaths);

    if (isSelected) {
      // Adding files - create a new Set with all existing + new files
      setSelectedFiles((prev: string[]) => {
        const existingSelection = new Set(prev.map(normalizePath));
        folderFilePaths.forEach((path: string) => existingSelection.add(path));
        const newSelection = Array.from(existingSelection);
        console.log(
          `Added ${folderFilePaths.length} files to selection, total now: ${newSelection.length}`
        );
        return newSelection;
      });
    } else {
      // Removing files - filter out any file that's in our folder
      setSelectedFiles((prev: string[]) => {
        const newSelection = prev.filter(
          (path: string) => !isFileInFolder(path, normalizedFolderPath)
        );
        console.log(
          `Removed ${prev.length - newSelection.length} files from selection, total now: ${newSelection.length}`
        );
        return newSelection;
      });
    }
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortOrder(newSort);
    // applyFiltersAndSort(allFiles, newSort, searchTerm); // Let the useEffect handle this
    setSortDropdownOpen(false); // Close dropdown after selection
  };

  // Handle search change
  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    // applyFiltersAndSort(allFiles, sortOrder, newSearch); // Let the useEffect handle this
  };

  // Toggle sort dropdown
  const toggleSortDropdown = () => {
    setSortDropdownOpen(!sortDropdownOpen);
  };

  // Calculate total tokens from selected files
  const calculateTotalTokens = () => {
    // Ensure paths are normalized before summing tokens
    const normalizedSelectedPaths = selectedFiles.map(normalizePath);
    return normalizedSelectedPaths.reduce((total: number, selectedPath: string) => {
      // Use arePathsEqual for comparison
      const file = allFiles.find((f: FileData) => arePathsEqual(f.path, selectedPath));
      return total + (file ? file.tokenCount : 0);
    }, 0);
  };

  /**
   * State for storing user instructions
   * This text will be appended at the end of all copied content
   * to provide context or special notes to recipients
   */

  /**
   * Assembles the final content for copying by using the utility function
   * @returns {string} The concatenated content ready for copying
   */
  const getSelectedFilesContent = () => {
    return formatContentForCopying({
      files: allFiles,
      selectedFiles,
      sortOrder,
      includeFileTree,
      selectedFolder,
      userInstructions,
    });
  };

  // Handle select all files
  const selectAllFiles = () => {
    console.time('selectAllFiles');
    try {
      const selectablePaths = displayedFiles
        .filter((file: FileData) => !file.isBinary && !file.isSkipped)
        .map((file: FileData) => normalizePath(file.path)); // Normalize paths here

      setSelectedFiles((prev: string[]) => {
        const normalizedPrev = prev.map(normalizePath); // Normalize existing selection
        const newSelection = [...normalizedPrev];
        selectablePaths.forEach((pathToAdd: string) => {
          // Use arePathsEqual for checking existence
          if (!newSelection.some((existingPath) => arePathsEqual(existingPath, pathToAdd))) {
            newSelection.push(pathToAdd);
          }
        });
        return newSelection;
      });
    } finally {
      console.timeEnd('selectAllFiles');
    }
  };

  // Handle deselect all files
  const deselectAllFiles = () => {
    const displayedPathsToDeselect = displayedFiles.map((file: FileData) =>
      normalizePath(file.path)
    ); // Normalize paths to deselect
    setSelectedFiles((prev: string[]) => {
      const normalizedPrev = prev.map(normalizePath); // Normalize existing selection
      // Use arePathsEqual for filtering
      return normalizedPrev.filter(
        (selectedPath: string) =>
          !displayedPathsToDeselect.some(
            (deselectPath: string) => arePathsEqual(selectedPath, deselectPath) // Add type annotation
          )
      );
    });
  };

  // Sort options for the dropdown
  const sortOptions = [
    { value: 'tokens-desc', label: 'Tokens: High to Low' },
    { value: 'tokens-asc', label: 'Tokens: Low to High' },
    { value: 'name-asc', label: 'Name: A to Z' },
    { value: 'name-desc', label: 'Name: Z to A' },
  ];

  // Handle expand/collapse state changes
  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((prev: Record<string, boolean>) => {
      const newState = {
        ...prev,
        [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId],
      };

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.EXPANDED_NODES, JSON.stringify(newState));

      return newState;
    });
  };

  /* ===================================================================== */
  /* ============================== RENDER =============================== */
  /* ===================================================================== */
  // Main JSX rendering

  return (
    <ThemeProvider
      children={
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
                <button
                  className="select-folder-btn"
                  onClick={openFolder}
                  disabled={processingStatus.status === 'processing'}
                >
                  Select Folder
                </button>
                <button
                  className="clear-data-btn"
                  onClick={clearSavedState}
                  title="Clear all saved data and start fresh"
                >
                  Clear All
                </button>
                <ViewIgnoresButton onClick={handleViewIgnorePatterns} />
              </div>
            </div>
          </header>

          {processingStatus.status === 'processing' && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>{processingStatus.message}</span>
              <button className="cancel-btn" onClick={cancelDirectoryLoading}>
                Cancel
              </button>
            </div>
          )}

          {processingStatus.status === 'error' && (
            <div className="error-message">Error: {processingStatus.message}</div>
          )}

          {selectedFolder && (
            <div className="main-content">
              <Sidebar
                selectedFolder={selectedFolder}
                allFiles={allFiles}
                selectedFiles={selectedFiles}
                toggleFileSelection={toggleFileSelection}
                toggleFolderSelection={toggleFolderSelection}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                selectAllFiles={selectAllFiles}
                deselectAllFiles={deselectAllFiles}
                expandedNodes={expandedNodes}
                toggleExpanded={toggleExpanded}
              />
              <div className="content-area">
                <div className="content-header">
                  <div className="content-title">Selected Files</div>
                  <div className="content-actions">
                    <div className="file-stats">
                      {selectedFiles.length} files | ~{calculateTotalTokens().toLocaleString()}{' '}
                      tokens
                    </div>
                    <div className="sort-dropdown">
                      <button className="sort-dropdown-button" onClick={toggleSortDropdown}>
                        Sort:{' '}
                        {sortOptions.find((opt) => opt.value === sortOrder)?.label || sortOrder}
                      </button>
                      {sortDropdownOpen && (
                        <div className="sort-options">
                          {sortOptions.map((option) => (
                            <div
                              key={option.value}
                              className={`sort-option ${
                                sortOrder === option.value ? 'active' : ''
                              }`}
                              onClick={() => handleSortChange(option.value)}
                            >
                              {option.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <FileList
                  files={displayedFiles}
                  selectedFiles={selectedFiles}
                  toggleFileSelection={toggleFileSelection}
                />

                {/*
                 * User Instructions Component
                 * Positioned after the file list and before the copy button
                 * Allows users to enter supplementary text that will be
                 * included at the end of the copied content
                 */}
                <UserInstructions
                  instructions={userInstructions}
                  setInstructions={setUserInstructions}
                />

                <div className="copy-button-container">
                  <div className="copy-button-wrapper">
                    <label className="file-tree-option">
                      <input
                        type="checkbox"
                        checked={includeFileTree}
                        onChange={() => setIncludeFileTree(!includeFileTree)}
                      />
                      <span>Include File Tree</span>
                    </label>
                    {/*
                     * Copy Button
                     * When clicked, this will copy all selected files along with:
                     * - File tree (if enabled via the checkbox)
                     * - User instructions (if any were entered)
                     */}
                    <CopyButton
                      text={getSelectedFilesContent()}
                      className="primary full-width copy-button-main"
                    >
                      <span className="copy-button-text">
                        COPY ALL SELECTED ({selectedFiles.length} files)
                      </span>
                    </CopyButton>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Ignore Patterns Viewer Modal */}
          <IgnorePatternsViewer
            isOpen={isIgnoreViewerOpen}
            onClose={closeIgnoreViewer}
            patterns={ignorePatterns}
            error={ignorePatternsError}
            selectedFolder={selectedFolder}
            isElectron={isElectron}
          />
        </div>
      }
    />
  );
};

export default App;
