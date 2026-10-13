import { ProgramBlock } from '@features/stream/config/stream-program.config';
import { blockAt, msUntilNextBlock } from '@features/stream/utils/stream-schedule.util';

const block = (theme: string): ProgramBlock => ({ theme, label: theme, eloMin: 400, eloMax: 800 });
const PROGRAM = [block('a'), block('b'), block('c')];
const BLOCK_MS = 60_000;

describe('blockAt', () => {
  it('elige el bloque según la hora y recorre el programa en bucle', () => {
    expect(blockAt(0, PROGRAM, BLOCK_MS).block.theme).toBe('a');
    expect(blockAt(BLOCK_MS, PROGRAM, BLOCK_MS).block.theme).toBe('b');
    expect(blockAt(2 * BLOCK_MS, PROGRAM, BLOCK_MS).block.theme).toBe('c');
    expect(blockAt(3 * BLOCK_MS, PROGRAM, BLOCK_MS).block.theme).toBe('a');
  });

  it('depende solo de la hora: un reinicio retoma el mismo bloque', () => {
    const now = 7 * BLOCK_MS + 12_345;
    expect(blockAt(now, PROGRAM, BLOCK_MS)).toEqual(blockAt(now, PROGRAM, BLOCK_MS));
  });

  it('da el inicio y el fin del bloque', () => {
    const scheduled = blockAt(BLOCK_MS + 5_000, PROGRAM, BLOCK_MS);

    expect(scheduled.startsAtMs).toBe(BLOCK_MS);
    expect(scheduled.endsAtMs).toBe(2 * BLOCK_MS);
  });

  it('lanza si el programa está vacío', () => {
    expect(() => blockAt(0, [], BLOCK_MS)).toThrow();
  });
});

describe('msUntilNextBlock', () => {
  it('cuenta lo que falta para el siguiente bloque', () => {
    expect(msUntilNextBlock(BLOCK_MS + 15_000, BLOCK_MS)).toBe(45_000);
  });

  it('justo al empezar un bloque falta el bloque entero', () => {
    expect(msUntilNextBlock(2 * BLOCK_MS, BLOCK_MS)).toBe(BLOCK_MS);
  });
});
