# Known Issues (FIXED 2023-10-23)

## FIXED ✅

- Auto gitignore works
- Global gitignore works
- Changing between them works
- Properly using them works

## Current Issues 🚧

- Automatic mode/global mode not working properly in recursive loading
- Does not work when loading multiple repos and folders
- Does not work when loading multiple repos and folders with different ignore settings
- Default patterns are not consistently applied in automatic mode nor global mode

## More Issues

- first of all cache should be cleared @/src/App.tsx when, ignore mode is changed and a custom pattern is changed.
- so next reload it will use the correct actual pattern and new cache.
- 'Clear All' should actually clear cache of ignores.
- also it seems after doing a clear all and then reselecting a folder it seems to always fallback to 'Automatic' mode? even though the debug log says other wise.
- now finally the most breaking change seems to be that, default pattern does not seem to and used on when loading a folder with deep repo, such as mono repo with multiple ignore to actually work?
- also default pattern should be array constant in @/main.js , excludedFiles array are only used for global ignores @/excluded-files.js .
- default pattern should be used on both mode, this is because default pattern is to just make it soo that these default files/folder are just automatically skipped/ignored in loading soo it will make load soo much faster.
- also the default pattern should be used in the global mode as well, because it is just a global ignore for all repos and folders.
- global should be able to handle custom patterns that is added, everytime custom is edited and updated should update cache already stated in App.tsx.
