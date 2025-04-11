import React, { useState, useMemo, useEffect } from 'react';
import { useIgnorePatterns } from '../hooks/useIgnorePatterns';
import ToggleSwitch from './ToggleSwitch';

interface IgnorePatternsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  patterns?: {
    default?: string[];
    excludedFiles?: string[];
    global?: string[];
    // Expect the Map structure (serialized as object) now
    gitignoreMap?: { [key: string]: string[] };
  };
  error?: string;
  selectedFolder: string | null;
  isElectron: boolean;
}

interface PatternSectionProps {
  title: string;
  subtitle?: string;
  patterns: string[];
  searchTerm: string;
}

/**
 * Format and sort patterns for display
 * @param patterns Array of pattern strings
 * @returns Sorted and formatted array of patterns
 */
const formatPatterns = (patterns: string[]): string[] => {
  return patterns
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
};

/**
 * Format the pattern count with proper pluralization
 */
const formatPatternCount = (count: number, type: string): string => {
  return `${count} ${type}${count === 1 ? '' : 's'}`;
};

/**
 * Renders a section of patterns with filtering
 */
const PatternSection = ({
  title,
  subtitle,
  patterns,
  searchTerm,
}: PatternSectionProps): JSX.Element | null => {
  const filteredPatterns = useMemo(() => {
    // Ensure patterns is always an array, even if undefined initially
    const normalized = formatPatterns(patterns || []);

    if (!searchTerm) return normalized;

    const searchLower = searchTerm.toLowerCase();
    return normalized.filter((pattern) => pattern.toLowerCase().includes(searchLower));
  }, [patterns, searchTerm]);

  // Don't render section if no patterns match search
  if (filteredPatterns.length === 0 && searchTerm) return null;

  return (
    <section className="ignore-patterns-section">
      <div className="section-header">
        <h3>{title}</h3>
        <span className="pattern-count">
          {formatPatternCount(filteredPatterns.length, 'pattern')}
        </span>
      </div>
      {subtitle && <div className="section-subtitle">{subtitle}</div>}
      {filteredPatterns.length > 0 ? (
        <pre className="pattern-list">{filteredPatterns.join('\n')}</pre>
      ) : (
        <p className="no-patterns">
          No patterns found, Please reload (Ctrl + r / ⌘ + r) to use this mode
        </p>
      )}
    </section>
  );
};

