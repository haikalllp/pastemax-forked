import React from 'react';

interface ViewIgnoreButtonProps {
  onClick: () => void;
  disabled?: boolean; // Made optional
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
  disabled = false, // Default to false if not provided
}: ViewIgnoreButtonProps) {
  return (
    <button
      onClick={onClick}
      title="View Applied Ignore Rules"
      disabled={disabled}
      className="view-ignores-btn"
    >
      Ignore Filters
    </button>
  );
}

export default ViewIgnoreButton;
