import React from 'react';

interface ViewIgnoreButtonProps {
  onClick: () => void;
  disabled: boolean;
}

/**
 * Button component for viewing ignore patterns
 * Displays a button that triggers the ignore patterns viewer
 * Used in the header section alongside folder selection controls
 * 
 * @component
 * @example
 * ```tsx
 * <ViewIgnoreButton
 *   onClick={handleViewPatterns}
 *   disabled={!hasSelectedFolder}
 * />
 * ```
 */
function ViewIgnoreButton({ 
  onClick, 
  disabled 
}: ViewIgnoreButtonProps) {
  return (
    <button
      onClick={onClick}
      title="View Applied Ignore Rules"
      disabled={disabled}
      className="view-ignores-btn"
    >
      View Ignores
    </button>
  );
}

export default ViewIgnoreButton;