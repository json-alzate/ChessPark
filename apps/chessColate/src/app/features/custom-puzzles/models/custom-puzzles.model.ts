import { Puzzle } from '@chesspark/models';

/**
 * Ejercicios propios que el usuario trae en un archivo PGN. Los tipos son de
 * esta funcionalidad: cualquier pantalla que quiera ejercicios propios los
 * recibe ya convertidos en `Puzzle`.
 */

/** Por qué un ejercicio del archivo no entró. */
export type PgnIssueCode =
  /** La posición `[FEN]` no se entiende. */
  | 'invalid-fen'
  /** El ejercicio no trae jugadas. */
  | 'no-moves'
  /** Con una sola jugada no hay «arranque del rival + solución». */
  | 'too-short'
  /** Una jugada no es legal en su posición. */
  | 'illegal-move'
  /** El texto de las jugadas no se pudo interpretar. */
  | 'unreadable'
  /** Igual que otro ejercicio anterior del archivo (misma posición y jugadas). */
  | 'duplicate';

/** Un ejercicio que no entró, con lo mínimo para que el usuario lo encuentre en su archivo. */
export interface PgnIssue {
  /** Posición del ejercicio en el archivo, desde 1. */
  index: number;
  /** Su `[Event]`, o vacío si no lo tiene. */
  title: string;
  code: PgnIssueCode;
  /** Solo en `illegal-move`: la jugada que falló, tal como está escrita en el archivo. */
  move?: string;
}

/** Lo que se hizo con un ejercicio aunque entrara, que el usuario debería saber. */
export type PgnNoteCode =
  /** La línea acababa en una jugada del rival y se quitó (el ejercicio termina en la tuya). */
  | 'trailing-opponent-move-dropped'
  /** No traía `[FEN]` y se tomó la posición inicial. */
  | 'no-fen';

export interface PgnNote {
  index: number;
  title: string;
  code: PgnNoteCode;
}

/** Resultado de leer un archivo: los ejercicios válidos y un informe tolerante a fallos. */
export interface PgnImportResult {
  puzzles: Puzzle[];
  /** Ejercicios que había en el archivo (válidos o no). */
  total: number;
  issues: PgnIssue[];
  notes: PgnNote[];
}

/** Por qué no se pudo leer el archivo entero. */
export type PgnImportFailure =
  | 'empty'
  | 'too-big'
  | 'not-text'
  | 'no-exercises'
  | 'unreadable';
