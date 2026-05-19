import { Chess } from 'chess.js';
import { Chessboard, COLOR, INPUT_EVENT_TYPE, BORDER_TYPE } from 'cm-chessboard';

export interface Puzzle {
  fen: string;
  moves: string;
  rating?: number;
}

export const PLAN_PUZZLE_COUNT: Record<string, number> = {
  plan1: 1, plan3: 3, plan5: 5, plan10: 10, plan20: 20, plan30: 30,
};

const THEMES = ['mateIn1', 'fork', 'pin', 'short', 'endgame', 'middlegame', 'mateIn2'];

function normalizeElo(elo: number): number {
  const clamped = Math.max(400, Math.min(2780, elo));
  return Math.floor(clamped / 20) * 20;
}

function buildPuzzleUrl(elo: number, theme: string): string {
  const start = normalizeElo(elo);
  const end = start + 19;
  const letter = theme.charAt(0).toLowerCase();
  const suffix = letter <= 'h' ? 'a-h' : letter <= 'o' ? 'i-o' : 'p-z';
  return (
    `https://cdn.jsdelivr.net/gh/json-alzate/chesscolate-puzzles-files-themes-${suffix}` +
    `@main/puzzlesFilesThemes/${theme}/${theme}_${start}_${end}.json`
  );
}

export async function fetchPuzzles(elo: number, count: number): Promise<Puzzle[]> {
  const shuffled = [...THEMES].sort(() => Math.random() - 0.5);
  for (const theme of shuffled) {
    try {
      const res = await fetch(buildPuzzleUrl(elo, theme));
      if (!res.ok) continue;
      const data = (await res.json()) as Puzzle[];
      if (!Array.isArray(data) || data.length === 0) continue;
      const picked = [...data].sort(() => Math.random() - 0.5).slice(0, count);
      return picked.map(p => ({ fen: p.fen, moves: p.moves, rating: p.rating }));
    } catch { continue; }
  }
  throw new Error('Could not load puzzles — check your connection.');
}

// Converts a UCI move string ("e2e4" or "e7e8q") to a chess.js move object.
// Only includes `promotion` when the move string has a 5th character to avoid
// chess.js v1.x throwing on normal moves that receive an unwanted promotion field.
function uciToMove(uci: string): { from: string; to: string; promotion?: string } {
  const base = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  return uci.length > 4 ? { ...base, promotion: uci[4] } : base;
}

// Pre-fetch the SVG sprite and inject it before creating the board so that
// cm-chessboard's own XHR is skipped and pieces are visible from the first render.
async function preloadSprite(assetsUrl: string): Promise<void> {
  const SPRITE_ID = 'cm-chessboard-sprite';
  if (document.getElementById(SPRITE_ID)) return;
  const res = await fetch(assetsUrl + 'pieces/standard.svg');
  const svg = await res.text();
  const wrapper = document.createElement('div');
  wrapper.style.transform = 'scale(0)';
  wrapper.style.position = 'absolute';
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.id = SPRITE_ID;
  wrapper.insertAdjacentHTML('afterbegin', svg);
  document.body.appendChild(wrapper);
}

// ─── Trainer ─────────────────────────────────────────────────────────────────
export class Trainer {
  private board: InstanceType<typeof Chessboard> | null = null;
  private chess!: InstanceType<typeof Chess>;
  private puzzles: Puzzle[] = [];
  private currentIdx = 0;
  private solutionMoves: string[] = [];
  private currentMoveIdx = 0;
  private solvedCount = 0;

  constructor(
    private readonly boardEl: HTMLElement,
    private readonly onStatus: (s: 'correct' | 'wrong' | '') => void,
    private readonly onProgress: (current: number, total: number) => void,
    private readonly onDone: (solved: number, total: number) => void,
  ) {}

  async start(puzzles: Puzzle[], assetsUrl: string): Promise<void> {
    this.puzzles = puzzles;
    this.currentIdx = 0;
    this.solvedCount = 0;

    await preloadSprite(assetsUrl);

    this.boardEl.innerHTML = ''; // clear stale DOM from any previous board

    this.board = new Chessboard(this.boardEl, {
      position: '8/8/8/8/8/8/8/8',
      assetsUrl,
      assetsCache: true,
      style: {
        cssClass: 'default',
        showCoordinates: true,
        borderType: BORDER_TYPE.none,
        pieces: { type: 'svgSprite', file: 'pieces/standard.svg', tileSize: 40 },
        animationDuration: 200,
      },
    });

    // Give the ResizeObserver a tick to measure the container before rendering
    await new Promise(resolve => setTimeout(resolve, 50));
    await this.loadPuzzle();
  }

  private async loadPuzzle(): Promise<void> {
    const puzzle = this.puzzles[this.currentIdx];
    this.chess = new Chess(puzzle.fen);
    this.solutionMoves = puzzle.moves.trim().split(/\s+/);
    this.currentMoveIdx = 0;
    this.onProgress(this.currentIdx + 1, this.puzzles.length);
    this.onStatus('');

    // Auto-play the first move (opponent's setup move before the puzzle starts)
    this.chess.move(uciToMove(this.solutionMoves[0]));

    const userColor = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;
    await this.board!.setOrientation(userColor, false);
    await this.board!.setPosition(this.chess.fen(), false);
    this.currentMoveIdx = 1;

    setTimeout(() => {
      this.board?.enableMoveInput(this.handleInput.bind(this), userColor);
    }, 400);
  }

  private handleInput(event: Record<string, unknown>): boolean {
    if (event['type'] === INPUT_EVENT_TYPE.moveInputStarted) return true;
    if (event['type'] !== INPUT_EVENT_TYPE.validateMoveInput) return false;
    if (this.currentMoveIdx >= this.solutionMoves.length) return false;

    const from = event['squareFrom'] as string;
    const to = event['squareTo'] as string;
    const expected = this.solutionMoves[this.currentMoveIdx];

    if (from === expected.slice(0, 2) && to === expected.slice(2, 4)) {
      this.chess.move(uciToMove(expected));
      this.board!.disableMoveInput();
      this.currentMoveIdx++;
      this.onStatus('correct');

      if (this.currentMoveIdx >= this.solutionMoves.length) {
        this.solvedCount++;
        setTimeout(() => this.advance(), 1200);
      } else {
        setTimeout(() => this.opponentMove(), 600);
      }
      return true;
    } else {
      this.onStatus('wrong');
      setTimeout(() => {
        this.onStatus('');
        const color = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;
        this.board?.enableMoveInput(this.handleInput.bind(this), color);
      }, 900);
      return false;
    }
  }

  private opponentMove(): void {
    const move = this.solutionMoves[this.currentMoveIdx];
    this.chess.move(uciToMove(move));
    this.currentMoveIdx++;

    this.board!.setPosition(this.chess.fen(), true).then(() => {
      if (this.currentMoveIdx >= this.solutionMoves.length) {
        this.solvedCount++;
        setTimeout(() => this.advance(), 1200);
      } else {
        this.onStatus('');
        const color = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;
        this.board?.enableMoveInput(this.handleInput.bind(this), color);
      }
    });
  }

  private advance(): void {
    this.currentIdx++;
    if (this.currentIdx >= this.puzzles.length) {
      this.destroy();
      this.onDone(this.solvedCount, this.puzzles.length);
    } else {
      this.loadPuzzle();
    }
  }

  destroy(): void {
    this.board?.destroy();
    this.board = null;
  }
}
