import React, {
  useRef,
  useEffect,
  memo
} from "react";
import type { MouseEventHandler, ChangeEventHandler } from "react";
import { TreeItemProps, TreeNode, FileData, RootFolder, isDirectoryNode, NodeType } from "../types/FileTypes";
import { ChevronRight, File, Folder, FolderOpen, X, Trash } from "lucide-react";
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
  allFiles,
  isRootNode = false,
  removeRootFolder
}: TreeItemProps) => {
  const { id, name, path, type, level = 0, isExpanded, fileData, rootId } = node;
  const checkboxRef = useRef<HTMLInputElement>(null);

  const isSelected = type === "file" && selectedFiles.some((selectedFile) => 
    arePathsEqual(selectedFile.path, path)
  );

  // Update the indeterminate state manually whenever it changes
  useEffect(() => {
    if (checkboxRef.current && fileData) {
      const isPartiallySelected = isDirectoryPartiallySelected(fileData, selectedFiles.map(f => f.path), allFiles);
      if (checkboxRef.current.indeterminate !== isPartiallySelected) {
        checkboxRef.current.indeterminate = isPartiallySelected;
      }
    }
  }, [fileData, selectedFiles, allFiles]);

  const handleToggle: MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
    toggleExpanded(node);
  };

  const handleItemClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (isDirectoryNode(node)) {
      toggleExpanded(node);
    } else if (type === "file" && !isDisabled && fileData) {
      toggleFileSelection(fileData);
    }
  };

  const handleCheckboxChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    event.stopPropagation();
    if (type === "file" && fileData) {
      toggleFileSelection(fileData);
    } else if (isDirectoryNode(node) && fileData) {
      const rootFolder: RootFolder = {
        id: rootId || '',
        path: fileData.path,
        name: fileData.name,
        isExpanded: isExpanded || false
      };
      toggleFolderSelection(rootFolder);
    }
  };

  // Check if file is binary or otherwise unselectable
  const isDisabled = fileData ? fileData.isBinary || fileData.isSkipped : false;
  const isBinary = fileData?.isBinary || false;
  const isSkipped = fileData?.isSkipped || false;
  const isExcludedByDefault = fileData?.excludedByDefault || false;

  // Check if this is a directory containing binary files (used for styling)
  const hasBinaryFiles = isDirectoryNode(node) && allFiles && 
    allFiles.some(file => 
      file.path && 
      !file.isDirectory && 
      file.isBinary && 
      pathUtils.isSubPath(path, file.path)
    );

  // Add additional class for top-level directories (level 0)
  const isTopLevelDirectory = (type === "folder" || type === "root") && level === 0;
  
  // Handle removing a root folder
  const handleRemoveRoot: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.stopPropagation();
    if (removeRootFolder && rootId) {
      removeRootFolder(rootId);
    }
  };
  
  return (
    <div
      className={`tree-item ${type === "file" ? "file-item" : "directory-item"} ${
        isSelected ? "selected" : ""
      } ${isDisabled ? "disabled" : ""} ${isBinary ? "binary" : ""} ${
        isSkipped ? "skipped" : ""
      } ${isExcludedByDefault ? "excluded" : ""} ${
        hasBinaryFiles ? "has-binary" : ""
      } ${isTopLevelDirectory ? "top-level-directory" : ""}`}
      onClick={handleItemClick}
      style={{
        paddingLeft: `${(level) * 16}px`,
      }}
    >
      {(type === "folder" || type === "root") && (
        <div className="tree-item-toggle" onClick={handleToggle}>
          <ChevronRight
            className={`tree-item-chevron ${isExpanded ? "expanded" : ""}`}
            size={18}
          />
        </div>
      )}

      <label
        className={`tree-item-label ${isDisabled ? "disabled" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          className="tree-item-checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          disabled={isDisabled}
        />
      </label>

      <div className="tree-item-icon">
        {type === "file" ? (
          <File size={18} />
        ) : (
          isExpanded ? <FolderOpen size={18} /> : <Folder size={18} />
        )}
      </div>

      <div className="tree-item-content">
        <span className="tree-item-name">{name}</span>
        {isTopLevelDirectory && rootId && (
          <span className="tree-item-path">{path}</span>
        )}
      </div>

      {isBinary && <span className="tree-item-badge binary">Binary</span>}
      {isSkipped && <span className="tree-item-badge skipped">Skipped</span>}
      {isExcludedByDefault && (
        <span className="tree-item-badge excluded">Excluded</span>
      )}
      
      {isTopLevelDirectory && rootId && removeRootFolder && (
        <button 
          className="tree-item-remove-btn" 
          onClick={handleRemoveRoot}
          title="Remove this root folder"
        >
          <Trash size={16} />
        </button>
      )}
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