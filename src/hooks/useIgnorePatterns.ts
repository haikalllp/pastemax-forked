import { useState } from 'react';

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
 * @returns Various states and handlers for ignore patterns functionality
 */
export function useIgnorePatterns(selectedFolder: string | null, isElectron: boolean) {
  const [isIgnoreViewerOpen, setIsIgnoreViewerOpen] = useState(false);
  const [ignorePatterns, setIgnorePatterns] = useState(null as IgnorePatternsState | null);
  const [ignorePatternsError, setIgnorePatternsError] = useState(null as string | null);

  /**
   * Fetches and displays ignore patterns for the selected folder
   * Handles both success and error states
   */
  const handleViewIgnorePatterns = async () => {
    if (!selectedFolder || !isElectron) return;
    setIgnorePatterns(null);
    setIgnorePatternsError(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('get-ignore-patterns', selectedFolder);
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
    }
  };

  return {
    isIgnoreViewerOpen,
    ignorePatterns,
    ignorePatternsError,
    handleViewIgnorePatterns,
    closeIgnoreViewer: () => setIsIgnoreViewerOpen(false)
  };
}