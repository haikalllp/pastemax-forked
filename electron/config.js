const os = require('os');
const path = require('path');
const { excludedFiles, binaryExtensions } = require('./excluded-files');

/**
 * Maximum time (in ms) allowed for loading a directory before timing out
 * @type {number}
 */
const MAX_DIRECTORY_LOAD_TIME = 300000; // 5 minutes timeout for large repositories

/**
 * Maximum file size (in bytes) that will be processed
 * @type {number}
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max file size

/**
 * Number of directories to process concurrently, based on CPU count
 * @type {number}
 */
const CONCURRENT_DIRS = os.cpus().length * 2; // Increase based on CPU count for better parallelism

/**
 * Interval (in ms) for sending status updates to the renderer process
 * @type {number}
 */
const STATUS_UPDATE_INTERVAL = 200; // ms

/**
 * Default ignore patterns that should always be applied
 * @type {string[]}
 */
const DEFAULT_PATTERNS = [
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  'vendor',
  'dist',
  'build',
  'out',
  '.next',
  'target',
  'bin',
  'Debug',
  'Release',
  'x64',
  'x86',
  '.output',
  '*.min.js',
  '*.min.css',
  '*.bundle.js',
  '*.compiled.*',
  '*.generated.*',
  '.cache',
  '.parcel-cache',
  '.webpack',
  '.turbo',
  '.idea',
  '.vscode',
  '.vs',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  '*.asar',
  'release-builds',
];

module.exports = {
  MAX_DIRECTORY_LOAD_TIME,
  MAX_FILE_SIZE,
  CONCURRENT_DIRS,
  STATUS_UPDATE_INTERVAL,
  DEFAULT_PATTERNS,
  excludedFiles,
  binaryExtensions
};