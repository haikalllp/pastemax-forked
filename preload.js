// Preload script
const { contextBridge, ipcRenderer } = require("electron");

// Helper function to ensure data is serializable
function ensureSerializable(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitive types directly
  if (typeof data !== "object") {
    return data;
  }

  // For arrays, map each item
  if (Array.isArray(data)) {
    return data.map(ensureSerializable);
  }

  // For objects, create a new object with serializable properties
  const result = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      // Skip functions or symbols which are not serializable
      if (typeof data[key] === "function" || typeof data[key] === "symbol") {
        continue;
      }
      // Recursively process nested objects
      result[key] = ensureSerializable(data[key]);
    }
  }
  return result;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => {
    // List of valid channels for sending messages to main process
    const validChannels = ["open-folder", "request-file-list", "debug-file-selection", "cancel-directory-loading", "theme-changed", "add-root-folder", "remove-root-folder", "remove-all-root-folders"];
    if (validChannels.includes(channel)) {
      // Ensure data is serializable before sending
      const serializedData = ensureSerializable(data);
      ipcRenderer.send(channel, serializedData);
    }
  },
  receive: (channel, func) => {
    // List of valid channels for receiving messages from main process
    const validReceiveChannels = ["folder-selected", "file-list-data", "file-processing-status", "app-error", "startup-mode", "root-folder-added", "root-folder-removed", "root-folder-error", "root-folders-all-removed"];
    if (validReceiveChannels.includes(channel)) {
      // Remove any existing listeners to avoid duplicates
      ipcRenderer.removeAllListeners(channel);
      // Add the new listener
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  // For backward compatibility (but still ensure serialization)
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = ["open-folder", "request-file-list", "debug-file-selection", "cancel-directory-loading", "theme-changed", "add-root-folder", "remove-root-folder"];
      if (validChannels.includes(channel)) {
        const serializedData = ensureSerializable(data);
        ipcRenderer.send(channel, serializedData);
      }
    },
    on: (channel, func) => {
      const wrapper = (event, ...args) => {
        try {
          // Don't pass the event object to the callback, only pass the serialized args
          const serializedArgs = args.map(ensureSerializable);
          func(...serializedArgs); // Only pass the serialized args, not the event
        } catch (err) {
          console.error(`Error in IPC handler for channel ${channel}:`, err);
        }
      };
      ipcRenderer.on(channel, wrapper);
      // Store the wrapper function for removal later
      return wrapper;
    },
    removeListener: (channel, func) => {
      // List of valid channels for receiving messages from main process
      const validReceiveChannels = ["folder-selected", "file-list-data", "file-processing-status", "app-error", "startup-mode", "root-folder-added", "root-folder-removed", "root-folder-error", "root-folders-all-removed"];
      if (validReceiveChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    },
  },
});
