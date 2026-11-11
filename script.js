/* ============================================================
   KEEP CLONE, contents
   ------------------------------------------------------------
   1. Storage ............ saving and loading notes and preferences
   2. Helpers ............ small functions used everywhere
   3. Colours ............ the colour list and the colour picker popup
   4. Notes list ......... drawing the pinned notes and the other notes
   5. Note actions ....... pin, colour, archive, trash, restore, delete
   6. Create box ......... the "take a note" box at the top
   7. Edit popup ......... opening and editing a note
   8. Confirm popup ...... the "are you sure" popup for permanent deletes
   9. Top bar and menu ... search, grid or list, dark mode, side menu
  10. Drag and drop ...... reordering notes
  11. Messages ........... the undo message at the bottom
  12. Start-up ........... first draw
   ============================================================ */


/* ============================================================
   1. STORAGE
   ============================================================ */
const NOTES_KEY = "keep_notes_v1";
const PREFS_KEY = "keep_prefs_v1";
const TRASH_DAYS = 7;

const defaultPrefs = {
  theme: "system",          // light | dark | system
  layout: "grid",           // grid | list
  sidebarCollapsed: false,
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Could not read preferences.", e);
  }
  return { ...defaultPrefs };
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Could not save preferences.", e);
  }
}

/* A few starter notes so the page is not empty the first time */
function starterNotes() {
  const now = Date.now();
  const hour = 3600000;
  const make = (i, fields) => ({
    id: "n" + (now - i),
    title: "",
    body: "",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: now - i * hour,
    updatedAt: now - i * hour,
    ...fields,
  });
  return [
    make(1, { title: "Welcome to Keep", color: "yellow", pinned: true,
      body: "Click a note to edit it.\nUse the icons on a note to pin, colour, archive or delete it.\nDrag notes to reorder them." }),
    make(2, { title: "Project deadlines", color: "blue", pinned: true,
      body: "Portfolio: submit Friday\nTwitter clone: add videos\nKeep clone: deploy to Netlify" }),
    make(3, { title: "Shopping list", color: "green",
      body: "Milk\nEggs\nBread\nCoffee\nBananas" }),
    make(4, { title: "Ideas", color: "purple",
      body: "Mini habit tracker\nRecipe app with timers\nBudget planner" }),
    make(5, { title: "Study plan",
      body: "Mon: HTML and CSS\nTue: JavaScript arrays\nWed: Git and GitHub\nThu: Responsive layouts\nFri: Deploy and review" }),
    make(6, { title: "Gift ideas", color: "pink",
      body: "Headphones for Sam\nPlant for Mom\nBook for Dad" }),
    make(7, { title: "Reminder", color: "orange",
      body: "Record the Loom video before the deadline. Keep it under five minutes." }),
    make(8, { title: "Old meeting notes", archived: true,
      body: "Archived notes live in the Archive. Open the Archive from the menu to bring them back." }),
    make(9, { title: "Deleted draft", trashed: true, trashedAt: now - 24 * hour,
      body: "Notes in Trash are removed for good after 7 days." }),
  ];
}

function loadNotes() {
  let list = null;
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) list = JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read saved notes.", e);
  }
  if (!Array.isArray(list)) list = starterNotes();

  /* remove notes that have been in the Trash for more than 7 days */
  const limit = Date.now() - TRASH_DAYS * 24 * 3600000;
  return list.filter((n) => !(n.trashed && n.trashedAt && n.trashedAt < limit));
}

function saveNotes() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn("Could not save notes.", e);
  }
}

const prefs = loadPrefs();
let notes = loadNotes();

/* things that only matter while the page is open */
const state = {
  view: "notes",            // notes | archive | trash
  query: "",
  composerOpen: false,
  composerColor: "default",
  composerPinned: false,
  editingId: null,
  dragId: null,
};


