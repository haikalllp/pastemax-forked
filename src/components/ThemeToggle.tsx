import React, { useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

// Check if running in Electron environment
const isElectron = window.electron !== undefined;

// Simple text-based theme toggle component
const ThemeToggle = () => {
  const { theme, currentTheme, setTheme } = useTheme();
  
  // Send initial theme to main process when component mounts
  useEffect(() => {
    if (isElectron && currentTheme) {
      console.log(`Sending initial theme to main process: ${currentTheme}`);
      if (window.electron) {
        window.electron.ipcRenderer.send("theme-changed", currentTheme);
      }
    }
  }, [currentTheme]);
  
  return (
    <div className="theme-segmented-control">
      <button
        className={`theme-segment ${theme === "light" ? "active" : ""}`}
        onClick={() => setTheme("light")}
        title="Light Mode"
      >
        {/* Unicode sun symbol instead of SVG */}
        <span aria-hidden="true">☀️</span>
        <span>Light</span>
      </button>
      <button
        className={`theme-segment ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        title="Dark Mode"
      >
        {/* Unicode moon symbol instead of SVG */}
        <span aria-hidden="true">🌙</span>
        <span>Dark</span>
      </button>
      <button
        className={`theme-segment ${theme === "system" ? "active" : ""}`}
        onClick={() => setTheme("system")}
        title="Use System Settings"
      >
        {/* Unicode monitor symbol instead of SVG */}
        <span aria-hidden="true">🖥️</span>
        <span>Auto</span>
      </button>
    </div>
  );
};

export default ThemeToggle; 