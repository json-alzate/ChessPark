import { Chess } from 'chess.js';
import { Chessboard, COLOR, INPUT_EVENT_TYPE, BORDER_TYPE } from 'cm-chessboard';
import { Markers, MARKER_TYPE } from 'cm-chessboard/src/extensions/markers/Markers.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrainingBlock {
  time: number;       // total seconds for the block
  theme: string;
  elo: number;
  puzzleTime: number; // seconds allowed per puzzle
  label: string;      // display name shown in block presentation
}

interface Puzzle {
  fen: string;
  moves: string;
}

export interface TrainerCallbacks {
  /** Called before each block; panel shows presentation, resolves when dismissed */
  onBlockStart: (block: TrainingBlock, idx: number, total: number) => Promise<void>;
  /** Called when the first puzzle of a block is ready on the board */
  onPuzzleReady: () => void;
  /** Block countdown tick */
  onBlockTime: (secondsLeft: number) => void;
  /** Puzzle countdown tick */
  onPuzzleTime: (secondsLeft: number, total: number) => void;
  /** Feedback after each move/timeout */
  onStatus: (s: 'correct' | 'wrong' | 'timeout' | '') => void;
  /** Called after each puzzle with the updated ELO */
  onEloUpdate: (newElo: number) => void;
  /** Called to play a sound */
  onSound: (type: 'move' | 'capture' | 'castle' | 'check' | 'correct' | 'wrong' | 'timeout') => void;
  /** Session finished */
  onDone: (solved: number, total: number) => void;
}

// ─── Theme helpers ────────────────────────────────────────────────────────────

const RANDOM_THEMES = [
  'fork', 'pin', 'skewer', 'sacrifice', 'discoveredAttack',
  'hangingPiece', 'mateIn2', 'endgame', 'middlegame',
  'capturingDefender', 'deflection', 'attraction', 'backRankMate',
];

export const THEME_LABELS: Record<string, string> = {
  fork: 'Fork', pin: 'Pin', skewer: 'Skewer',
  mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mate: 'Mate',
  endgame: 'Endgame', pawnEndgame: 'Pawn Endgame', rookEndgame: 'Rook Endgame',
  sacrifice: 'Sacrifice', discoveredAttack: 'Discovered Attack',
  hangingPiece: 'Hanging Piece', short: 'Short', long: 'Long',
  middlegame: 'Middlegame', capturingDefender: 'Capturing Defender',
  backRankMate: 'Back Rank', deflection: 'Deflection', attraction: 'Attraction',
};

function pick(pool: string[], exclude: string[] = []): string {
  const available = pool.filter(t => !exclude.includes(t));
  return available[Math.floor(Math.random() * available.length)] ?? pool[0];
}

function label(theme: string): string {
  return THEME_LABELS[theme] ?? theme;
}

// ─── Block generation ─────────────────────────────────────────────────────────