/* ============================================================
   2. HELPERS
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const findNote = (id) => notes.find((n) => n.id === id);
const uid = () => "n" + Date.now() + Math.random().toString(36).slice(2, 6);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function autosize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function formatEdited(ts) {
  return "Edited " + new Date(ts).toLocaleString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/* keeps Tab inside an open popup */
function trapFocus(e, container) {
  if (e.key !== "Tab") return;
  const items = Array.from(
    container.querySelectorAll("button, input, textarea, [href], [tabindex]:not([tabindex='-1'])")
  ).filter((el) => !el.disabled && !el.hidden && el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}


/* ============================================================
   3. COLOURS
   ============================================================ */
const colors = [
  ["default", "Default"], ["red", "Red"], ["orange", "Orange"], ["yellow", "Yellow"],
  ["green", "Green"], ["teal", "Teal"], ["blue", "Blue"], ["darkblue", "Dark blue"],
  ["purple", "Purple"], ["pink", "Pink"], ["brown", "Brown"], ["gray", "Gray"],
];

const palette = $("#palette");
let paletteState = null;

function openPalette(anchor, current, onPick) {
  if (paletteState && paletteState.anchor === anchor) {
    closePalette();
    return;
  }
  palette.innerHTML = colors
    .map(([key, label]) => `
      <button type="button" class="swatch" data-color="${key}" data-pick="${key}"
        aria-label="${label}" title="${label}" aria-pressed="${key === current}">
        ${key === current ? '<i class="bi bi-check2"></i>' : ""}
      </button>`)
    .join("");
  palette.hidden = false;
  paletteState = { anchor, onPick };

  /* place the popup under the button, or above it when there is no room */
  const rect = anchor.getBoundingClientRect();
  const w = palette.offsetWidth;
  const h = palette.offsetHeight;
  let left = Math.min(rect.left, window.innerWidth - w - 8);
  left = Math.max(8, left);
  let top = rect.bottom + 8;
  if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
  palette.style.left = left + "px";
  palette.style.top = top + "px";
}

function closePalette() {
  palette.hidden = true;
  paletteState = null;
}

palette.addEventListener("click", (e) => {
  const swatch = e.target.closest("[data-pick]");
  if (!swatch || !paletteState) return;
  const pick = paletteState.onPick;
  closePalette();
  pick(swatch.dataset.pick);
});

document.addEventListener("mousedown", (e) => {
  if (palette.hidden) return;
  if (palette.contains(e.target)) return;
  if (e.target.closest("[data-action='color'], #composerColorBtn, #editColorBtn")) return;
  closePalette();
});
window.addEventListener("scroll", () => { if (!palette.hidden) closePalette(); }, { passive: true });
window.addEventListener("resize", () => { if (!palette.hidden) closePalette(); });


/* ============================================================
   4. NOTES LIST
   ============================================================ */
const viewText = {
  notes:   { title: "Notes",   icon: "bi-lightbulb", empty: "Notes you add appear here" },
  archive: { title: "Archive", icon: "bi-archive",   empty: "Your archived notes appear here" },
  trash:   { title: "Trash",   icon: "bi-trash3",    empty: "No notes in Trash" },
};

function visibleNotes() {
  const q = state.query.trim().toLowerCase();
  return notes.filter((n) => {
    if (state.view === "notes" && (n.archived || n.trashed)) return false;
    if (state.view === "archive" && (!n.archived || n.trashed)) return false;
    if (state.view === "trash" && !n.trashed) return false;
    if (q && !(n.title + " " + n.body).toLowerCase().includes(q)) return false;
    return true;
  });
}

function toolButton(action, icon, label) {
  return `<button type="button" class="icon-btn tip-top" data-action="${action}" data-tooltip="${label}" aria-label="${label}"><i class="bi ${icon}"></i></button>`;
}

function noteHtml(n) {
  const inTrash = state.view === "trash";
  const inArchive = state.view === "archive";

  const pin = state.view === "notes"
    ? `<button type="button" class="icon-btn card-pin tip-below tip-end ${n.pinned ? "is-on" : ""}" data-action="pin"
         data-tooltip="${n.pinned ? "Unpin note" : "Pin note"}" aria-label="${n.pinned ? "Unpin note" : "Pin note"}" aria-pressed="${n.pinned}">
         <i class="bi ${n.pinned ? "bi-pin-angle-fill" : "bi-pin-angle"}"></i>
       </button>`
    : "";

  const tools = inTrash
    ? toolButton("restore", "bi-arrow-counterclockwise", "Restore") +
      toolButton("delete-forever", "bi-trash3-fill", "Delete forever")
    : toolButton("color", "bi-palette", "Background options") +
      (inArchive
        ? toolButton("unarchive", "bi-box-arrow-up", "Unarchive")
        : toolButton("archive", "bi-archive", "Archive")) +
      toolButton("trash", "bi-trash3", "Delete note");

  const label = n.title || n.body.slice(0, 40) || "Empty note";

  return `
  <article class="note" data-id="${n.id}" data-color="${n.color}" draggable="${!inTrash}" tabindex="0"
    aria-label="Note: ${escapeHtml(label)}">
    ${pin}
    ${n.title ? `<h3 class="note-title">${escapeHtml(n.title)}</h3>` : ""}
    ${n.body ? `<p class="note-body">${escapeHtml(n.body)}</p>` : ""}
    <div class="note-tools">${tools}</div>
  </article>`;
}

function renderNotes() {
  const list = visibleNotes();
  const pinned = state.view === "notes" ? list.filter((n) => n.pinned) : [];
  const others = state.view === "notes" ? list.filter((n) => !n.pinned) : list;

  $("#pinnedGrid").innerHTML = pinned.map((n) => noteHtml(n)).join("");
  $("#notesGrid").innerHTML = others.map((n) => noteHtml(n)).join("");

  $("#pinnedSection").hidden = pinned.length === 0;
  $("#otherSection").hidden = others.length === 0;
  $("#otherTitle").hidden = pinned.length === 0 || others.length === 0;

  const asList = prefs.layout === "list";
  $("#pinnedGrid").classList.toggle("is-list", asList);
  $("#notesGrid").classList.toggle("is-list", asList);

  const empty = list.length === 0;
  $("#emptyState").hidden = !empty;
  if (empty) {
    if (state.query.trim()) {
      $("#emptyIcon").className = "bi bi-search";
      $("#emptyText").textContent = "No matching notes found";
    } else {
      $("#emptyIcon").className = "bi " + viewText[state.view].icon;
      $("#emptyText").textContent = viewText[state.view].empty;
    }
  }
}

function renderChrome() {
  $$(".nav-link").forEach((b) => {
    const on = b.dataset.view === state.view;
    b.classList.toggle("is-active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("#viewTitle").textContent = viewText[state.view].title;
  $("#composer").hidden = state.view !== "notes";
  $("#trashBanner").hidden = state.view !== "trash" || !notes.some((n) => n.trashed);
}

function renderAll() {
  renderChrome();
  renderNotes();
}

/* click or press Enter on a note to open it, or use the icons on it */
$("#notesMain").addEventListener("click", (e) => {
  const card = e.target.closest(".note");
  if (!card) return;
  const btn = e.target.closest("button[data-action]");
  if (btn) {
    handleNoteAction(btn.dataset.action, card.dataset.id, btn);
    return;
  }
  if (state.view !== "trash") openEditor(card.dataset.id);
});

$("#notesMain").addEventListener("keydown", (e) => {
  const card = e.target.closest(".note");
  if (!card || e.target !== card) return;
  if ((e.key === "Enter" || e.key === " ") && state.view !== "trash") {
    e.preventDefault();
    openEditor(card.dataset.id);
  }
});


/* ============================================================
   5. NOTE ACTIONS
   ============================================================ */
function handleNoteAction(action, id, btn) {
  const n = findNote(id);
  if (!n) return;
  switch (action) {
    case "pin":            togglePin(id); break;
    case "color":          openPalette(btn, n.color, (c) => setColor(id, c)); break;
    case "archive":        archiveNote(id); break;
    case "unarchive":      unarchiveNote(id); break;
    case "trash":          trashNote(id); break;
    case "restore":        restoreNote(id); break;
    case "delete-forever": deleteForever(id); break;
  }
}

/* changes a note, then offers an Undo message */
function changeWithUndo(id, message, change) {
  const n = findNote(id);
  if (!n) return;
  const before = { ...n };
  change(n);
  saveNotes();
  renderAll();
  showMessage(message, () => {
    const i = notes.findIndex((x) => x.id === id);
    if (i >= 0) notes[i] = before;
    saveNotes();
    renderAll();
  });
}

function togglePin(id) {
  const n = findNote(id);
  if (!n) return;
  n.pinned = !n.pinned;
  if (n.pinned) n.archived = false;
  saveNotes();
  renderAll();
}

function setColor(id, color) {
  const n = findNote(id);
  if (!n) return;
  n.color = color;
  saveNotes();
  renderAll();
}

const archiveNote = (id) =>
  changeWithUndo(id, "Note archived", (n) => { n.archived = true; n.pinned = false; });

const unarchiveNote = (id) =>
  changeWithUndo(id, "Note unarchived", (n) => { n.archived = false; });

const trashNote = (id) =>
  changeWithUndo(id, "Note moved to Trash", (n) => {
    n.trashed = true;
    n.trashedAt = Date.now();
    n.pinned = false;
  });

const restoreNote = (id) =>
  changeWithUndo(id, "Note restored", (n) => {
    n.trashed = false;
    delete n.trashedAt;
  });

async function deleteForever(id) {
  const ok = await askConfirm({
    title: "Delete note",
    message: "This note will be deleted forever and cannot be restored.",
    confirmLabel: "Delete",
  });
  if (!ok) return;
  notes = notes.filter((n) => n.id !== id);
  saveNotes();
  renderAll();
  showMessage("Note deleted forever");
}

$("#emptyTrashBtn").addEventListener("click", async () => {
  const count = notes.filter((n) => n.trashed).length;
  if (!count) return;
  const ok = await askConfirm({
    title: "Empty Trash",
    message: `${count} note${count === 1 ? "" : "s"} will be deleted forever and cannot be restored.`,
    confirmLabel: "Empty Trash",
  });
  if (!ok) return;
  notes = notes.filter((n) => !n.trashed);
  saveNotes();
  renderAll();
  showMessage("Trash emptied");
});


/* ============================================================
   6. CREATE BOX
   ============================================================ */
const composerOpenEl = $("#composerOpen");
const composerCollapsed = $("#composerCollapsed");
const composerTitle = $("#composerTitle");
const composerBody = $("#composerBody");

function setComposerPin(on) {
  state.composerPinned = on;
  const btn = $("#composerPin");
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", on ? "Unpin note" : "Pin note");
  btn.dataset.tooltip = on ? "Unpin note" : "Pin note";
  btn.classList.toggle("is-on", on);
  btn.querySelector("i").className = "bi " + (on ? "bi-pin-angle-fill" : "bi-pin-angle");
}

function openComposer() {
  state.composerOpen = true;
  composerCollapsed.hidden = true;
  composerOpenEl.hidden = false;
  composerBody.focus();
}

function resetComposer() {
  composerTitle.value = "";
  composerBody.value = "";
  composerBody.style.height = "";
  state.composerColor = "default";
  composerOpenEl.dataset.color = "default";
  setComposerPin(false);
}

function closeComposer({ archive = false } = {}) {
  if (!state.composerOpen) return;
  const title = composerTitle.value.trim();
  const body = composerBody.value.trim();
  const hasContent = title || body;

  if (hasContent) {
    const now = Date.now();
    notes.unshift({
      id: uid(),
      title,
      body: composerBody.value.replace(/\s+$/, ""),
      color: state.composerColor,
      pinned: state.composerPinned && !archive,
      archived: archive,
      trashed: false,
      createdAt: now,
      updatedAt: now,
    });
    saveNotes();
  }

  state.composerOpen = false;
  resetComposer();
  composerOpenEl.hidden = true;
  composerCollapsed.hidden = false;
  closePalette();
  renderAll();
  if (hasContent && archive) showMessage("Note archived");
}

composerCollapsed.addEventListener("click", openComposer);
$("#composerClose").addEventListener("click", () => closeComposer());
$("#composerArchiveBtn").addEventListener("click", () => closeComposer({ archive: true }));
$("#composerPin").addEventListener("click", () => setComposerPin(!state.composerPinned));
$("#composerColorBtn").addEventListener("click", (e) => {
  openPalette(e.currentTarget, state.composerColor, (c) => {
    state.composerColor = c;
    composerOpenEl.dataset.color = c;
  });
});
composerBody.addEventListener("input", () => autosize(composerBody));

/* clicking anywhere outside the box saves the note and closes it */
document.addEventListener("mousedown", (e) => {
  if (!state.composerOpen) return;
  if (composerOpenEl.contains(e.target) || palette.contains(e.target)) return;
  closeComposer();
});


/* ============================================================
   7. EDIT POPUP
   ============================================================ */
const editOverlay = $("#editOverlay");
const editCard = $("#editCard");
const editTitle = $("#editTitle");
const editBody = $("#editBody");

const editingNote = () => findNote(state.editingId);

function renderEditor() {
  const n = editingNote();
  if (!n) return;
  editCard.dataset.color = n.color;

  const pin = $("#editPin");
  pin.setAttribute("aria-pressed", String(n.pinned));
  pin.setAttribute("aria-label", n.pinned ? "Unpin note" : "Pin note");
  pin.dataset.tooltip = n.pinned ? "Unpin note" : "Pin note";
  pin.classList.toggle("is-on", n.pinned);
  pin.querySelector("i").className = "bi " + (n.pinned ? "bi-pin-angle-fill" : "bi-pin-angle");

  const arch = $("#editArchiveBtn");
  const label = n.archived ? "Unarchive" : "Archive";
  arch.dataset.tooltip = label;
  arch.setAttribute("aria-label", label + " note");
  arch.querySelector("i").className = "bi " + (n.archived ? "bi-box-arrow-up" : "bi-archive");

  $("#editEdited").textContent = formatEdited(n.updatedAt);
}

function openEditor(id) {
  const n = findNote(id);
  if (!n || n.trashed) return;
  state.editingId = id;
  editTitle.value = n.title;
  editBody.value = n.body;
  renderEditor();
  editOverlay.hidden = false;
  document.body.classList.add("modal-open");
  autosize(editBody);
  editBody.focus();
  editBody.setSelectionRange(editBody.value.length, editBody.value.length);
}

function closeEditor() {
  if (editOverlay.hidden) return;
  const n = editingNote();
  editOverlay.hidden = true;
  document.body.classList.remove("modal-open");
  closePalette();
  state.editingId = null;

  if (n && !n.title.trim() && !n.body.trim()) {
    notes = notes.filter((x) => x.id !== n.id);
    showMessage("Empty note discarded");
  }
  saveNotes();
  renderAll();
}

/* changes are saved as you type */
function saveEdit() {
  const n = editingNote();
  if (!n) return;
  n.title = editTitle.value;
  n.body = editBody.value;
  n.updatedAt = Date.now();
  $("#editEdited").textContent = formatEdited(n.updatedAt);
  saveNotes();
}
editTitle.addEventListener("input", saveEdit);
editBody.addEventListener("input", () => { autosize(editBody); saveEdit(); });

$("#editClose").addEventListener("click", closeEditor);
editOverlay.addEventListener("mousedown", (e) => {
  if (e.target === editOverlay) closeEditor();
});

$("#editPin").addEventListener("click", () => {
  const n = editingNote();
  if (!n) return;
  n.pinned = !n.pinned;
  if (n.pinned) n.archived = false;
  saveNotes();
  renderEditor();
});

$("#editColorBtn").addEventListener("click", (e) => {
  const n = editingNote();
  if (!n) return;
  openPalette(e.currentTarget, n.color, (c) => {
    n.color = c;
    saveNotes();
    renderEditor();
  });
});

$("#editArchiveBtn").addEventListener("click", () => {
  const n = editingNote();
  if (!n) return;
  const id = n.id;
  const wasArchived = n.archived;
  closeEditor();
  if (findNote(id)) (wasArchived ? unarchiveNote : archiveNote)(id);
});

$("#editTrashBtn").addEventListener("click", () => {
  const n = editingNote();
  if (!n) return;
  const id = n.id;
  closeEditor();
  if (findNote(id)) trashNote(id);
});


/* ============================================================
   8. CONFIRM POPUP
   ============================================================ */
const confirmOverlay = $("#confirmOverlay");
let confirmResolve = null;

function askConfirm({ title, message, confirmLabel }) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = message;
    $("#confirmOk").textContent = confirmLabel;
    confirmOverlay.hidden = false;
    $("#confirmCancel").focus();
  });
}

function closeConfirm(result) {
  confirmOverlay.hidden = true;
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

$("#confirmOk").addEventListener("click", () => closeConfirm(true));
$("#confirmCancel").addEventListener("click", () => closeConfirm(false));
confirmOverlay.addEventListener("mousedown", (e) => {
  if (e.target === confirmOverlay) closeConfirm(false);
});


/* ============================================================
   9. TOP BAR AND MENU
   ============================================================ */
const searchInput = $("#searchInput");
const searchClear = $("#searchClear");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const smallScreen = window.matchMedia("(max-width: 900px)");

/* search */
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  searchClear.hidden = !state.query;
  renderNotes();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && searchInput.value) {
    e.stopPropagation();
    clearSearch();
  }
});
$("#searchForm").addEventListener("submit", (e) => e.preventDefault());
searchClear.addEventListener("click", () => { clearSearch(); searchInput.focus(); });

