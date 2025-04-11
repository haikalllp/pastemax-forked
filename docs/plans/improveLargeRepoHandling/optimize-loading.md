# DONE! [X]

# Loading Time Optimization Plan

## Current Performance Issues

1. Sequential directory processing
2. Redundant file checks
3. Suboptimal cache usage
4. Multiple file system operations per file

## Proposed Optimizations

### 1. Parallel Directory Processing

```js
// Change from sequential processing:
for (const dirent of directories) {
  // process one by one
}

// To parallel processing with controlled concurrency:
const CONCURRENT_DIRS = 4; // Based on typical CPU cores
async function processDirectoriesInBatches(directories) {
  for (let i = 0; i < directories.length; i += CONCURRENT_DIRS) {
    const batch = directories.slice(i, i + CONCURRENT_DIRS);
    await Promise.all(batch.map((dir) => processDirectory(dir)));
  }
}
```

### 2. Optimized File Processing

- Combine stats and content reading into single operation
- Move binary check before any file I/O
- Cache file metadata aggressively

```js
async function processFile(dirent, fullPath) {
  // Early binary check by extension
  if (isBinaryFile(fullPath)) {
    return createBinaryFileMetadata(dirent, fullPath);
  }

  // Check cache first
  const cacheKey = normalizePath(fullPath);
  if (fileCache.has(cacheKey)) {
    return fileCache.get(cacheKey);
  }

  // Single file operation combining stats and content
  const [stats, content] = await Promise.all([
    fs.promises.stat(fullPath),
    fs.promises.readFile(fullPath, 'utf8'),
  ]);

  return processFileContent(dirent, fullPath, stats, content);
}
```

### 3. Enhanced Caching Strategy

```js
// Add file type cache to avoid repeated extension checks
const fileTypeCache = new Map();

// Cache gitignore results at directory level
const gitignoreCache = new Map();

function cacheFileType(ext, isBinary) {
  fileTypeCache.set(ext.toLowerCase(), isBinary);
}

function isBinaryFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (fileTypeCache.has(ext)) {
    return fileTypeCache.get(ext);
  }
  const result = binaryExtensions.includes(ext);
  cacheFileType(ext, result);
  return result;
}
```

### 4. Optimized Directory Traversal

```js
async function readFilesRecursively(dir, rootDir, ignoreFilter, window, progress) {
  // Process directories in parallel with controlled concurrency
  const directories = [];
  const files = [];

  // Single readdir operation
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  // Split into files and directories
  entries.forEach((entry) => {
    (entry.isDirectory() ? directories : files).push(entry);
  });

  // Process dirs in parallel batches
  await processDirectoriesInBatches(directories);

  // Process files in parallel chunks
  const results = await processFilesInChunks(files);

  return { results, progress };
}
```

## Implementation Priority

1. Implement parallel directory processing
2. Optimize file processing with combined operations
3. Enhance caching strategy
4. Refactor directory traversal

## Expected Benefits

- Reduced I/O wait time through parallelization
- Fewer redundant file system operations
- Better memory usage through strategic caching
- Faster binary file detection

## Considerations

- Monitor memory usage with parallel operations
- Adjust concurrency based on system capabilities
- Maintain progress reporting accuracy
- Preserve cancellation capability
