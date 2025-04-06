import { useState, useEffect } from 'react';

interface IgnorePatternsState {
  default: string[];
  excludedFiles: string[];
  gitignore: string[];
}

/**
 * Hook for managing ignore patterns functionality
 * Handles state and operations related to viewing git ignore patterns
 *
 * @param selectedFolder - The currently selected folder path
 * @param isElectron - Whether the app is running in Electron environment
 * @returns {Object} An object containing:
 *   - isIgnoreViewerOpen: Boolean state for viewer visibility
 *   - ignorePatterns: Current ignore patterns state
 *   - ignorePatternsError: Error message if pattern fetch failed
 *   - handleViewIgnorePatterns: Function to fetch patterns
 *   - closeIgnoreViewer: Function to close the viewer
 *   - ignoreMode: Current ignore mode ('automatic' or 'global')
 *     - 'automatic': Combines .gitignore files with default excludes
 *     - 'global': Uses only default excludes and custom ignores
 *   - setIgnoreMode: Function to update ignore mode
 *   - customIgnores: Array of additional ignore patterns
 *     - Only used when ignoreMode is 'global'
 *   - setCustomIgnores: Function to update custom ignores
 *
 * @description The hook automatically includes customIgnores in the IPC call
 * when mode is 'global', but ignores them in 'automatic' mode.
 */
export function useIgnorePatterns(selectedFolder: string | null, isElectron: boolean) {
  const [isIgnoreViewerOpen, setIsIgnoreViewerOpen] = useState(false);
  const [ignorePatterns, setIgnorePatterns] = useState(null as IgnorePatternsState | null);
  const [ignorePatternsError, setIgnorePatternsError] = useState(null as string | null);
  /**
   * Current ignore mode state ('automatic' or 'global')
   * - 'automatic': Scans for .gitignore files and combines with default excludes
   * - 'global': Uses only default excludes and custom ignores
   */
  const [ignoreMode, _setIgnoreMode] = useState('automatic' as 'automatic' | 'global', () => {
    const savedMode = typeof window !== 'undefined' ? localStorage.getItem('ignoreMode') : null;
    return savedMode === 'global' ? 'global' : 'automatic';
  });

  const setIgnoreMode = (mode: 'automatic' | 'global') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ignoreMode', mode);
    }
    _setIgnoreMode(mode);
    console.log(`Ignore mode changed to ${mode}`);
  };

  /**
   * Custom ignore patterns that will be included when mode is 'global'
   * These patterns are passed to the IPC handler when fetching ignore patterns
   */
  const [customIgnores, _setCustomIgnores] = useState(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const saved = localStorage.getItem('pastemax-custom-ignores');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse custom ignores from localStorage:", error);
      return [];
    }
  });

  // Effect to save customIgnores to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pastemax-custom-ignores', JSON.stringify(customIgnores));
      } catch (error) {
        console.error("Failed to save custom ignores to localStorage:", error);
      }
    }
  }, [customIgnores]);

  // Wrapper function to update state and potentially trigger side effects if needed later
  const setCustomIgnores = (newIgnores: string[] | ((prevIgnores: string[]) => string[])) => {
    _setCustomIgnores(newIgnores);
  };

  /**
   * Fetches and displays ignore patterns for the selected folder
   * Handles both success and error states
   */
  const handleViewIgnorePatterns = async () => {
    console.time('handleViewIgnorePatterns');
    if (!selectedFolder || !isElectron) return;
    setIgnorePatterns(null);
    setIgnorePatternsError(null);

    console.log(`Fetching ignore patterns for ${selectedFolder} in ${ignoreMode} mode`);
    console.log('Custom ignores:', customIgnores);

    try {
      const result = await window.electron.ipcRenderer.invoke('get-ignore-patterns', {
        folderPath: selectedFolder,
        mode: ignoreMode,
        customIgnores: ignoreMode === 'global' ? customIgnores : []
      });
      console.log('Received ignore patterns:', result.patterns ? 'success' : 'error', result);
      if (result.error) {
        setIgnorePatternsError(result.error);
      } else {
        setIgnorePatterns(result.patterns);
      }
    } catch (err) {
      console.error("Error invoking get-ignore-patterns:", err);
      setIgnorePatternsError(err instanceof Error ? err.message : "Failed to fetch ignore patterns.");
    } finally {
      setIsIgnoreViewerOpen(true);
      console.timeEnd('handleViewIgnorePatterns');
    }
  };

  return {
    isIgnoreViewerOpen,
    ignorePatterns,
    ignorePatternsError,
    handleViewIgnorePatterns,
    closeIgnoreViewer: () => setIsIgnoreViewerOpen(false),
    ignoreMode,
    setIgnoreMode,
    customIgnores,
    setCustomIgnores
  };
}