function clearSearch() {
  searchInput.value = "";
  state.query = "";
  searchClear.hidden = true;
  renderNotes();
}

/* grid or list */
function applyLayout() {
  const list = prefs.layout === "list";
  const btn = $("#layoutBtn");
  btn.dataset.tooltip = list ? "Grid view" : "List view";
  btn.setAttribute("aria-label", list ? "Switch to grid view" : "Switch to list view");
  $("#layoutIcon").className = "bi " + (list ? "bi-grid" : "bi-view-stacked");
}
$("#layoutBtn").addEventListener("click", () => {
  prefs.layout = prefs.layout === "list" ? "grid" : "list";
  savePrefs();
  applyLayout();
  renderNotes();
});

/* light or dark */
function resolvedTheme() {
  if (prefs.theme === "system") return darkQuery.matches ? "dark" : "light";
  return prefs.theme;
}
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  const btn = $("#themeBtn");
  btn.dataset.tooltip = theme === "dark" ? "Light mode" : "Dark mode";
  btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  $("#themeIcon").className = "bi " + (theme === "dark" ? "bi-sun" : "bi-moon-stars");
}
$("#themeBtn").addEventListener("click", () => {
  prefs.theme = resolvedTheme() === "dark" ? "light" : "dark";
  savePrefs();
  applyTheme();
});
darkQuery.addEventListener("change", () => {
  if (prefs.theme === "system") applyTheme();
});