export const IgnorePatternsViewer = ({
  isOpen,
  onClose,
  patterns,
  error,
  selectedFolder,
  isElectron,
}: IgnorePatternsViewerProps): JSX.Element | null => {
  const [searchTerm, setSearchTerm] = useState('');
  const { ignoreMode, setIgnoreMode, customIgnores, setCustomIgnores } = useIgnorePatterns(
    selectedFolder,
    isElectron
  );
  const [customIgnoreInput, setCustomIgnoreInput] = useState('');

  // Log the received patterns prop for debugging
  useEffect(() => {
    if (isOpen) {
      console.log(
        'DEBUG: IgnorePatternsViewer received patterns:',
        JSON.stringify(patterns, null, 2)
      );
      // Only log gitignoreMap entries when in automatic mode
      if (ignoreMode === 'automatic' && patterns?.gitignoreMap) {
        console.log('DEBUG: gitignoreMap entries:', Object.keys(patterns.gitignoreMap).length);
      }
    }
  }, [isOpen, patterns, ignoreMode]);

  // Reset search when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleClose = onClose;

  if (!isOpen) return null;

  return (
    <div className="ignore-patterns-container">
      {/* Overlay div that closes the modal when clicked */}
      <div className="ignore-patterns-modal-overlay" onClick={handleClose}></div>

      {/* Modal dialog - stopPropagation prevents clicks inside from closing */}
      <div className="ignore-patterns-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ignore-patterns-header">
          <h2>Applied Ignore Patterns</h2>
          <button onClick={handleClose} className="close-button" aria-label="Close">
            ×
          </button>
        </div>
        <div className="ignore-patterns-content">
          {/* Mode Toggle Switch - Always visible */}
          <div className="ignore-patterns-mode-toggle">
            <ToggleSwitch
              isOn={ignoreMode === 'global'}
              onToggle={() => setIgnoreMode(ignoreMode === 'automatic' ? 'global' : 'automatic')}
            />
          </div>

          {/* Mode explanation */}
          <div className="ignore-mode-explanation">
            <div className={`mode-description ${ignoreMode === 'automatic' ? 'active' : ''}`}>
              <h4>Automatic Mode</h4>
              <p>
                Uses project's existing <code>.gitignore</code> files to determine what to ignore.
                More accurate for large repositories and monorepos, but may be slower to process.
              </p>
            </div>
            <div className={`mode-description ${ignoreMode === 'global' ? 'active' : ''}`}>
              <h4>Global Mode</h4>
              <p>
                Uses a static global ignore pattern system. Allows for additional Custom Ignore
                Patterns. Faster processing with less precision.
              </p>
            </div>
          </div>
          {/* Conditional content based on folder selection */}
          {!selectedFolder ? (
            <div className="ignore-patterns-empty-state">
              <p>Select a folder to view ignore patterns.</p>
            </div>
          ) : error ? (
            <div className="ignore-patterns-error">{error}</div>
          ) : patterns ? (
            <React.Fragment>
              <div className="ignore-patterns-search">
                <input
                  type="text"
                  placeholder="Search patterns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                  style={{
                    border: '2px solid #0e6098', // Changed to black color
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                  }}
                  autoFocus
                />
              </div>

              <div className="ignore-patterns-sections">
                {/* Global Exclusions section - Only visible in global mode */}
                {ignoreMode === 'global' && selectedFolder && (
                  <PatternSection
                    title="Global Exclusions"
                    subtitle="From excluded-files.js"
                    patterns={patterns?.global || []}
                    searchTerm={searchTerm}
                  />
                )}

                {/* Custom ignores section - Only visible in global mode */}
                {ignoreMode === 'global' && selectedFolder && (
                  <div className="custom-global-ignores">
                    <h4
                      tabIndex={0}
                      role="button"
                      aria-label="Custom Global Ignores section"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Add interaction functionality here if needed
                        }
                      }}
                    >
                      Custom Global Ignores
                    </h4>

                    <div className="custom-ignore-input">
                      <input
                        type="text"
                        placeholder="Enter additional ignore pattern"
                        value={customIgnoreInput}
                        onChange={(e) => setCustomIgnoreInput(e.target.value)}
                        className="search-input"
                        style={{
                          border: '2px solid var(--color-primary)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          transition: 'all 0.3s ease',
                        }}
                      />
                      <button
                        className="add-pattern-button"
                        onClick={() => {
                          const trimmed = customIgnoreInput.trim();
                          if (trimmed) {
                            setCustomIgnores([...customIgnores, trimmed]);
                            setCustomIgnoreInput('');
                          }
                        }}
                      >
                        Add Pattern
                      </button>
                    </div>

                    {customIgnores.length > 0 && (
                      <div className="custom-ignore-list">
                        <ul>
                          {customIgnores.map((pattern: string, index: number) => (
                            <li key={index}>
                              {pattern}
                              <button
                                className="remove-pattern-button"
                                onClick={() => {
                                  setCustomIgnores(
                                    customIgnores.filter((_: string, i: number) => i !== index)
                                  );
                                }}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Render gitignore patterns from the Map */}
                {ignoreMode === 'automatic' &&
                  (patterns.gitignoreMap ? (
                    Object.entries(patterns.gitignoreMap)
                      .sort(([a], [b]) => {
                        if (a === '.') return -1;
                        if (b === '.') return 1;
                        return a.localeCompare(b);
                      })
                      .map(([dirPath, dirPatterns]) => (
                        <PatternSection
                          key={dirPath}
                          title={`Repository Rules (${dirPath === '.' ? './' : dirPath})`}
                          subtitle={`From ${dirPath === '.' ? './' : dirPath}/.gitignore`}
                          patterns={dirPatterns}
                          searchTerm={searchTerm}
                        />
                      ))
                  ) : (
                    <PatternSection
                      title="Repository Rules (No Rules Found)"
                      subtitle="No .gitignore rules found in the repository"
                      patterns={[]}
                      searchTerm={searchTerm}
                    />
                  ))}
              </div>
            </React.Fragment>
          ) : (
            <div className="ignore-patterns-loading">Loading patterns...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IgnorePatternsViewer;
