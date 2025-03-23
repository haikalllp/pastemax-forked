// List of common files to exclude by default
// Users can still manually select these files if needed
// Paths include glob patterns and are normalized for cross-platform compatibility

/**
 * Helper function to normalize a path for cross-platform compatibility
 * Ensures consistent forward slashes and proper pattern formatting
 */
function normalizePath(path) {
  // Convert backslashes to forward slashes for cross-platform compatibility
  return path.replace(/\\/g, '/');
}

// Basic categories for organization
const CATEGORIES = {
  NODE: 'Node/NPM/Yarn',
  JS: 'JavaScript/TypeScript',
  PYTHON: 'Python',
  GO: 'Go',
  JAVA: 'Java/JVM',
  RUBY: 'Ruby',
  PHP: 'PHP',
  RUST: 'Rust',
  DOTNET: '.NET',
  IDE: 'IDE and editors',
  BUILD: 'Build output',
  LOGS: 'Logs',
  DB: 'Databases',
  ENV: 'Environment/Secrets',
  DOCKER: 'Docker',
  VCS: 'Version Control'
};

// Core patterns organized by category
const CORE_PATTERNS = {
  // Version control
  [CATEGORIES.VCS]: [
    ".git/**",
    ".github/**",
    ".gitlab/**",
    ".svn/**",
    ".hg/**",
    ".bzr/**",
    "CVS/**"
  ],
  
  // Node/NPM/Yarn patterns
  [CATEGORIES.NODE]: [
    "node_modules/**",
    "package-lock.json",
    "yarn.lock",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    "pnpm-lock.yaml",
    ".npmrc",
    ".yarnrc",
    ".nvmrc"
  ],

  // JavaScript/TypeScript patterns
  [CATEGORIES.JS]: [
    ".eslintrc*",
    ".prettierrc*",
    "tsconfig*.json",
    "*.d.ts",
    "*.min.js",
    "*.map"
  ],

  // Python patterns
  [CATEGORIES.PYTHON]: [
    "__pycache__/**",
    "*.pyc",
    "*.pyo",
    "*.pyd",
    ".pytest_cache/**",
    ".coverage",
    ".python-version",
    "venv/**",
    ".venv/**",
    "*.egg-info/**",
    "pip-log.txt",
    "pip-delete-this-directory.txt"
  ],

  // Go patterns
  [CATEGORIES.GO]: [
    "go.sum",
    "go.mod",
    // vendor is shared with PHP
  ],

  // Java patterns
  [CATEGORIES.JAVA]: [
    "*.class",
    "*.jar",
    "target/**",
    ".gradle/**"
  ],

  // Ruby patterns
  [CATEGORIES.RUBY]: [
    "Gemfile.lock",
    ".bundle/**"
  ],

  // PHP patterns
  [CATEGORIES.PHP]: [
    "composer.lock",
    "vendor/**"
  ],

  // Rust patterns
  [CATEGORIES.RUST]: [
    "Cargo.lock",
    "target/**"  // Shared with Java
  ],

  // .NET patterns
  [CATEGORIES.DOTNET]: [
    "bin/**",
    "obj/**",
    "*.suo",
    "*.user"
  ],

  // IDE and editor patterns
  [CATEGORIES.IDE]: [
    ".idea/**",
    ".vscode/**",
    "*.swp",
    "*.swo",
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini"
  ],

  // Build output patterns
  [CATEGORIES.BUILD]: [
    "dist/**",
    "build/**",
    "out/**",
    ".next/**",
    ".nuxt/**"
  ],

  // Log patterns
  [CATEGORIES.LOGS]: [
    "logs/**",
    "*.log"
  ],

  // Database patterns
  [CATEGORIES.DB]: [
    "*.sqlite",
    "*.db"
  ],

  // Environment and secrets patterns
  [CATEGORIES.ENV]: [
    ".env*",
    ".aws/**",
    "*.pem",
    "*.key"
  ],

  // Docker patterns
  [CATEGORIES.DOCKER]: [
    "docker-compose.override.yml"
  ]
};

// Binary file extensions
const BINARY_EXTENSIONS = [
  // Images
  ".svg",
  ".jpg", ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".ico", ".icns",
  ".webp",

  // Documents
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",

  // Archives
  ".zip",
  ".tar.gz", ".tgz",
  ".rar"
];

// Common directories that should be skipped during traversal for performance
// These are used in readFilesRecursively to avoid traversing these directories
const SKIP_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'vendor',
  '.gradle',
  'target',
  'android/app/build',
  'ios/build',
  '__pycache__',
  'venv',
  '.venv',
  '.bundle',
  '.cache',
  'coverage',
  '.idea',
  '.vscode'
];

// Create regex patterns for quick checks
// These patterns are used for fast exclusion and are case-insensitive for cross-platform compatibility
const EXCLUDED_REGEX_PATTERNS = [
  // Node modules
  /node_modules\//i,
  // Package lock files
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  // Build output
  /dist\//i,
  /build\//i,
  // Minified files
  /\.min\.(js|css)$/i,
  // Map files
  /\.map$/i,
  // Version control
  /\.git\//i,
  // Log files
  /\.log$/i,
];

// Flatten all patterns from CORE_PATTERNS for excludedFiles
const ALL_PATTERNS = Object.values(CORE_PATTERNS).reduce((acc, patterns) => {
  return acc.concat(patterns);
}, []);

// Export a unified interface
module.exports = {
  // Primary excluded files array - all patterns from all categories
  excludedFiles: ALL_PATTERNS,

  // Binary file extensions
  binaryExtensions: BINARY_EXTENSIONS,
  
  // Directories to skip for traversal performance
  skipDirectories: SKIP_DIRECTORIES,
  
  // Default ignore patterns (same as excludedFiles, but kept for backward compatibility)
  defaultIgnorePatterns: ALL_PATTERNS,
  
  // Regex patterns for quick exclusion checks
  excludedRegexPatterns: EXCLUDED_REGEX_PATTERNS,

  // Export categories and patterns separately for potential selective usage
  ignoreCategories: CATEGORIES,
  patternsByCategory: CORE_PATTERNS,
  
  // Export helper function for path normalization
  normalizePath
};