/* side menu */
function applySidebar() {
  document.body.classList.toggle("sidebar-collapsed", prefs.sidebarCollapsed);
  const open = smallScreen.matches
    ? document.body.classList.contains("sidebar-open")
    : !prefs.sidebarCollapsed;
  $("#menuBtn").setAttribute("aria-expanded", String(open));
}
function closeSidebar() {
  document.body.classList.remove("sidebar-open");
  applySidebar();
}
$("#menuBtn").addEventListener("click", () => {
  if (smallScreen.matches) {
    document.body.classList.toggle("sidebar-open");
  } else {
    prefs.sidebarCollapsed = !prefs.sidebarCollapsed;
    savePrefs();
  }
  applySidebar();
});
$("#sidebarBackdrop").addEventListener("click", closeSidebar);
smallScreen.addEventListener("change", closeSidebar);

function showView(view) {
  if (state.composerOpen) closeComposer();
  state.view = view;
  clearSearch();
  closeSidebar();
  renderAll();
  window.scrollTo(0, 0);
}
$$(".nav-link").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
$("#brand").addEventListener("click", (e) => { e.preventDefault(); showView("notes"); });

/* keyboard */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!palette.hidden) { closePalette(); return; }
    if (!confirmOverlay.hidden) { closeConfirm(false); return; }
    if (!editOverlay.hidden) { closeEditor(); return; }
    if (state.composerOpen) { closeComposer(); return; }
    if (document.body.classList.contains("sidebar-open")) { closeSidebar(); return; }
  }
  if (e.key === "Tab") {
    if (!confirmOverlay.hidden) trapFocus(e, $("#confirmCard"));
    else if (!editOverlay.hidden) trapFocus(e, editCard);
  }
});


