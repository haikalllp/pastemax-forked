module.exports = {
  root: true, // Indicates this is the root ESLint configuration file
  env: {
    browser: true, // Enable browser global variables
    es2020: true,  // Use ES2020 globals and features
    node: true      // Enable Node.js global variables and Node.js scoping
  },
  extends: [
    "eslint:recommended", // Use ESLint's recommended rules
    "plugin:@typescript-eslint/recommended", // Use recommended TypeScript rules
    "plugin:react-hooks/recommended", // Use recommended rules for React Hooks
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"], // Files/directories to ignore when linting
  parser: "@typescript-eslint/parser", // Specifies the ESLint parser for TypeScript
  plugins: ["react-refresh"], // Additional plugins to use
  rules: {
    "react-refresh/only-export-components": [
      "warn", // Warn instead of error
      { allowConstantExport: true }, // Allow constant exports alongside component exports
    ],
    "@typescript-eslint/no-explicit-any": "off", // Disable error for using 'any' type during development
    "@typescript-eslint/no-var-requires": "off", // Allow CommonJS require() syntax without errors
    "@typescript-eslint/no-unused-vars": "warn", // Warn about declared but unused variables
  },
  settings: {
    react: {
      version: "detect", // Automatically detect the React version being used
    },
  },
};
