export interface FileData {
  path: string;
  name: string;
  content?: string;
  tokenCount?: number;
  size?: number;
  isBinary: boolean;
  isSkipped: boolean;
  excludedByDefault: boolean;
  isDirectory: boolean;
  rootId?: string;
  rootPath?: string;
  error?: string;
  fileType?: string;
}

export interface RootFolder {
  id: string;
  path: string;
  name: string;
  isExpanded: boolean;
}

// Add node type constants
export type NodeType = 'file' | 'folder' | 'root';

export interface TreeNode {
  id: string;
  path: string;
  name: string;
  type: NodeType;
  level?: number;
  children?: TreeNode[];
  isExpanded?: boolean;
  fileData?: FileData;
  rootId?: string;  // Add rootId to TreeNode
}

export interface SidebarProps {
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
  selectAllFiles: () => void;
  deselectAllFiles: () => void;
  expandedNodes: Set<string>;
  toggleExpanded: (node: TreeNode) => void;
  processingStatus: { status: string; message: string } | null;
  onExpandedNodesChange: (nodes: Set<string>) => void;
  onSelectedFileChange: (file: FileData | null) => void;
  selectedFile: FileData | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export interface FileListProps {
  files: FileData[];
  selectedFiles: FileData[];
  toggleFileSelection: (file: FileData) => void;
}

export interface FileCardProps {
  file: FileData;
  isSelected: boolean;
  toggleSelection: (file: FileData) => void;
}

export interface TreeItemProps {
  node: TreeNode;
  selectedFiles: FileData[];
  toggleFileSelection: (file: FileData) => void;
  toggleFolderSelection: (folder: RootFolder) => void;
  toggleExpanded: (node: TreeNode) => void;
  allFiles: FileData[];
  isRootNode?: boolean;
  removeRootFolder?: (rootId: string) => void;
}

export interface SortOption {
  value: string;
  label: string;
}

export interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export interface CopyButtonProps {
  onCopy: () => void;
  isDisabled: boolean;
  copyStatus: boolean;
}

// Add type guards
export function isFileData(obj: any): obj is FileData {
  return obj && typeof obj === 'object' && 
    typeof obj.path === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.isBinary === 'boolean' &&
    typeof obj.isSkipped === 'boolean' &&
    typeof obj.excludedByDefault === 'boolean' &&
    typeof obj.isDirectory === 'boolean';
}

export function isRootFolder(obj: any): obj is RootFolder {
  return obj && typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.isExpanded === 'boolean';
}

export function isTreeNode(obj: any): obj is TreeNode {
  return obj && typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.name === 'string' &&
    (obj.type === 'file' || obj.type === 'folder' || obj.type === 'root') &&
    (obj.children === undefined || Array.isArray(obj.children)) &&
    (obj.rootId === undefined || typeof obj.rootId === 'string');
}

// Add utility function to check if a node is a directory
export function isDirectoryNode(node: TreeNode): boolean {
  return node.type === 'folder' || node.type === 'root';
}
