import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '../shared/firebase-config';
import {
  type HighlightSettings,
  PIECE_TYPES,
  PIECE_COLORS,
  PIECE_LABELS,
  DEFAULT_PLAN_TYPES,
  defaultHighlights,
} from '../shared/types';

// ── Firebase ───────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
const elUserElo = document.getElementById('user-elo') as HTMLElement;
const elEloBadge = document.getElementById('elo-badge') as HTMLElement;
const elAuthError = document.getElementById('auth-error') as HTMLElement;
const elHighlightsBody = document.getElementById('highlights-body') as HTMLElement;
const elHighlightCount = document.getElementById('highlight-count') as HTMLElement;
const elPlansContainer = document.getElementById('plans-container') as HTMLElement;

const PIECE_EMOJI: Record<string, string> = {
  pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚',
};

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
    grid.appendChild(card);
  }

  elPlansContainer.innerHTML = '';
  elPlansContainer.appendChild(grid);
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
      elUserElo.textContent = String(globalElo);
      elEloBadge.style.display = 'flex';
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
