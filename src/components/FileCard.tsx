import React from 'react';
import { FileCardProps } from '../types/FileTypes';
import { Plus, X, FileText } from 'lucide-react';
import CopyButton from './CopyButton';

interface FileCardComponentProps {
  file: {
    name: string;
    path: string;
    tokenCount: number;
    content: string;
  };
  isSelected: boolean;
  toggleSelection: (path: string) => void;
}

const FileCard = ({ file, isSelected, toggleSelection }: FileCardComponentProps) => {
  const { name, path: filePath, tokenCount } = file;

  // Format token count for display
  const formattedTokens = tokenCount.toLocaleString();

  return (
    <div className={`file-card ${isSelected ? 'selected' : ''}`}>
      <div className="file-card-header">
        <div className="file-card-icon">
          <FileText size={16} />
        </div>
        <div className="file-card-name monospace">{name}</div>
      </div>
      <div className="file-card-info">
        <div className="file-card-tokens">~{formattedTokens} tokens</div>
      </div>

      <div className="file-card-actions">
        <button
          className="file-card-action"
          onClick={() => toggleSelection(filePath)}
          title={isSelected ? 'Remove from selection' : 'Add to selection'}
        >
          {isSelected ? <X size={16} /> : <Plus size={16} />}
        </button>
        <CopyButton text={file.content} className="file-card-action">
          {''}
        </CopyButton>
      </div>
    </div>
  );
};

export default FileCard;
