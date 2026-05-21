import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseConfig } from '../shared/firebase-config';
import {
  type HighlightSettings,
  PIECE_TYPES,
  PIECE_COLORS,
  PIECE_LABELS,
  DEFAULT_PLAN_TYPES,
  PLAN_LABELS,
  defaultHighlights,
} from '../shared/types';
import { Trainer, generateBlocks, type TrainingBlock, THEME_LABELS } from '../training/trainer';

// ── Firebase ───────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── Training state ─────────────────────────────────────────────────────────
let currentUserElo = 1500;
let activeTrainer: Trainer | null = null;

// Google OAuth2 web client from the Firebase project (type 3 in google-services.json)
const GOOGLE_CLIENT_ID =
  '798600509062-1hrnp7meoueqo1v0lipqdnrqpjln44nv.apps.googleusercontent.com';

// ── DOM refs ───────────────────────────────────────────────────────────────
const elSignin = document.getElementById('btn-signin') as HTMLButtonElement;
const elSignout = document.getElementById('btn-signout') as HTMLButtonElement;
const elLoggedOut = document.getElementById('auth-logged-out') as HTMLElement;
const elLoggedIn = document.getElementById('auth-logged-in') as HTMLElement;
const elUserName = document.getElementById('user-name') as HTMLElement;
const elUserEmail = document.getElementById('user-email') as HTMLElement;
const elAuthError = document.getElementById('auth-error') as HTMLElement;
const elHighlightsBody = document.getElementById('highlights-body') as HTMLElement;
const elHighlightCount = document.getElementById('highlight-count') as HTMLElement;
const elPlansContainer = document.getElementById('plans-container') as HTMLElement;

// Training view elements
const elPanelMain = document.getElementById('panel-main') as HTMLElement;
const elTrainingView = document.getElementById('training-view') as HTMLElement;
const elTrainingLoading = document.getElementById('training-loading') as HTMLElement;
const elTrainingBoardArea = document.getElementById('training-board-area') as HTMLElement;
const elTrainingBoard = document.getElementById('training-board') as HTMLElement;
const elTrainingStatus = document.getElementById('training-status') as HTMLElement;
const elTrainingResults = document.getElementById('training-results') as HTMLElement;
const elTrainingScore = document.getElementById('training-score') as HTMLElement;
const elTrainingPlanLabel = document.getElementById('training-plan-label') as HTMLElement;
const elTrainingProgress = document.getElementById('training-progress') as HTMLElement;
const elBtnBack = document.getElementById('btn-back') as HTMLButtonElement;
const elBtnFinish = document.getElementById('btn-finish') as HTMLButtonElement;
const elBlockTimer = document.getElementById('block-timer') as HTMLElement;

// Block presentation elements
const elBlockPres = document.getElementById('block-presentation') as HTMLElement;
const elBlockPresIdx = document.getElementById('block-pres-idx') as HTMLElement;
const elBlockPresTotal = document.getElementById('block-pres-total') as HTMLElement;
const elBlockPresLabel = document.getElementById('block-pres-label') as HTMLElement;
const elBlockPresTheme = document.getElementById('block-pres-theme') as HTMLElement;
const elBlockPresDuration = document.getElementById('block-pres-duration') as HTMLElement;
const elBtnStartBlock = document.getElementById('btn-start-block') as HTMLButtonElement;

// Puzzle timer elements
const elPuzzleTimerFill = document.getElementById('puzzle-timer-fill') as HTMLElement;
const elPuzzleTimerText = document.getElementById('puzzle-timer-text') as HTMLElement;

