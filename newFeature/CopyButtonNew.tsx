import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { CopyButtonProps } from '../types/FileTypes';

const CopyButton = ({ onCopy, isDisabled, copyStatus }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (isDisabled) return;

    try {
      await onCopy();
      setCopied(true);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      type="button"
      className={`primary full-width copy-button-main ${copied ? 'copied' : ''} ${isDisabled ? 'disabled' : ''}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      disabled={isDisabled}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span className="copy-button-text">COPY ALL SELECTED ({isDisabled ? '0' : '...'} files)</span>
    </button>
  );
};

export default CopyButton;
