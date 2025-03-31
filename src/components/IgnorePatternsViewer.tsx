import React, { useState, useMemo, useEffect } from 'react';

interface IgnorePatternsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  patterns?: {
    default?: string[];
    excludedFiles?: string[];
    // Expect the Map structure (serialized as object) now
    gitignoreMap?: { [key: string]: string[] }; 
  };
  error?: string;
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
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0);
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
  searchTerm
}: PatternSectionProps): JSX.Element | null => {
  const filteredPatterns = useMemo(() => {
    // Ensure patterns is always an array, even if undefined initially
    const normalized = formatPatterns(patterns || []);
 
    if (!searchTerm) return normalized;
    
    const searchLower = searchTerm.toLowerCase();
    return normalized.filter(pattern => 
      pattern.toLowerCase().includes(searchLower)
    );
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
        <pre className="pattern-list">
          {filteredPatterns.join('\n')}
        </pre>
      ) : (
        <p className="no-patterns">No patterns found</p>
      )}
    </section>
  );
};

export const IgnorePatternsViewer = ({
  isOpen,
  onClose,
  patterns,
  error
}: IgnorePatternsViewerProps): JSX.Element | null => {
  const [searchTerm, setSearchTerm] = useState('');

  // Log the received patterns prop for debugging
  useEffect(() => {
    if (isOpen) {
      console.log("DEBUG: IgnorePatternsViewer received patterns:", JSON.stringify(patterns, null, 2));
      console.log("DEBUG: gitignoreMap entries:", patterns?.gitignoreMap ? Object.keys(patterns.gitignoreMap).length : 0);
    }
  }, [isOpen, patterns]);

  // Reset search when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ignore-patterns-modal-overlay">
      <div className="ignore-patterns-modal">
        <div className="ignore-patterns-header">
          <h2>Applied Ignore Patterns</h2>
          <button onClick={onClose} className="close-button" aria-label="Close">×</button>
        </div>
        <div className="ignore-patterns-content">
          {error ? (
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
                  autoFocus
                />
              </div>
              <div className="ignore-patterns-sections">
                <PatternSection
                  title="Default Patterns"
                  patterns={patterns.default || []} // Provide default empty array
                  searchTerm={searchTerm}
                />
                <PatternSection
                  title="Global Exclusions"
                  subtitle="From excluded-files.js"
                  patterns={patterns.excludedFiles || []} // Provide default empty array
                  searchTerm={searchTerm}
                />
                {/* Render gitignore patterns from the Map */}
                {patterns.gitignoreMap ? (
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
                )}
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
