import { type HighlightSettings, PIECE_TYPES, PIECE_COLORS, defaultHighlights } from '../shared/types';

let currentSettings: HighlightSettings = defaultHighlights();

// ── Apply highlights via inline styles ────────────────────────────────────
// We use style.filter / style.scale / style.opacity directly instead of CSS
// classes, so we don't fight Lichess's CSS specificity.
function applyHighlights(settings: HighlightSettings) {
  currentSettings = settings;

  const pieces = Array.from(document.querySelectorAll<HTMLElement>('piece'));
  if (!pieces.length) return;

  const anyActive = PIECE_TYPES.some(t =>
    PIECE_COLORS.some(c => settings[`${t}-${c}`]),
  );

  for (const piece of pieces) {
    // Always reset our own overrides first
    piece.style.removeProperty('filter');
    piece.style.removeProperty('scale');
    piece.style.removeProperty('opacity');
    piece.style.removeProperty('z-index');
    piece.style.removeProperty('position');

    if (!anyActive) continue;

    const highlighted = PIECE_TYPES.some(t =>
      PIECE_COLORS.some(c =>
        settings[`${t}-${c}`] &&
        piece.classList.contains(t) &&
        piece.classList.contains(c),
      ),
    );

    if (highlighted) {
      piece.style.filter =
        'drop-shadow(0 0 6px rgba(226,184,75,1)) ' +
        'drop-shadow(0 0 14px rgba(226,184,75,0.6)) ' +
        'brightness(1.3)';
      piece.style.scale = '1.2';
      piece.style.zIndex = '100';
      piece.style.position = 'relative';
    } else {
      piece.style.opacity = '0.4';
    }
  }
}

// ── MutationObserver: re-apply after Lichess updates the board ─────────────
let boardObserver: MutationObserver | null = null;

function watchBoard() {
  boardObserver?.disconnect();

  const board = document.querySelector('cg-board') ?? document.body;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  boardObserver = new MutationObserver(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => applyHighlights(currentSettings), 80);
  });

  boardObserver.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
}

// ── Storage change — panel toggled a piece ─────────────────────────────────
chrome.storage.sync.onChanged.addListener((changes) => {
  if ('highlights' in changes) {
    const next = changes['highlights'].newValue as HighlightSettings | undefined;
    applyHighlights(next ?? defaultHighlights());
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const result = await chrome.storage.sync.get('highlights');
  applyHighlights((result['highlights'] as HighlightSettings) ?? defaultHighlights());
  watchBoard();

  // Watch for SPA navigation (Lichess loads puzzles without full reload)
  new MutationObserver(() => {
    const board = document.querySelector('cg-board');
    if (board) {
      watchBoard();
      applyHighlights(currentSettings);
    }
  }).observe(document.body, { childList: true });
}

init();
