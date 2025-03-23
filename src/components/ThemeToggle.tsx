import React, { useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

// Check if running in Electron environment
const isElectron = window.electron !== undefined;

// Theme toggle component with SVG icons
const ThemeToggle = (): JSX.Element => {
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
        <Sun size={16} />
        <span>Light</span>
      </button>
      <button
        className={`theme-segment ${theme === "dark" ? "active" : ""}`}
        onClick={() => setTheme("dark")}
        title="Dark Mode"
      >
        <Moon size={16} />
        <span>Dark</span>
      </button>
      <button
        className={`theme-segment ${theme === "system" ? "active" : ""}`}
        onClick={() => setTheme("system")}
        title="Use System Settings"
      >
        <Monitor size={16} />
        <span>Auto</span>
      </button>
    </div>
  );
};

export default ThemeToggle; 