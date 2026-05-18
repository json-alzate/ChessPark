import { type HighlightSettings, PIECE_TYPES, PIECE_COLORS, defaultHighlights } from '../shared/types';

const HL_CLASS = 'cce-highlight';
const DIM_CLASS = 'cce-dim';

let currentSettings: HighlightSettings = defaultHighlights();

// ── Apply / clear highlights ───────────────────────────────────────────────
function applyHighlights(settings: HighlightSettings) {
  currentSettings = settings;

  const pieces = Array.from(document.querySelectorAll<HTMLElement>('piece'));
  if (!pieces.length) return;

  const anyActive = PIECE_TYPES.some(t =>
    PIECE_COLORS.some(c => settings[`${t}-${c}`])
  );

  for (const piece of pieces) {
    piece.classList.remove(HL_CLASS, DIM_CLASS);

    if (!anyActive) continue;

    const isHighlighted = PIECE_TYPES.some(t =>
      PIECE_COLORS.some(c =>
        settings[`${t}-${c}`] &&
        piece.classList.contains(t) &&
        piece.classList.contains(c)
      )
    );

    piece.classList.add(isHighlighted ? HL_CLASS : DIM_CLASS);
  }
}

function clearHighlights() {
  document.querySelectorAll<HTMLElement>(`.${HL_CLASS}, .${DIM_CLASS}`).forEach(el => {
    el.classList.remove(HL_CLASS, DIM_CLASS);
  });
}

// ── MutationObserver: re-apply when the board changes (SPA nav / new puzzle)
let observer: MutationObserver | null = null;

function watchBoard() {
  if (observer) observer.disconnect();

  const board = document.querySelector('cg-board') ?? document.body;
  observer = new MutationObserver(() => applyHighlights(currentSettings));
  observer.observe(board, { childList: true, subtree: true });
}

// ── Storage change listener ────────────────────────────────────────────────
chrome.storage.sync.onChanged.addListener((changes) => {
  if ('highlights' in changes) {
    const next = changes['highlights'].newValue as HighlightSettings | undefined;
    applyHighlights(next ?? defaultHighlights());
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const result = await chrome.storage.sync.get('highlights');
  const settings = (result['highlights'] as HighlightSettings) ?? defaultHighlights();
  applyHighlights(settings);
  watchBoard();

  // Re-watch when navigating within Lichess (Turbolinks / SPA)
  const navObserver = new MutationObserver(() => {
    if (!document.querySelector('cg-board')) return;
    watchBoard();
    applyHighlights(currentSettings);
  });
  navObserver.observe(document.body, { childList: true, subtree: false });
}

init();