export function generateBlocks(planType: string, elo: number): TrainingBlock[] {
  switch (planType) {
    case 'plan1':
      return [
        { time: 60, theme: 'short', elo, puzzleTime: 10, label: 'Speed' },
      ];

    case 'plan3': {
      const t = pick(RANDOM_THEMES);
      return [
        { time: 180, theme: t, elo, puzzleTime: 20, label: label(t) },
      ];
    }

    case 'plan5': {
      const t1 = pick(RANDOM_THEMES);
      const t2 = pick(RANDOM_THEMES, [t1]);
      return [
        { time: 150, theme: t1, elo, puzzleTime: 15, label: label(t1) },
        { time: 150, theme: t2, elo, puzzleTime: 30, label: label(t2) },
      ];
    }

    case 'plan10': {
      const t1 = pick(RANDOM_THEMES);
      const t2 = pick(RANDOM_THEMES, [t1]);
      const t3 = pick(RANDOM_THEMES, [t1, t2]);
      return [
        { time: 120, theme: t1,       elo, puzzleTime: 20, label: 'Warmup' },
        { time: 180, theme: t2,       elo, puzzleTime: 30, label: 'Intensity' },
        { time: 120, theme: 'mateIn1',elo, puzzleTime: 10, label: 'Speed' },
        { time: 180, theme: t3,       elo, puzzleTime: 60, label: 'Challenge' },
      ];
    }

    case 'plan20': {
      const t1 = pick(RANDOM_THEMES);
      const t2 = pick(RANDOM_THEMES, [t1]);
      const t3 = pick(RANDOM_THEMES, [t1, t2]);
      const t4 = pick(RANDOM_THEMES, [t1, t2, t3]);
      return [
        { time: 180, theme: t1,       elo, puzzleTime: 25, label: 'Warmup' },
        { time: 240, theme: t2,       elo, puzzleTime: 30, label: 'Intensity' },
        { time: 120, theme: 'mateIn1',elo, puzzleTime: 10, label: 'Speed' },
        { time: 300, theme: t3,       elo, puzzleTime: 60, label: 'Peak' },
        { time: 180, theme: t4,       elo, puzzleTime: 20, label: 'Challenge' },
        { time: 180, theme: 'endgame',elo, puzzleTime: 50, label: 'Cooldown' },
      ];
    }

    case 'plan30': {
      const t1 = pick(RANDOM_THEMES);
      const t2 = pick(RANDOM_THEMES, [t1]);
      const t3 = pick(RANDOM_THEMES, [t1, t2]);
      const t4 = pick(RANDOM_THEMES, [t1, t2, t3]);
      const t5 = pick(RANDOM_THEMES, [t1, t2, t3, t4]);
      return [
        { time: 240, theme: t1,       elo, puzzleTime: 30, label: 'Warmup' },
        { time: 360, theme: t2,       elo, puzzleTime: 60, label: 'Intensity' },
        { time: 180, theme: t3,       elo, puzzleTime: 20, label: 'Speed' },
        { time: 480, theme: t4,       elo, puzzleTime: 90, label: 'Peak' },
        { time: 240, theme: t5,       elo, puzzleTime: 15, label: 'Challenge' },
        { time: 300, theme: 'endgame',elo, puzzleTime: 60, label: 'Cooldown' },
      ];
    }

    default:
      return [{ time: 60, theme: 'short', elo, puzzleTime: 10, label: 'Puzzles' }];
  }
}

// ─── CDN fetch ────────────────────────────────────────────────────────────────

function normalizeElo(elo: number): number {
  return Math.floor(Math.max(400, Math.min(2780, elo)) / 20) * 20;
}

