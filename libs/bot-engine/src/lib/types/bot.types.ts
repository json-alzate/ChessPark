export interface BotProfile {
  slug: string;
  displayName: string;
  platform: 'lichess' | 'chesscom';
  username: string;
  avatar?: string;
  description?: string;
  estimatedElo: {
    blitz?: number;
    rapid?: number;
    classical?: number;
  };
  trainingStats: {
    gamesUsed: number;
    trainedAt: string;
    pipelineVersion: string;
    topMoveAccuracy: number;
  };
  model: {
    path: string;
    inputShape: [number, number, number];
    outputShape: number;
    sizeBytes?: number;
  };
  openingBook: {
    path: string;
    positions: number;
    maxDepth: number;
  };
}

export interface BotMoveResult {
  move: string;
  source: 'opening_book' | 'neural_network' | 'stockfish_fallback';
  confidence?: number;
}

export enum BotStatus {
  Unloaded = 'unloaded',
  Loading = 'loading',
  Ready = 'ready',
  Thinking = 'thinking',
  Error = 'error',
}

export interface OpeningBookNode {
  [move: string]: {
    count: number;
    wins: number;
    draws: number;
    losses: number;
  };
}

export interface OpeningBook {
  version: number;
  player: string;
  total_games: number;
  tree: Record<string, OpeningBookNode>;
}

export interface BotCatalogEntry {
  slug: string;
  displayName: string;
  platform: 'lichess' | 'chesscom';
  estimatedElo: { blitz?: number; rapid?: number };
  avatar?: string;
  description?: string;
}
