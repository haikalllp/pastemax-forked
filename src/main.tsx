/**
 * Application entry point that sets up React with strict mode.
 * This ensures better development-time checks and warnings.
 */

// Import shared path utilities first to ensure global registration
import "../shared/path-utils.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