const PIECE_EMOJI: Record<string, string> = {
  pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${s}s`;
}

function updatePuzzleTimer(secs: number, total: number): void {
  const pct = total > 0 ? (secs / total) * 100 : 0;
  elPuzzleTimerFill.style.width = `${pct}%`;
  elPuzzleTimerText.textContent = String(secs);
  elPuzzleTimerFill.classList.toggle('warning', pct <= 40 && pct > 20);
  elPuzzleTimerFill.classList.toggle('danger', pct <= 20);
}

function saveElo(planType: string, newElo: number): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  updateDoc(doc(db, 'Users', uid), {
    elo: newElo,
    [`elos.${planType}Total`]: newElo,
  }).catch(() => {});
}

function showBlockPresentation(block: TrainingBlock, idx: number, total: number): Promise<void> {
  elTrainingProgress.textContent = `${idx + 1} / ${total}`;
  elBlockPresIdx.textContent = String(idx + 1);
  elBlockPresTotal.textContent = String(total);
  elBlockPresLabel.textContent = block.label;
  elBlockPresTheme.textContent = THEME_LABELS[block.theme] ?? block.theme;
  elBlockPresDuration.textContent = formatTime(block.time);
  elBlockPres.style.display = 'flex';

  return new Promise(resolve => {
    const handler = () => {
      elBlockPres.style.display = 'none';
      elBtnStartBlock.removeEventListener('click', handler);
      resolve();
    };
    elBtnStartBlock.addEventListener('click', handler);
  });
}

// ── Auth — launchWebAuthFlow ───────────────────────────────────────────────
async function signInWithGoogle(): Promise<void> {
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'openid email profile');

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (url) {
          resolve(url);
        } else {
          reject(new Error('Authentication cancelled'));
        }
      },
    );
  });

  // Extract access_token from hash or query params
  const hash = responseUrl.includes('#') ? responseUrl.split('#')[1] : responseUrl.split('?')[1];
  const params = new URLSearchParams(hash ?? '');
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('No access_token in response');

  const credential = GoogleAuthProvider.credential(null, accessToken);
  await signInWithCredential(auth, credential);
}

// ── Highlights ─────────────────────────────────────────────────────────────
async function loadHighlights(): Promise<HighlightSettings> {
  const r = await chrome.storage.sync.get('highlights');
  return (r['highlights'] as HighlightSettings) ?? defaultHighlights();
}

function updateCountBadge(s: HighlightSettings) {
  const n = Object.values(s).filter(Boolean).length;
  elHighlightCount.textContent = String(n);
  elHighlightCount.style.display = n > 0 ? 'inline-block' : 'none';
}

function buildHighlightsUI(settings: HighlightSettings) {
  elHighlightsBody.innerHTML = '';
  updateCountBadge(settings);

  for (const type of PIECE_TYPES) {
    const row = document.createElement('div');
    row.className = 'piece-row';

    const togglesHtml = PIECE_COLORS.map(color => {
      const key = `${type}-${color}` as keyof HighlightSettings;
      const active = settings[key];
      return `
        <label class="toggle-label${active ? ` active-${color}` : ''}"
               data-key="${key}" data-color="${color}">
          <input type="checkbox"${active ? ' checked' : ''} />
          <span class="color-dot dot-${color}"></span>
          ${color.charAt(0).toUpperCase() + color.slice(1)}
        </label>`;
    }).join('');

    row.innerHTML = `
      <div class="piece-label">
        <span class="piece-emoji">${PIECE_EMOJI[type]}</span>
        <span>${PIECE_LABELS[type]}</span>
      </div>
      <div class="piece-toggles">${togglesHtml}</div>`;

    elHighlightsBody.appendChild(row);
  }

  elHighlightsBody.querySelectorAll<HTMLLabelElement>('label.toggle-label').forEach(label => {
    label.addEventListener('click', async (e) => {
      e.preventDefault();
      const key = label.dataset['key'] as keyof HighlightSettings;
      const color = label.dataset['color'] as string;
      const input = label.querySelector('input') as HTMLInputElement;
      const next = !input.checked;
      input.checked = next;
      label.classList.toggle(`active-${color}`, next);

      const current = await loadHighlights();
      current[key] = next;
      await chrome.storage.sync.set({ highlights: current });
      updateCountBadge(current);

      const tabs = await chrome.tabs.query({ url: 'https://lichess.org/*' });
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHTS', settings: current }).catch(() => {});
        }
      }
    });
  });
}

// ── Plans — hardcoded default routines ────────────────────────────────────
const TIMER_SVG = `<svg viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M256 80a176 176 0 10176 176A176.2 176.2 0 00256 80zm0 320a144 144 0 11144-144 144.16 144.16 0 01-144 144z"/>
  <path d="M256 176v80l48 48" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" fill="none"/>
  <path d="M216 16h80M256 16v64" stroke="currentColor" stroke-linecap="round" stroke-width="32" fill="none"/>
</svg>`;

function renderPlans(elosPerPlan: Record<string, number | undefined>) {
  const grid = document.createElement('div');
  grid.className = 'plans-grid';

  for (const type of DEFAULT_PLAN_TYPES) {
    const count = parseInt(type.replace('plan', ''), 10);
    const elo = elosPerPlan[type];

    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      <div class="plan-img-wrap">
        <img src="icons/${type}.png" alt="${type}" />
      </div>
      <div class="plan-footer">
        <span class="plan-elo">${elo ?? '—'}</span>
        <span class="plan-count">${count} ${TIMER_SVG}</span>
      </div>`;

    card.addEventListener('click', () => startTraining(type));
    grid.appendChild(card);
  }

  elPlansContainer.innerHTML = '';
  elPlansContainer.appendChild(grid);
}

// ── Training ───────────────────────────────────────────────────────────────
function showMenuView() {
  activeTrainer?.destroy();
  activeTrainer = null;
  elBlockPres.style.display = 'none';
  elBlockTimer.textContent = '';
  elBlockTimer.className = 'block-timer';
  elTrainingView.style.display = 'none';
  elPanelMain.style.display = 'block';
}