async function fetchPuzzlesForBlock(theme: string, elo: number): Promise<Puzzle[]> {
  const start = normalizeElo(elo);
  const end = start + 19;
  const letter = theme.charAt(0).toLowerCase();
  const suffix = letter <= 'h' ? 'a-h' : letter <= 'o' ? 'i-o' : 'p-z';
  const url =
    `https://cdn.jsdelivr.net/gh/json-alzate/chesscolate-puzzles-files-themes-${suffix}` +
    `@main/puzzlesFilesThemes/${theme}/${theme}_${start}_${end}.json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = (await res.json()) as Puzzle[];
    if (!Array.isArray(data) || data.length === 0) throw new Error();
    return [...data].sort(() => Math.random() - 0.5);
  } catch {
    if (theme !== 'mateIn1') return fetchPuzzlesForBlock('mateIn1', elo);
    return [];
  }
}

// ─── Move sound type ──────────────────────────────────────────────────────────

type SoundType = 'move' | 'capture' | 'castle' | 'check' | 'correct' | 'wrong' | 'timeout';

function moveSoundType(chess: InstanceType<typeof Chess>): SoundType {
  const move = chess.history({ verbose: true }).slice(-1)[0];
  if (!move) return 'move';
  if (chess.isCheckmate()) return 'correct';
  if (chess.inCheck()) return 'check';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  if (move.flags.includes('c') || move.flags.includes('e')) return 'capture';
  return 'move';
}

// ─── ELO calculator (K=32, standard formula) ─────────────────────────────────

function calcElo(playerElo: number, puzzleElo: number, result: 0 | 1): number {
  const expected = 1 / (1 + Math.pow(10, (puzzleElo - playerElo) / 400));
  return Math.round(playerElo + 32 * (result - expected));
}

// ─── UCI → chess.js ──────────────────────────────────────────────────────────

function uciToMove(uci: string) {
  const base = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
  return uci.length > 4 ? { ...base, promotion: uci[4] } : base;
}

// ─── Sprite preload ───────────────────────────────────────────────────────────

async function preloadSprite(assetsUrl: string): Promise<void> {
  const ID = 'cm-chessboard-sprite';
  if (document.getElementById(ID)) return;
  const res = await fetch(assetsUrl + 'pieces/standard.svg');
  const svg = await res.text();
  const div = document.createElement('div');
  div.style.cssText = 'transform:scale(0);position:absolute';
  div.setAttribute('aria-hidden', 'true');
  div.id = ID;
  div.insertAdjacentHTML('afterbegin', svg);
  document.body.appendChild(div);
}

// ─── Trainer ─────────────────────────────────────────────────────────────────

export class Trainer {
  private board: InstanceType<typeof Chessboard> | null = null;
  private chess!: InstanceType<typeof Chess>;
  private destroyed = false;

  private blocks: TrainingBlock[] = [];
  private currentBlockIdx = 0;
  private puzzles: Puzzle[] = [];
  private currentPuzzleIdx = 0;
  private solutionMoves: string[] = [];
  private currentMoveIdx = 0;

  private blockInterval: ReturnType<typeof setInterval> | null = null;
  private puzzleInterval: ReturnType<typeof setInterval> | null = null;
  private blockTimeLeft = 0;
  private currentPuzzleTime = 0;

  private solvedCount = 0;
  private totalAttempted = 0;
  private firstPuzzleInBlock = true;
  private currentElo = 1500;

  // Incremented on each new puzzle/block to invalidate stale async callbacks
  private epoch = 0;

  constructor(
    private readonly boardEl: HTMLElement,
    private readonly cbs: TrainerCallbacks,
  ) {}

  async start(blocks: TrainingBlock[], assetsUrl: string): Promise<void> {
    this.blocks = blocks;
    this.currentElo = blocks[0]?.elo ?? 1500;

    await preloadSprite(assetsUrl);
    this.boardEl.innerHTML = '';

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
      extensions: [{ class: Markers, props: { autoMarkers: null } }],
    });

    await new Promise(r => setTimeout(r, 50));
    await this.startBlock();
  }

  // ── Block lifecycle ─────────────────────────────────────────────────────────

  private async startBlock(): Promise<void> {
    if (this.destroyed) return;
    if (this.currentBlockIdx >= this.blocks.length) { this.finish(); return; }

    this.epoch++; // invalidate any pending puzzle callbacks from previous block
    const block = this.blocks[this.currentBlockIdx];
    this.firstPuzzleInBlock = true;

    // Fetch puzzles and show presentation simultaneously
    const [puzzles] = await Promise.all([
      fetchPuzzlesForBlock(block.theme, block.elo),
      this.cbs.onBlockStart(block, this.currentBlockIdx, this.blocks.length),
    ]);

    if (this.destroyed) return;

    this.puzzles = puzzles;
    this.currentPuzzleIdx = 0;

    if (puzzles.length === 0) {
      this.currentBlockIdx++;
      await this.startBlock();
      return;
    }

    this.startBlockTimer(block.time);
    await this.loadPuzzle();
  }

  private startBlockTimer(seconds: number): void {
    this.clearBlockTimer();
    this.blockTimeLeft = seconds;
    this.cbs.onBlockTime(this.blockTimeLeft);
    this.blockInterval = setInterval(() => {
      if (this.destroyed) { this.clearBlockTimer(); return; }
      this.blockTimeLeft--;
      this.cbs.onBlockTime(this.blockTimeLeft);
      if (this.blockTimeLeft <= 0) {
        this.clearBlockTimer();
        this.clearPuzzleTimer();
        this.board?.disableMoveInput();
        this.currentBlockIdx++;
        this.startBlock();
      }
    }, 1000);
  }

  private clearBlockTimer(): void {
    if (this.blockInterval) { clearInterval(this.blockInterval); this.blockInterval = null; }
  }

  private pauseBlockTimer(): void {
    if (this.blockInterval) { clearInterval(this.blockInterval); this.blockInterval = null; }
  }

  private resumeBlockTimer(): void {
    if (this.blockTimeLeft <= 0 || this.blockInterval) return;
    this.blockInterval = setInterval(() => {
      if (this.destroyed) { this.clearBlockTimer(); return; }
      this.blockTimeLeft--;
      this.cbs.onBlockTime(this.blockTimeLeft);
      if (this.blockTimeLeft <= 0) {
        this.clearBlockTimer();
        this.clearPuzzleTimer();
        this.board?.disableMoveInput();
        this.currentBlockIdx++;
        this.startBlock();
      }
    }, 1000);
  }

  // ── Puzzle lifecycle ────────────────────────────────────────────────────────

  private async loadPuzzle(): Promise<void> {
    if (this.destroyed) return;
    const epoch = ++this.epoch; // capture epoch for this puzzle's callbacks

    // Clean up any lingering markers from the previous puzzle
    (this.board as any).removeMarkers?.();

    // Refill when exhausted
    if (this.currentPuzzleIdx >= this.puzzles.length) {
      const block = this.blocks[this.currentBlockIdx];
      const more = await fetchPuzzlesForBlock(block.theme, block.elo);
      if (this.destroyed || this.epoch !== epoch) return;
      if (more.length === 0) return; // wait for block timer
      this.puzzles = more;
      this.currentPuzzleIdx = 0;
    }

    const puzzle = this.puzzles[this.currentPuzzleIdx];
    this.chess = new Chess(puzzle.fen);
    this.solutionMoves = puzzle.moves.trim().split(/\s+/);
    this.currentMoveIdx = 0;
    this.cbs.onStatus('');

    // Auto-play opponent's first move
    this.chess.move(uciToMove(this.solutionMoves[0]));
    const userColor = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;

    await this.board!.setOrientation(userColor, false);
    await this.board!.setPosition(this.chess.fen(), false);
    if (this.destroyed || this.epoch !== epoch) return;

    // Signal panel to show the board area (only needed on first puzzle of each block)
    if (this.firstPuzzleInBlock) {
      this.firstPuzzleInBlock = false;
      this.cbs.onPuzzleReady();
    }

    this.currentMoveIdx = 1;
    const block = this.blocks[this.currentBlockIdx];
    this.currentPuzzleTime = block.puzzleTime;
    this.startPuzzleTimer(this.currentPuzzleTime);

    setTimeout(() => {
      if (!this.destroyed && this.epoch === epoch) {
        this.board?.enableMoveInput(this.handleInput.bind(this), userColor);
      }
    }, 300);
  }

  private startPuzzleTimer(seconds: number): void {
    this.clearPuzzleTimer();
    const epoch = this.epoch;
    this.cbs.onPuzzleTime(seconds, seconds);
    this.puzzleInterval = setInterval(() => {
      if (this.destroyed || this.epoch !== epoch) { this.clearPuzzleTimer(); return; }
      seconds--;
      this.cbs.onPuzzleTime(seconds, this.currentPuzzleTime);
      if (seconds <= 0) {
        this.clearPuzzleTimer();
        this.board?.disableMoveInput();
        const preFen = this.chess.fen();
        this.cbs.onSound('timeout');
        this.cbs.onStatus('timeout');
        this.totalAttempted++;
        this.applyElo(0);
        setTimeout(() => { if (!this.destroyed && this.epoch === epoch) this.showSolution(preFen, epoch); }, 800);
      }
    }, 1000);
  }

  private clearPuzzleTimer(): void {
    if (this.puzzleInterval) { clearInterval(this.puzzleInterval); this.puzzleInterval = null; }
  }

  // ── Move handling ───────────────────────────────────────────────────────────

  private handleInput(event: Record<string, unknown>): boolean {
    if (event['type'] === INPUT_EVENT_TYPE.moveInputStarted) {
      (this.board as any).removeMarkers();
      const square = event['squareFrom'] as string;
      const moves = this.chess.moves({ square, verbose: true });
      (this.board as any).addLegalMovesMarkers(moves);
      (this.board as any).addMarker(MARKER_TYPE.frame, square);
      return true;
    }

    // Clean up markers when piece is deselected or move cycle ends
    if (event['type'] === INPUT_EVENT_TYPE.moveInputCanceled ||
        event['type'] === INPUT_EVENT_TYPE.moveInputFinished) {
      (this.board as any).removeMarkers();
      return true;
    }

    if (event['type'] !== INPUT_EVENT_TYPE.validateMoveInput) return false;
    if (this.currentMoveIdx >= this.solutionMoves.length) return false;

    (this.board as any).removeMarkers();

    const from = event['squareFrom'] as string;
    const to   = event['squareTo']   as string;
    const expected = this.solutionMoves[this.currentMoveIdx];

    if (from === expected.slice(0, 2) && to === expected.slice(2, 4)) {
      this.chess.move(uciToMove(expected));
      this.currentMoveIdx++;
      const epoch = this.epoch;

      // Disable input outside the callback to avoid disrupting the state machine
      setTimeout(() => { if (!this.destroyed && this.epoch === epoch) this.board?.disableMoveInput(); }, 0);

      if (this.currentMoveIdx >= this.solutionMoves.length) {
        this.clearPuzzleTimer();
        this.cbs.onSound('correct');
        this.cbs.onStatus('correct');
        this.solvedCount++;
        this.totalAttempted++;
        this.applyElo(1);
        setTimeout(() => { if (!this.destroyed && this.epoch === epoch) this.advancePuzzle(); }, 1000);
      } else {
        this.cbs.onSound(moveSoundType(this.chess));
        setTimeout(() => { if (!this.destroyed && this.epoch === epoch) this.opponentMove(); }, 500);
      }
      return true;
    }

    // Check legality — illegal moves (including wrong-square drops) are silently rejected
    let testMove: ReturnType<typeof this.chess.move> | null = null;
    try { testMove = this.chess.move({ from, to }); } catch { /* promotion without piece specified */ }
    if (!testMove) return false;
    this.chess.undo();

    // Legal but wrong move — animate it on the board, then show the correct solution
    const preFen = this.chess.fen();
    this.clearPuzzleTimer();
    const epoch = this.epoch;

    this.chess.move({ from, to }); // apply so board reflects the wrong move position

    setTimeout(() => {
      if (this.destroyed || this.epoch !== epoch) return;
      this.board?.disableMoveInput();
      this.cbs.onSound('wrong');
      this.cbs.onStatus('wrong');
      this.totalAttempted++;
      this.applyElo(0);
    }, 0);

    setTimeout(() => {
      if (this.destroyed || this.epoch !== epoch) return;
      this.showSolution(preFen, epoch);
    }, 1000);

    return true; // let cm-chessboard animate the piece to the destination
  }

  // Animate the remaining correct solution moves, then advance to next puzzle
  private async showSolution(preFen: string, epoch: number): Promise<void> {
    if (this.destroyed || this.epoch !== epoch) return;

    this.pauseBlockTimer(); // don't count solution time against the block

    this.chess = new Chess(preFen);
    await this.board!.setPosition(preFen, false);

    for (let i = this.currentMoveIdx; i < this.solutionMoves.length; i++) {
      await new Promise<void>(r => setTimeout(r, 500));
      if (this.destroyed || this.epoch !== epoch) return;
      this.chess.move(uciToMove(this.solutionMoves[i]));
      await this.board!.setPosition(this.chess.fen(), true);
      if (this.destroyed || this.epoch !== epoch) return;
    }

    await new Promise<void>(r => setTimeout(r, 600));
    if (this.destroyed || this.epoch !== epoch) return;

    this.resumeBlockTimer();
    this.advancePuzzle();
  }

  private opponentMove(): void {
    const epoch = this.epoch; // capture before async work
    const move = this.solutionMoves[this.currentMoveIdx];
    this.chess.move(uciToMove(move));
    this.currentMoveIdx++;

    this.board!.setPosition(this.chess.fen(), true).then(() => {
      if (this.destroyed || this.epoch !== epoch) return;
      this.cbs.onSound(moveSoundType(this.chess));
      if (this.currentMoveIdx >= this.solutionMoves.length) {
        this.clearPuzzleTimer();
        this.cbs.onSound('correct');
        this.cbs.onStatus('correct');
        this.solvedCount++;
        this.totalAttempted++;
        this.applyElo(1);
        setTimeout(() => { if (!this.destroyed && this.epoch === epoch) this.advancePuzzle(); }, 1000);
      } else {
        const color = this.chess.turn() === 'w' ? COLOR.white : COLOR.black;
        this.board?.enableMoveInput(this.handleInput.bind(this), color);
      }
    });
  }

  private applyElo(result: 0 | 1): void {
    const block = this.blocks[this.currentBlockIdx];
    if (!block) return;
    const newElo = calcElo(this.currentElo, block.elo + 10, result);
    this.currentElo = newElo;
    block.elo = normalizeElo(newElo);
    this.cbs.onEloUpdate(newElo);
  }

  private advancePuzzle(): void {
    this.currentPuzzleIdx++;
    this.cbs.onStatus('');
    this.loadPuzzle();
  }

  private finish(): void {
    this.clearBlockTimer();
    this.clearPuzzleTimer();
    this.board?.destroy();
    this.board = null;
    this.cbs.onDone(this.solvedCount, this.totalAttempted);
  }

  destroy(): void {
    this.destroyed = true;
    this.clearBlockTimer();
    this.clearPuzzleTimer();
    this.board?.destroy();
    this.board = null;
  }
}
