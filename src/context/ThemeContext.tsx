import React, { createContext, useState, useEffect, useContext } from "react";

type ThemeType = "light" | "dark" | "system";

interface ThemeContextType {
  theme: ThemeType;
  currentTheme: "light" | "dark"; // The actual applied theme
  setTheme: (theme: ThemeType) => void;
}

// Create context with proper typing
const defaultThemeContext: ThemeContextType = {
  theme: "system",
  currentTheme: "light",
  setTheme: () => {},
};

const ThemeContext = createContext(defaultThemeContext);

// Check if running in Electron environment
const isElectron = window.electron !== undefined;

export const ThemeProvider = ({ children }: { children: any }) => {
  // Initialize theme from localStorage or default to "system"
  const [theme, setThemeState] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme && ["light", "dark", "system"].includes(savedTheme) 
      ? (savedTheme as ThemeType) 
      : "system";
  });
  
  const [currentTheme, setCurrentTheme] = useState("light" as "light" | "dark");

  // Function to set theme and save to localStorage
  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  // Effect to apply the correct theme based on selection or system preference
  useEffect(() => {
    const applyTheme = (themeName: "light" | "dark") => {
      setCurrentTheme(themeName);
      
      if (themeName === "dark") {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
      
      // Notify main process of theme change for DevTools sync if in Electron
      if (isElectron && window.electron) {
        window.electron.ipcRenderer.send("theme-changed", themeName);
      }
    };
    
    // Check for system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    // Apply theme based on selection or system preference
    if (theme === "system") {
      applyTheme(prefersDark ? "dark" : "light");
    } else {
      applyTheme(theme as "light" | "dark");
    }
    
    // Listen for system preference changes if in auto mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        applyTheme(e.matches ? "dark" : "light");
      }
    };
    
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}; 