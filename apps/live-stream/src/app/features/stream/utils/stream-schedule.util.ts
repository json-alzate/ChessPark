import { ProgramBlock } from '@features/stream/config/stream-program.config';

export interface ScheduledBlock {
  block: ProgramBlock;
  /** Posición del bloque dentro del programa. */
  index: number;
  startsAtMs: number;
  endsAtMs: number;
}

/**
 * Qué bloque toca en un instante, calculado solo a partir de la hora.
 *
 * No guarda estado: si el runner se reinicia retoma el bloque correcto en vez de empezar de
 * cero. El programa se recorre en bucle.
 */
export function blockAt(nowMs: number, program: readonly ProgramBlock[], blockMs: number): ScheduledBlock {
  if (program.length === 0) {
    throw new Error('El programa de temas está vacío');
  }
  const slot = Math.floor(nowMs / blockMs);
  const index = slot % program.length;
  return { block: program[index], index, startsAtMs: slot * blockMs, endsAtMs: (slot + 1) * blockMs };
}

/** Milisegundos que faltan para que cambie el tema. */
export function msUntilNextBlock(nowMs: number, blockMs: number): number {
  return blockMs - (nowMs % blockMs);
}
