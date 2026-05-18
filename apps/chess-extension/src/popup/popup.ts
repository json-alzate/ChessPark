import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { firebaseConfig } from '../shared/firebase-config';
import {
  type HighlightSettings,
  type PublicPlanInfo,
  PIECE_TYPES,
  PIECE_COLORS,
  PIECE_LABELS,
  PLAN_LABELS,
  DEFAULT_PLAN_TYPES,
  defaultHighlights,
} from '../shared/types';

// ── Firebase init ──────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
const elPlansContainer = document.getElementById('plans-container') as HTMLElement;

// ── Piece emoji map ────────────────────────────────────────────────────────
const PIECE_EMOJI: Record<string, string> = {
  pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚',
};

// ── Build highlights table ─────────────────────────────────────────────────
async function buildHighlightsTable(settings: HighlightSettings) {
  elHighlightsBody.innerHTML = '';
  for (const type of PIECE_TYPES) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="piece-label">
          <span class="piece-emoji">${PIECE_EMOJI[type]}</span>
          ${PIECE_LABELS[type]}
        </span>
      </td>
      ${PIECE_COLORS.map(color => `
        <td>
          <div class="toggle-wrap">
            <input
              type="checkbox"
              class="toggle toggle-${color}"
              data-key="${type}-${color}"
              ${settings[`${type}-${color}`] ? 'checked' : ''}
            />
          </div>
        </td>
      `).join('')}
    `;
    elHighlightsBody.appendChild(tr);
  }

  // Attach change listeners
  elHighlightsBody.querySelectorAll<HTMLInputElement>('input.toggle').forEach(input => {
    input.addEventListener('change', async () => {
      const key = input.dataset['key'] as keyof HighlightSettings;
      const current = await loadHighlightSettings();
      current[key] = input.checked;
      await chrome.storage.sync.set({ highlights: current });
    });
  });
}

async function loadHighlightSettings(): Promise<HighlightSettings> {
  const result = await chrome.storage.sync.get('highlights');
  return (result['highlights'] as HighlightSettings) ?? defaultHighlights();
}

// ── Auth handlers ──────────────────────────────────────────────────────────
elSignin.addEventListener('click', async () => {
  elSignin.disabled = true;
  elAuthError.style.display = 'none';
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sign-in failed.';
    elAuthError.textContent = msg;
    elAuthError.style.display = 'block';
    elSignin.disabled = false;
  }
});

elSignout.addEventListener('click', async () => {
  await signOut(auth);
});

// ── ELO loader ─────────────────────────────────────────────────────────────
async function loadUserElo(uid: string): Promise<number | null> {
  try {
    const snap = await getDoc(doc(db, 'Users', uid));
    if (snap.exists()) {
      return (snap.data() as { elo?: number }).elo ?? null;
    }
  } catch {
    // Firestore read failed — non-critical
  }
  return null;
}

// ── Plans loader ───────────────────────────────────────────────────────────
async function loadPublicPlans(): Promise<PublicPlanInfo[]> {
  const q = query(
    collection(db, 'public-plans'),
    where('planType', 'in', DEFAULT_PLAN_TYPES),
    where('isPublic', '==', true),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data() as Partial<PublicPlanInfo>;
    return {
      uid: d.id,
      title: data.title ?? '',
      planType: data.planType ?? '',
      timesPlayed: data.timesPlayed ?? 0,
      likesCount: data.likesCount ?? 0,
    };
  });
}

function renderPlans(plans: PublicPlanInfo[]) {
  if (!plans.length) {
    elPlansContainer.innerHTML = '<p class="text-muted">No plans available.</p>';
    return;
  }

  // Group by planType — take the most played of each type
  const byType = new Map<string, PublicPlanInfo>();
  for (const plan of plans) {
    const existing = byType.get(plan.planType);
    if (!existing || plan.timesPlayed > existing.timesPlayed) {
      byType.set(plan.planType, plan);
    }
  }

  const sorted = DEFAULT_PLAN_TYPES
    .map(t => byType.get(t))
    .filter((p): p is PublicPlanInfo => !!p);

  const grid = document.createElement('div');
  grid.className = 'plans-grid';

  for (const plan of sorted) {
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.innerHTML = `
      <span class="plan-type">${PLAN_LABELS[plan.planType] ?? plan.planType}</span>
      <div class="plan-stats">
        <span class="plan-stat">▶ ${plan.timesPlayed.toLocaleString()}</span>
        <span class="plan-stat">♥ ${plan.likesCount.toLocaleString()}</span>
      </div>
    `;
    grid.appendChild(card);
  }

  elPlansContainer.innerHTML = '';
  elPlansContainer.appendChild(grid);
}

async function fetchAndRenderPlans() {
  try {
    const plans = await loadPublicPlans();
    renderPlans(plans);
  } catch {
    elPlansContainer.innerHTML = '<p class="plan-error">Could not load plans.</p>';
  }
}

// ── Auth state observer ────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user: User | null) => {
  const settings = await loadHighlightSettings();
  await buildHighlightsTable(settings);

  if (user) {
    elLoggedOut.style.display = 'none';
    elLoggedIn.style.display = 'block';
    elSignout.style.display = 'inline-flex';
    elUserName.textContent = user.displayName ?? '';
    elUserEmail.textContent = user.email ?? '';

    const elo = await loadUserElo(user.uid);
    if (elo !== null) {
      elUserElo.textContent = String(elo);
      elEloBadge.style.display = 'flex';
    }
  } else {
    elLoggedOut.style.display = 'block';
    elLoggedIn.style.display = 'none';
    elSignout.style.display = 'none';
    elSignin.disabled = false;
  }

  await fetchAndRenderPlans();
});
