import React from "react";
import { FileListProps, FileData } from "../types/FileTypes";
import FileCard from "./FileCard";
import * as pathUtils from "../utils/pathUtils";

// Ensure we have the critical path utilities, with fallbacks if needed
const {
  arePathsEqual = (path1: string, path2: string): boolean => {
    if (!path1 && !path2) return true;
    if (!path1 || !path2) return false;
    return path1.replace(/\\/g, '/').toLowerCase() === path2.replace(/\\/g, '/').toLowerCase();
  }
} = pathUtils;

const FileList = ({
  files,
  selectedFiles,
  toggleFileSelection,
}: FileListProps) => {
  // Only show files that are in the selectedFiles array and not binary/skipped/excluded/directories
  const displayableFiles = files.filter(
    (file: FileData) =>
      selectedFiles.some(selectedPath => arePathsEqual(selectedPath, file.path)) && 
      !file.isBinary && 
      !file.isSkipped &&
      !file.excludedByDefault &&
      !file.isDirectory
  );

  return (
    <div className="file-list-container">
      {displayableFiles.length > 0 ? (
        <div className="file-list">
          {displayableFiles.map((file: FileData) => (
            <FileCard
              key={file.path}
              file={file}
              isSelected={true} // All displayed files are selected
              toggleSelection={toggleFileSelection}
            />
          ))}
        </div>
      ) : (
        <div className="file-list-empty">
          {files.length > 0
            ? "No files selected. Select files from the sidebar."
            : "Select a folder to view files"}
        </div>
      )}
    </div>
  );
};

export default FileList;
