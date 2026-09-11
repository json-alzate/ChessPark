// Archivo local de partidas
export { GamesArchive, createGamesArchive } from './lib/games-archive';
export { ArchiveCacheService } from './lib/archive-cache.service';

// Filtros
export { applyFilters } from './lib/filters';

// Reportes
export {
  getRatingProgress,
  getGeneralStats,
  getOpeningStats,
  getActivityHeatmap,
  toDayKey,
} from './lib/reports';

// Mapa de calor de las piezas de una partida
export { getPieceHeatmap } from './lib/piece-heatmap';
export type {
  PieceColor,
  PieceKind,
  PieceHeatmap,
  TrackedPiece,
} from './lib/piece-heatmap';

// Valoración de las piezas de una partida
export {
  reviewGame,
  winChance,
  engineEvalForWhite,
  terminalEval,
  moveAccuracy,
  classifyMove,
  ratingFromAccuracies,
} from './lib/piece-ratings';
export type {
  PositionEval,
  MoveClassification,
  MoveReview,
  PieceRating,
  GameReview,
} from './lib/piece-ratings';

// Tipos
export type {
  GamesSource,
  CachedArchiveMonth,
  ConnectedAccount,
  SyncProgress,
  SyncResult,
  ReportFilters,
  RatingDataPoint,
  RecordBreakdown,
  GeneralStats,
  OpeningStats,
  ActivityDay,
  ArchiveStorageSummary,
  AccountStorageSummary,
} from './lib/types';
