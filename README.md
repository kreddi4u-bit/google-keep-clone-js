# Keep Clone

A simple notes app inspired by Google Keep, built with plain HTML, CSS and JavaScript. No frameworks and no backend. Notes are saved in your browser with `localStorage`.

## How to run it
1. Put `index.html`, `style.css` and `script.js` together in one folder.
2. Open the folder in VS Code and install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

There is no build step, so it also deploys by dragging the folder into Netlify, or by pushing it to GitHub Pages.

## What it does
- **Create notes:** click "Take a note...", add a title and text, then click Close (or click outside the box).
- **Display notes:** a masonry grid (columns that fit notes of different heights), with Pinned and Others sections. A button in the top bar switches between grid and list view.
- **Edit notes:** click a note to open it in a popup. Changes save as you type.
- **Delete notes:** the bin icon moves a note to Trash. Notes can be restored from Trash, deleted forever, or removed all at once with "Empty Trash". Trash is cleared automatically after 7 days.
- **Archive notes:** archive a note to move it out of the way, and unarchive it from the Archive page.
- **Undo:** archiving, deleting and restoring show an Undo message.
- **Colours:** 12 background colours for every note.
- **Pinning:** pin important notes to the top.
- **Search:** filters notes as you type.
- **Dark mode:** toggle in the top bar. It follows your system setting at first and remembers your choice.
- **Drag and drop:** drag a note onto another to reorder. Pinned notes only swap with pinned notes.
- **Tooltips and popups:** every icon button has a tooltip. Editing and permanent deletes use popups.
- **Responsive:** on phones the menu becomes a slide-in drawer and the search bar shrinks to fit.
- **Keyboard:** Tab to a note and press Enter to open it. Esc closes popups and menus.

## Files
```
keep-clone/
├── index.html   page structure
├── style.css    layout, colours, dark mode, responsive rules
├── script.js    all the behaviour (saving, drawing notes, popups)
└── README.md
```

## Notes
- The font and icons load from the internet (Google Fonts and Bootstrap Icons), so the first load needs a connection.
- Drag and drop works with a mouse. Touch screens use the other features instead.
- Clearing your browser data removes your notes.