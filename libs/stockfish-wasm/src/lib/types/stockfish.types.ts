/**
 * Resultado de una evaluación de posición por Stockfish
 */
export interface StockfishEvaluation {
  /** Score en centipawns (100 centipawns = 1 peón) */
  score: number;
  /** Profundidad alcanzada en la búsqueda */
  depth: number;
  /** Número de nodos evaluados */
  nodes: number;
  /** Tiempo transcurrido en milisegundos */
  time: number;
  /** Mejor movimiento encontrado en notación UCI (ej: "e2e4") */
  bestMove?: string;
  /** Principal variation - línea de jugadas principales */
  pv?: string[];
  /** Score mate (número de movimientos hasta mate, positivo para blancas, negativo para negras) */
  mate?: number;
}

/**
 * Opciones para análisis de posición
 */
export interface AnalysisOptions {
  /** Profundidad máxima de búsqueda (default: 15) */
  depth?: number;
  /** Límite de tiempo en milisegundos */
  timeLimit?: number;
  /** Límite de nodos a evaluar */
  nodesLimit?: number;
  /** Número de variantes principales a analizar (multiPV) */
  multiPv?: number;
}

/**
 * Configuración del motor Stockfish
 */
export interface StockfishConfig {
  /** Número de threads a usar (default: 1) */
  threads?: number;
  /** Tamaño de hash table en MB (default: 16) */
  hash?: number;
  /** Nivel de habilidad del motor (0-20, default: 20) */
  skillLevel?: number;
  /** Profundidad por defecto para análisis (default: 15) */
  depth?: number;
  /** Ruta al archivo Worker de Stockfish */
  workerPath?: string;
}

/**
 * Estado del motor Stockfish
 */
export enum StockfishStatus {
  /** Motor no inicializado */
  Uninitialized = 'uninitialized',
  /** Motor inicializando */
  Initializing = 'initializing',
  /** Motor listo para usar */
  Ready = 'ready',
  /** Motor analizando */
  Analyzing = 'analyzing',
  /** Motor detenido */
  Stopped = 'stopped',
  /** Motor con error */
  Error = 'error',
}

/**
 * Información de análisis en tiempo real
 */
export interface AnalysisInfo {
  /** Profundidad actual */
  depth: number;
  /** Score en centipawns */
  score: number;
  /** Score mate (si aplica) */
  mate?: number;
  /** Nodos evaluados */
  nodes: number;
  /** Tiempo transcurrido en ms */
  time: number;
  /** Principal variation */
  pv: string[];
  /** Número de variante (si multiPV > 1) */
  multipv?: number;
}

/**
 * Resultado de mejor movimiento
 */
export interface BestMoveResult {
  /** Mejor movimiento en notación UCI */
  move: string;
  /** Movimiento ponderado (respuesta esperada) */
  ponder?: string;
  /** Evaluación de la posición después del movimiento */
  evaluation?: StockfishEvaluation;
}

/**
 * Resultado de análisis de múltiples variantes
 */
export interface MultiPvResult {
  /** Variantes encontradas, ordenadas por score */
  variations: Array<{
    /** Número de variante (1 = mejor) */
    rank: number;
    /** Movimiento principal */
    move: string;
    /** Score en centipawns */
    score: number;
    /** Score mate (si aplica) */
    mate?: number;
    /** Principal variation completa */
    pv: string[];
  }>;
}
