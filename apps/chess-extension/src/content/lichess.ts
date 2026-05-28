import { type HighlightSettings, PIECE_TYPES, PIECE_COLORS, defaultHighlights } from '../shared/types';

// Data attributes used to track which pieces we've modified
const ATTR_HL  = 'data-cce-hl';
const ATTR_DIM = 'data-cce-dim';

let currentSettings: HighlightSettings = defaultHighlights();

// ── Core highlight logic ──────────────────────────────────────────────────
function restore() {
  document.querySelectorAll<HTMLElement>(`piece[${ATTR_HL}]`).forEach(p => {
    // Remove only our scale — keep Lichess's translate untouched
    p.style.transform = p.style.transform.replace(/ scale\([^)]*\)/g, '');
    p.style.removeProperty('filter');
    p.removeAttribute(ATTR_HL);
  });
  document.querySelectorAll<HTMLElement>(`piece[${ATTR_DIM}]`).forEach(p => {
    p.style.removeProperty('opacity');
    p.removeAttribute(ATTR_DIM);
  });
}

function applyHighlights(settings: HighlightSettings) {
  currentSettings = settings;

  const pieces = Array.from(document.querySelectorAll<HTMLElement>('piece'));
  if (!pieces.length) return;

  restore(); // clean previous state first

  const anyActive = PIECE_TYPES.some(t =>
    PIECE_COLORS.some(c => settings[`${t}-${c}`]),
  );
  if (!anyActive) return;

  for (const piece of pieces) {
    const highlighted = PIECE_TYPES.some(t =>
      PIECE_COLORS.some(c =>
        settings[`${t}-${c}`] &&
        piece.classList.contains(t) &&
        piece.classList.contains(c),
      ),
    );

    if (highlighted) {
      // Append scale to whatever transform Lichess already set (preserves translate)
      piece.style.transform = piece.style.transform.replace(/ scale\([^)]*\)/g, '') + ' scale(1.2)';
      piece.style.filter =
        'drop-shadow(0 0 4px rgba(249,115,22,1)) ' +
        'drop-shadow(0 0 14px rgba(249,115,22,0.7)) ' +
        'brightness(1.3)';
      piece.setAttribute(ATTR_HL, '1');
    } else {
      piece.style.opacity = '0.35';
      piece.setAttribute(ATTR_DIM, '1');
    }
  }
}

// ── Direct message from panel (primary channel) ───────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_HIGHLIGHTS') {
    applyHighlights(msg.settings as HighlightSettings);
  }
});

// ── Storage fallback (applied on page load / persistence) ─────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && 'highlights' in changes) {
    applyHighlights((changes['highlights'].newValue as HighlightSettings) ?? defaultHighlights());
  }
});

// ── MutationObserver: re-apply after Lichess moves a piece ───────────────
// Watches childList only to avoid triggering on our own style writes.
let boardObserver: MutationObserver | null = null;

function watchBoard() {
  boardObserver?.disconnect();
  const board = document.querySelector('cg-board') ?? document.body;
  let timer: ReturnType<typeof setTimeout> | null = null;

  boardObserver = new MutationObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => applyHighlights(currentSettings), 60);
  });

  boardObserver.observe(board, { childList: true, subtree: true });
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  const result = await chrome.storage.sync.get('highlights');
  applyHighlights((result['highlights'] as HighlightSettings) ?? defaultHighlights());
  watchBoard();

  // Re-watch on SPA navigation
  new MutationObserver(() => {
    if (document.querySelector('cg-board')) {
      watchBoard();
      applyHighlights(currentSettings);
    }
  }).observe(document.body, { childList: true });
}

init();
