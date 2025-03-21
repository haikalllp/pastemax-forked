**Overall Application Structure**

The application window is divided into two main vertical sections:

1.  **Left-Hand Menu (File Tree):** A collapsible, scrollable tree view displaying the directory structure of the selected workspace.
2.  **Main Details Screen (Selected Files):** Displays the files selected by the user from the file tree, with options for sorting, viewing token counts, and removing files.

**1. Left-Hand Menu (File Tree)**

- **Appearance:**

  - The tree view should visually resemble the file tree in the provided screenshot. This includes:
    - Indentation to represent nested folders.
    - Disclosure triangles (or chevrons) to expand/collapse folders. The triangles should point right when collapsed and down when expanded.
    - Folder icons for directories.
    - File icons for files. The file icons can be generic or, ideally, specific to the file type (e.g., a JavaScript icon for `.js` files).
    - Font: Use a system-standard monospaced font (e.g., Consolas, Menlo, Monaco) for consistent code-related display.
    - Font Size: 13px (adjust as needed for legibility on different platforms).
    - Line Height: 20px (adjust for comfortable spacing).
    - Colors:
      - Background: `#F5F7FA` (light gray, as in the screenshot).
      - Text: `#2C3E50` (dark gray, for filenames and folder names).
      - Selected Item Background: `#E1E8F0` (a slightly darker gray, to indicate selection).
      - Hover Background: `#E8ECEF` (a very light gray, for hover effect).
      - Disclosure Triangle: `#718096` (medium gray).
      - Folder Icon: `#718096` (medium gray).
      - File Icon: `#718096` (medium gray).
  - A vertical scrollbar should appear when the content exceeds the height of the menu. The scrollbar should match the system's default style.

- **Functionality:**
  - **Expansion/Collapse:** Clicking a disclosure triangle expands or collapses the corresponding folder.
  - **File Selection:**
    - Each file and folder in the tree has a checkbox to its left.
    - Clicking a file's checkbox toggles its selection state (checked/unchecked).
    - Clicking a _folder's_ checkbox selects/deselects _all_ files within that folder (and its subfolders, recursively).
    - The checkbox state should be visually clear (e.g., a filled square for checked, an empty square for unchecked). Use standard checkbox styling.
    - The selection state of files in the tree _must_ be synchronized with the main details screen. Adding or removing a file from the selection in either location updates the other.
  - **Search Bar:**
    - Located at the top of the left-hand menu, above the file tree.
    - Appearance:
      - A text input field with a magnifying glass icon on the left.
      - Placeholder text: "Search files".
      - Background: White.
      - Border: 1px solid `#CED4DA` (light gray).
      - Rounded corners (small radius, e.g., 4px).
    - Functionality:
      - As the user types, the file tree is filtered _in real-time_ to show only files (and their parent folders) whose names (or paths) contain the search term (case-insensitive).
      - Folders that contain matching files should remain expanded, even if the folder name itself doesn't match.
      - Clearing the search input restores the full, unfiltered tree.
      - The search should _not_ affect the "Selected Files" list directly, only the visibility of files in the tree. If a selected file is hidden by the search, it remains selected.
  - **Top Bar Buttons:**
    - The following buttons are located in a horizontal bar at the very top of the left-hand menu, above the search bar:
      - **Collapse All:** An icon representing collapsing (e.g., a double upward-pointing chevron). Clicking this collapses all folders in the tree.
      - **Sort:** Clicking this opens the sort options (detailed in Main Details Screen section).
      - **Filters:** (This button is present in the screenshot but its functionality is unclear. For _this_ application, we will _not_ implement additional filtering beyond the search bar. This button can be omitted for now.)
      - **Clear:** An icon representing clearing (e.g., an "X"). Clicking this deselects _all_ currently selected files (both in the tree and the main screen).
      - **Refresh:** A circular arrow icon. Clicking this reloads the file list from the selected folder, updating the tree and selected files. This is useful if the folder's contents change externally.
    - Button Styling:
      - Icons: Use simple, clear icons (e.g., from a library like Font Awesome or similar).
      - Background: Transparent (no background color).
      - Hover Background: `#E8ECEF` (light gray, same as file hover).
      - Icon Color: `#718096` (medium gray).
      - Spacing: Add some padding around the icons (e.g., 5px).

**2. Main Details Screen (Selected Files)**

- **Appearance:**
  - Background: White.
  - Font: Same monospaced font and size as the file tree.
  - This section displays the _selected_ files in a single, vertically scrollable list. _Crucially, this is different from the folder-grouped display in the provided screenshot._
  - **File Representation:**
    - Each selected file is represented as a horizontal "card".
    - Card Layout (from left to right):
      - File Icon: The same file icon used in the tree view.
      - File Name: The file's name.
      - Token Count: Displayed as `~[number] tokens`. Use a slightly muted text color (e.g., `#718096`) for the token count.
      - Percentage of Total Tokens: (Optional, but good for UX) Displayed as `([percentage]%)`. Calculate this percentage relative to the total tokens of _all_ selected files. Use the same muted text color as the token count.
    - Card Styling:
      - Background: White.
      - Border: A subtle bottom border (1px solid `#E8ECEF`) to separate cards.
      - Padding: Add padding (e.g., 8px top/bottom, 12px left/right) for visual spacing.
      - Hover Effect: On hover, change the background to `#F8F9FA` (very light gray) and display a "remove" icon (an "X") on the far right side of the card.
      - **Remove Icon:** Displayed on the right side of the card on hover.
        - Icon: A small "X" icon.
        - Color: `#718096` (medium gray).
        - Clicking this icon removes the file from the selection (both on this screen and in the file tree).
  - **Top Bar (Above File List):**
    - **"Selected Files" Title:** A heading indicating the section's purpose. Font size: 16px, font weight: bold.
    - **Sort Dropdown:**
      - A dropdown menu to control the sorting of the selected files.
      - Appearance:
        - Default text: "Sort".
        - A downward-pointing chevron icon to indicate a dropdown.
        - Background: White.
        - Border: 1px solid `#CED4DA`.
        - Rounded corners (small radius).
      - Options:
        - Name (A-Z)
        - Name (Z-A)
        - Tokens (Low-High)
        - Tokens (High-Low)
        - Size (Low-High)
        - Size (High-Low)
      - **Group by Folder Toggle:**
        - A toggle switch (or a checkbox labeled "Group by Folder") to enable/disable grouping the selected files by their parent folder.
        - **Default State:** _Off_ (files are displayed in a single, unified list).
        - **When Enabled:**
          - Files are grouped by their immediate parent folder.
          - Each group has a header displaying the folder name.
          - The sort order (from the Sort dropdown) is applied _within_ each group.
          - Groups themselves are sorted alphabetically by folder name.
    - **Total Counts:**
      - Display the following information to the right of the Sort dropdown:
        - Number of selected files: `[number] files`
        - Total estimated tokens: `~[number] tokens`
        - Total file APIs: This is in the screenshot, but it's not part of our current functionality. Omit this.

**Key UX Principles:**

- **Consistency:** Maintain consistent styling (colors, fonts, spacing) throughout the application.
- **Clarity:** Use clear labels and icons.
- **Feedback:** Provide visual feedback for user actions (e.g., hover effects, selection changes, copy-to-clipboard success).
- **Efficiency:** Minimize the number of clicks required to perform common tasks.
- **Discoverability:** Make it easy for users to find and understand the application's features.

This detailed specification should provide the offshore developer with everything they need to create a pixel-perfect implementation of the file tree and selected files view, incorporating the requested changes to the file organization on the main screen. Remember to emphasize the importance of synchronization between the file tree and the selected files list.
