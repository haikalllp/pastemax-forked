import React, {
  useRef,
  useEffect,
  memo
} from "react";
import { TreeItemProps, TreeNode, FileData } from "../types/FileTypes";
import { ChevronRight, File, Folder } from "lucide-react";
import * as pathUtils from "../utils/pathUtils";

// Ensure we have the critical path utilities, with fallbacks if needed
const {
  normalizePath = (path: string): string => path?.replace(/\\/g, '/') || path,
  arePathsEqual = (path1: string, path2: string): boolean => {
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    return normalizePath(path1).toLowerCase() === normalizePath(path2).toLowerCase();
  },
  isSubPath = (parent: string, child: string): boolean => {
    if (!parent || !child) return false;
    const normalizedParent = normalizePath(parent).replace(/\/+$/, '') + '/';
    const normalizedChild = normalizePath(child);
    return normalizedChild.toLowerCase().startsWith(normalizedParent.toLowerCase());
  }
} = pathUtils;

/**
 * TreeItem represents a single item (file or folder) in the file tree.
 * It handles:
 * - File/folder selection with checkboxes
 * - Folder expansion/collapse
 * - Visual indicators for selection state
 * - Special cases for binary/skipped/excluded files
 */
const TreeItem = ({
  node,
  selectedFiles,
  toggleFileSelection,
  toggleFolderSelection,
  toggleExpanded,
  allFiles
}: TreeItemProps) => {
  const { id, name, path, type, level, isExpanded, fileData } = node;
  const checkboxRef = useRef(null);

  const isSelected = type === "file" && selectedFiles.some((selectedPath) => 
    arePathsEqual(selectedPath, path)
  );

  // Update the indeterminate state manually whenever it changes
  useEffect(() => {
    if (checkboxRef.current && fileData) {
      const isPartiallySelected = isDirectoryPartiallySelected(fileData, selectedFiles, allFiles);
      if (checkboxRef.current.indeterminate !== isPartiallySelected) {
        checkboxRef.current.indeterminate = isPartiallySelected;
      }
    }
  }, [fileData, selectedFiles, allFiles]);

  const handleToggle = (e: any) => {
    e.stopPropagation();
    toggleExpanded(id);
  };

  const handleItemClick = (e: any) => {
    if (type === "directory") {
      toggleExpanded(id);
    } else if (type === "file" && !isDisabled) {
      toggleFileSelection(path);
    }
  };

  const handleCheckboxChange = (e: any) => {
    e.stopPropagation();
    if (type === "file") {
      toggleFileSelection(path);
    } else if (type === "directory") {
      // Use toggleFolderSelection for all folders
      toggleFolderSelection(path, e.target.checked);
    }
  };

  // Check if file is binary or otherwise unselectable
  const isDisabled = fileData ? fileData.isBinary || fileData.isSkipped : false;

  // Check if the file is excluded by default (but still selectable)
  const isExcludedByDefault = fileData?.excludedByDefault || false;

  return (
    <div
      className={`tree-item ${isSelected ? "selected" : ""} ${
        isExcludedByDefault ? "excluded-by-default" : ""
      }`}
      style={{ marginLeft: `${level * 16}px` }}
      onClick={handleItemClick}
    >
      {/* Expand/collapse arrow for directories */}
      {type === "directory" && (
        <div
          className={`tree-item-toggle ${isExpanded ? "expanded" : ""}`}
          onClick={handleToggle}
          aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
        >
          <ChevronRight size={16} />
        </div>
      )}

      {/* Spacing for files to align with directories */}
      {type === "file" && <div className="tree-item-indent"></div>}

      {/* Selection checkbox */}
      <input
        type="checkbox"
        className="tree-item-checkbox"
        checked={type === "file" ? isSelected : (fileData ? isDirectorySelected(fileData, selectedFiles, allFiles) : false)}
        ref={checkboxRef}
        onChange={handleCheckboxChange}
        disabled={isDisabled}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Item content (icon, name, and metadata) */}
      <div className="tree-item-content">
        <div className="tree-item-icon">
          {type === "directory" ? <Folder size={16} /> : <File size={16} />}
        </div>

        <div className="tree-item-name">{name}</div>

        {/* Show token count for files that have it */}
        {fileData && fileData.tokenCount > 0 && (
          <span className="tree-item-tokens">
            (~{fileData.tokenCount.toLocaleString()})
          </span>
        )}

        {/* Show badge for unselectable files */}
        {isDisabled && fileData && (
          <span className="tree-item-badge">
            {fileData.isBinary ? "Binary" : "Skipped"}
          </span>
        )}

        {!isDisabled && isExcludedByDefault && (
          <span className="tree-item-badge excluded">Excluded</span>
        )}
      </div>
    </div>
  );
};

// These helper functions are moved outside the component to prevent recreation on each render

// Returns whether all files in this directory are selected
const isDirectorySelected = (item: FileData, selectedFiles: string[], allFiles: FileData[]): boolean => {
  // If no files are selected, return false
  if (selectedFiles.length === 0) {
    return false;
  }

  // For all folders, get all files in this folder and subfolders
  const allSelectableFiles = getAllFilesInFolder(item, allFiles);
  
  // If there are no selectable files, it can't be selected
  if (allSelectableFiles.length === 0) {
    return false;
  }
  
  // Check if all eligible files are selected
  return allSelectableFiles.every(file => selectedFiles.includes(file.path));
};

// Returns all files (not directories) in this folder and subfolders that are selectable
const getAllFilesInFolder = (item: FileData, allFiles: FileData[]): FileData[] => {
  if (!item || !item.path) {
    return [];
  }
  
  const itemPath = normalizePath(item.path);
  
  return allFiles.filter(file => {
    // Skip directories, binary files, etc.
    if (!file || !file.path || file.isDirectory || file.isBinary || file.isSkipped || file.excludedByDefault) {
      return false;
    }
    
    const filePath = normalizePath(file.path);
    
    // Check if this file is in the folder or its subfolders
    return arePathsEqual(filePath, itemPath) || isSubPath(itemPath, filePath);
  });
};

// Returns whether some but not all files in this directory are selected
const isDirectoryPartiallySelected = (item: FileData, selectedFiles: string[], allFiles: FileData[]): boolean => {
  // If no files are selected, return false
  if (selectedFiles.length === 0) {
    return false;
  }
  
  // For all folders, get all files in this folder and subfolders
  const allSelectableFiles = getAllFilesInFolder(item, allFiles);
  
  // If no selectable files, it can't be partially selected
  if (allSelectableFiles.length === 0) {
    return false;
  }
  
  // Check if any of the files are selected but not all of them
  const someSelected = allSelectableFiles.some(file => selectedFiles.includes(file.path));
  const allSelected = allSelectableFiles.every(file => selectedFiles.includes(file.path));
  
  return someSelected && !allSelected;
};

// Memo the component to prevent unnecessary re-renders
export default memo(TreeItem); 