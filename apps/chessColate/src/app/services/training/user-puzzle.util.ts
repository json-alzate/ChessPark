import { Plan, Puzzle, UserPuzzle } from '@chesspark/models';

/**
 * Resultado con el que se cierra un ejercicio: resuelto, fallado, o agotó el
 * tiempo del propio ejercicio.
 */
export type PuzzleResult = 'good' | 'bad' | 'timeOut';

/** Datos del entorno que hacen falta para registrar un ejercicio jugado. */
export interface BuildUserPuzzleInput {
  /** Ejercicio que acaba de cerrarse. */
  puzzle: Puzzle;
  /** Cómo se cerró. */
  result: PuzzleResult;
  /** Id nuevo del registro, generado por quien llama. */
  uid: string;
  /** Usuario dueño del registro; vacío si se juega sin sesión. */
  uidUser: string;
  /** Elo del usuario en el momento de resolverlo. */
  currentEloUser: number;
  /** Instante (ms) del cierre. */
  date: number;
}

/**
 * Construye el registro de un ejercicio jugado a partir del puzzle y del resultado.
 * Guarda también el puzzle completo en `rawPuzzle` para no depender de volver a
 * consultarlo después.
 *
 * @returns Registro listo para añadirse a `puzzlesPlayed` del bloque.
 */
export function buildUserPuzzle(input: BuildUserPuzzleInput): UserPuzzle {
  const { puzzle, result } = input;

  return {
    uid: input.uid,
    uidUser: input.uidUser,
    uidPuzzle: puzzle.uid,
    date: input.date,
    resolved: result === 'good',
    failByTime: result === 'timeOut',
    resolvedTime: puzzle.timeUsed ?? 0,
    currentEloUser: input.currentEloUser,
    eloPuzzle: puzzle.rating,
    themes: puzzle.themes,
    openingFamily: puzzle.openingFamily,
    openingVariation: puzzle.openingVariation,
    fenPuzzle: puzzle.fen,
    fenStartUserPuzzle: puzzle.fenStartUserPuzzle,
    firstMoveSquaresHighlight: puzzle.firstMoveSquaresHighlight,
    rawPuzzle: puzzle,
  };
}

/**
 * Devuelve un plan nuevo con el registro añadido al final de `puzzlesPlayed`
 * del bloque indicado. No muta el plan original ni sus bloques.
 *
 * @param plan Plan en curso.
 * @param blockIndex Índice del bloque donde se jugó el ejercicio.
 * @param userPuzzle Registro ya construido con `buildUserPuzzle`.
 * @returns Plan nuevo con el bloque actualizado.
 */
export function addPuzzlePlayedToPlan(
  plan: Plan,
  blockIndex: number,
  userPuzzle: UserPuzzle
): Plan {
  const currentBlock = plan.blocks[blockIndex];
  const updatedBlock = {
    ...currentBlock,
    puzzlesPlayed: [...(currentBlock.puzzlesPlayed ?? []), userPuzzle],
  };

  const newBlocks = [...plan.blocks];
  newBlocks[blockIndex] = updatedBlock;

  return { ...plan, blocks: newBlocks };
}
