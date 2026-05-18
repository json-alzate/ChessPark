export interface UserData {
  uid: string;
  displayName: string | null;
  email: string | null;
  elo: number;
}

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';
export type HighlightKey = `${PieceType}-${PieceColor}`;

export type HighlightSettings = Record<HighlightKey, boolean>;

export const PIECE_TYPES: PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
export const PIECE_COLORS: PieceColor[] = ['white', 'black'];

export function defaultHighlights(): HighlightSettings {
  const s = {} as HighlightSettings;
  for (const type of PIECE_TYPES) {
    for (const color of PIECE_COLORS) {
      s[`${type}-${color}`] = false;
    }
  }
  return s;
}

export interface PublicPlanInfo {
  uid: string;
  title: string;
  planType: string;
  timesPlayed: number;
  likesCount: number;
}

export const DEFAULT_PLAN_TYPES = ['plan1', 'plan3', 'plan5', 'plan10', 'plan20', 'plan30'] as const;

export const PLAN_LABELS: Record<string, string> = {
  plan1: '1 puzzle',
  plan3: '3 puzzles',
  plan5: '5 puzzles',
  plan10: '10 puzzles',
  plan20: '20 puzzles',
  plan30: '30 puzzles',
};

export const PIECE_LABELS: Record<PieceType, string> = {
  pawn: 'Pawns',
  knight: 'Knights',
  bishop: 'Bishops',
  rook: 'Rooks',
  queen: 'Queens',
  king: 'Kings',
};
