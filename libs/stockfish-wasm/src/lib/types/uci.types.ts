/**
 * Tipos relacionados con el protocolo UCI (Universal Chess Interface)
 */

/**
 * Comandos UCI estándar que se pueden enviar a Stockfish
 */
export enum UCICommand {
  /** Inicializar el motor UCI */
  UCI = 'uci',
  /** Verificar si el motor está listo */
  IsReady = 'isready',
  /** Configurar posición */
  Position = 'position',
  /** Iniciar análisis/búsqueda */
  Go = 'go',
  /** Detener análisis */
  Stop = 'stop',
  /** Salir del motor */
  Quit = 'quit',
  /** Configurar opción del motor */
  SetOption = 'setoption',
  /** Nueva partida */
  UciNewGame = 'ucinewgame',
}

/**
 * Opciones UCI configurables
 */
export enum UCIOption {
  /** Número de threads */
  Threads = 'Threads',
  /** Tamaño de hash */
  Hash = 'Hash',
  /** Nivel de habilidad */
  SkillLevel = 'Skill Level',
  /** Profundidad */
  Depth = 'Depth',
}

/**
 * Respuestas UCI del motor
 */
export enum UCIResponse {
  /** Identificación del motor */
  Id = 'id',
  /** Opción disponible */
  Option = 'option',
  /** Motor listo */
  ReadyOk = 'readyok',
  /** Información de análisis */
  Info = 'info',
  /** Mejor movimiento */
  BestMove = 'bestmove',
  /** Error */
  Error = 'error',
}

/**
 * Parser para mensajes UCI de tipo 'info'
 */
export interface UCIInfoMessage {
  /** Profundidad */
  depth?: number;
  /** Score en centipawns */
  score?: {
    cp?: number;
    mate?: number;
  };
  /** Nodos evaluados */
  nodes?: number;
  /** Tiempo en ms */
  time?: number;
  /** Principal variation */
  pv?: string[];
  /** Número de variante (multiPV) */
  multipv?: number;
  /** Nodos por segundo */
  nps?: number;
  /** Hashfull (porcentaje de hash usado) */
  hashfull?: number;
  /** Tiempo restante en ms */
  tbhits?: number;
}

/**
 * Parser para mensaje 'bestmove'
 */
export interface UCIBestMoveMessage {
  /** Mejor movimiento */
  move: string;
  /** Movimiento ponderado */
  ponder?: string;
}