/* ============================================================
   10. DRAG AND DROP
   Drag a note onto another note to take its place.
   Pinned notes only swap with pinned notes, and the others with the others.
   ============================================================ */
function canDrop(targetId) {
  const a = findNote(state.dragId);
  const b = findNote(targetId);
  return Boolean(a && b && targetId !== state.dragId && a.pinned === b.pinned);
}

function moveNote(fromId, toId) {
  const from = notes.findIndex((n) => n.id === fromId);
  const to = notes.findIndex((n) => n.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [item] = notes.splice(from, 1);
  notes.splice(to, 0, item);
  saveNotes();
  renderNotes();
}

function endDrag() {
  state.dragId = null;
  $$(".note.is-dragging, .note.drop-target").forEach((c) =>
    c.classList.remove("is-dragging", "drop-target")
  );
}

document.addEventListener("dragstart", (e) => {
  const card = e.target.closest && e.target.closest(".note");
  if (!card || state.view === "trash") return;
  state.dragId = card.dataset.id;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", state.dragId);
  setTimeout(() => card.classList.add("is-dragging"), 0);
});

document.addEventListener("dragover", (e) => {
  if (!state.dragId) return;
  const card = e.target.closest && e.target.closest(".note");
  if (!card || !canDrop(card.dataset.id)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  $$(".note.drop-target").forEach((c) => { if (c !== card) c.classList.remove("drop-target"); });
  card.classList.add("drop-target");
});

document.addEventListener("drop", (e) => {
  if (!state.dragId) return;
  const card = e.target.closest && e.target.closest(".note");
  if (card && canDrop(card.dataset.id)) {
    e.preventDefault();
    moveNote(state.dragId, card.dataset.id);
  }
  endDrag();
});

document.addEventListener("dragend", endDrag);


/* ============================================================
   11. MESSAGES
   ============================================================ */
let messageTimer = null;
let undoAction = null;

function showMessage(text, undo) {
  $("#snackbarText").textContent = text;
  undoAction = undo || null;
  $("#snackbarUndo").hidden = !undo;
  $("#snackbar").hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(hideMessage, 6000);
}

function hideMessage() {
  $("#snackbar").hidden = true;
  undoAction = null;
}

$("#snackbarUndo").addEventListener("click", () => {
  const undo = undoAction;
  hideMessage();
  if (undo) undo();
});


/* ============================================================
   12. START-UP
   ============================================================ */
saveNotes();
applyTheme();
applyLayout();
applySidebar();
renderAll();