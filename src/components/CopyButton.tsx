import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  children?: JSX.Element | string;
}

const CopyButton = ({ text, className = '', children }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Add inline styles to ensure no focus outline appears
  const buttonStyle = {
    outline: 'none',
  };

  return (
    <button
      type="button"
      className={`${className}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      style={buttonStyle}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {children}
    </button>
  );
};

export default CopyButton;