function showTrainingView() {
  elPanelMain.style.display = 'none';
  elTrainingView.style.display = 'flex';
  elTrainingLoading.style.display = 'flex';
  elTrainingBoardArea.style.display = 'none';
  elTrainingResults.style.display = 'none';
  elBlockPres.style.display = 'none';
  elBlockTimer.textContent = '';
  elBlockTimer.className = 'block-timer';
  elPuzzleTimerFill.style.width = '100%';
  elPuzzleTimerFill.className = 'puzzle-timer-fill';
  elPuzzleTimerText.textContent = '';
}

async function startTraining(planType: string) {
  showTrainingView();
  elTrainingPlanLabel.textContent = PLAN_LABELS[planType] ?? planType;
  elTrainingProgress.textContent = '';
  elTrainingStatus.textContent = '';
  elTrainingStatus.className = 'training-status';

  const blocks = generateBlocks(planType, currentUserElo);
  const assetsUrl = chrome.runtime.getURL('cm-chessboard/');

  activeTrainer = new Trainer(elTrainingBoard, {
    onBlockStart: (block, idx, total) => showBlockPresentation(block, idx, total),
    onPuzzleReady: () => {
      elTrainingLoading.style.display = 'none';
      elTrainingBoardArea.style.display = 'flex';
    },
    onBlockTime: (secs) => {
      elBlockTimer.textContent = formatTime(secs);
      elBlockTimer.classList.toggle('warning', secs <= 30 && secs > 10);
      elBlockTimer.classList.toggle('danger', secs <= 10);
    },
    onPuzzleTime: (secs, total) => {
      updatePuzzleTimer(secs, total);
    },
    onEloUpdate: (newElo) => {
      currentUserElo = newElo;
      saveElo(planType, newElo);
    },
    onStatus: (status) => {
      elTrainingStatus.className = 'training-status' + (status ? ` status-${status}` : '');
      elTrainingStatus.textContent =
        status === 'correct' ? '✓ Correct!' :
        status === 'wrong'   ? '✗ Wrong'    :
        status === 'timeout' ? '⏱ Time up!' : '';
    },
    onDone: (solved, total) => {
      elTrainingBoardArea.style.display = 'none';
      elTrainingResults.style.display = 'flex';
      elTrainingScore.textContent = `${solved} of ${total} solved`;
    },
  });

  try {
    await activeTrainer.start(blocks, assetsUrl);
  } catch (err: unknown) {
    elTrainingBoardArea.style.display = 'none';
    elTrainingLoading.style.display = 'flex';
    elTrainingLoading.innerHTML = `<p class="text-error">${err instanceof Error ? err.message : 'Error loading puzzles'}</p>`;
  }
}

async function loadElosForUser(uid: string): Promise<Record<string, number | undefined>> {
  try {
    const snap = await getDoc(doc(db, 'Users', uid));
    if (!snap.exists()) return {};
    const data = snap.data() as { elos?: Record<string, number> };
    const elos = data.elos ?? {};
    return {
      plan1: elos['plan1Total'],
      plan3: elos['plan3Total'],
      plan5: elos['plan5Total'],
      plan10: elos['plan10Total'],
      plan20: elos['plan20Total'],
      plan30: elos['plan30Total'],
    };
  } catch {
    return {};
  }
}

// ── Auth handlers ──────────────────────────────────────────────────────────
elSignin.addEventListener('click', async () => {
  elSignin.disabled = true;
  elAuthError.style.display = 'none';
  try {
    await signInWithGoogle();
  } catch (err: unknown) {
    elAuthError.textContent = err instanceof Error ? err.message : 'Sign-in failed.';
    elAuthError.style.display = 'block';
    elSignin.disabled = false;
  }
});

elSignout.addEventListener('click', () => signOut(auth));
elBtnBack.addEventListener('click', showMenuView);
elBtnFinish.addEventListener('click', showMenuView);

// ── Auth state ─────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user: User | null) => {
  buildHighlightsUI(await loadHighlights());

  if (user) {
    elLoggedOut.style.display = 'none';
    elLoggedIn.style.display = 'block';
    elSignout.style.display = 'inline-flex';
    elUserName.textContent = user.displayName ?? '';
    elUserEmail.textContent = user.email ?? '';

    const eloData = await loadElosForUser(user.uid);
    const globalElo = await (async () => {
      try {
        const snap = await getDoc(doc(db, 'Users', user.uid));
        return snap.exists() ? ((snap.data() as { elo?: number }).elo ?? null) : null;
      } catch { return null; }
    })();

    if (globalElo !== null) {
      currentUserElo = globalElo;
    }

    renderPlans(eloData);
  } else {
    elLoggedOut.style.display = 'block';
    elLoggedIn.style.display = 'none';
    elSignout.style.display = 'none';
    elSignin.disabled = false;
    renderPlans({});  // Always show cards, just without ELO
  }
});
