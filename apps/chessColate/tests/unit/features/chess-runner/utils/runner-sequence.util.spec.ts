import { MAX_OBSTACLES, MAX_PER_KIND } from '@features/chess-runner/config/runner.config';
import { RunnerPiece } from '@features/chess-runner/models/runner.model';
import {
  buildRunnerSequence,
  chooseObstacles,
  hashString,
  piecesOfFen,
  seededRandom,
  spriteName,
} from '@features/chess-runner/utils/runner-sequence.util';

const INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FINAL_DE_PEONES = '8/5p2/8/8/8/3K4/3P4/8 w - - 0 1';
const MEDIO = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

const contar = (piezas: RunnerPiece[], kind: string) => piezas.filter((p) => p.kind === kind).length;

describe('piecesOfFen', () => {
  it('lee cada pieza con su tipo y su bando', () => {
    const piezas = piecesOfFen(FINAL_DE_PEONES);

    expect(piezas).toEqual([
      { kind: 'pawn', color: 'b' },
      { kind: 'king', color: 'w' },
      { kind: 'pawn', color: 'w' },
    ]);
  });

  it('en la posición inicial hay 32 piezas', () => {
    expect(piecesOfFen(INICIAL)).toHaveLength(32);
  });

  it('ignora los campos de después del tablero y los huecos', () => {
    expect(piecesOfFen('8/8/8/8/8/8/8/8 w - - 0 1')).toEqual([]);
  });

  it('un FEN vacío o roto no lanza', () => {
    expect(piecesOfFen('')).toEqual([]);
    expect(piecesOfFen('xyz')).toEqual([]);
  });
});

describe('chooseObstacles', () => {
  it('nunca pasa del máximo de obstáculos, ni de copias por tipo', () => {
    const piezas = chooseObstacles(piecesOfFen(INICIAL));

    expect(piezas.length).toBeLessThanOrEqual(MAX_OBSTACLES);
    for (const kind of ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king']) {
      expect(contar(piezas, kind)).toBeLessThanOrEqual(MAX_PER_KIND);
    }
  });

  it('de la posición inicial salen todos los tipos', () => {
    const tipos = new Set(chooseObstacles(piecesOfFen(INICIAL)).map((p) => p.kind));
    expect([...tipos].sort()).toEqual(['bishop', 'king', 'knight', 'pawn', 'queen', 'rook']);
  });

  it('un tipo con varias piezas sale en pareja, alternando bandos si hay los dos', () => {
    const piezas = chooseObstacles([
      { kind: 'pawn', color: 'w' },
      { kind: 'pawn', color: 'w' },
      { kind: 'pawn', color: 'w' },
      { kind: 'pawn', color: 'b' },
    ]);

    expect(piezas).toHaveLength(2);
    expect(new Set(piezas.map((p) => p.color)).size).toBe(2);
  });

  it('cuando hay demasiados se quita el segundo de los tipos más duros: no hay dos damas ni dos reyes', () => {
    const piezas = chooseObstacles(piecesOfFen(INICIAL));

    expect(piezas).toHaveLength(MAX_OBSTACLES);
    expect(contar(piezas, 'king')).toBe(1);
    expect(contar(piezas, 'queen')).toBe(1);
  });

  it('recortar nunca deja un tipo sin representar', () => {
    const tipos = new Set(chooseObstacles(piecesOfFen(INICIAL)).map((p) => p.kind));
    expect(tipos.size).toBe(6);
  });

  it('sin piezas no hay obstáculos', () => {
    expect(chooseObstacles([])).toEqual([]);
  });
});

describe('buildRunnerSequence', () => {
  it('es determinista: el mismo ejercicio da siempre la misma carrera', () => {
    expect(buildRunnerSequence(MEDIO, 'ej-1')).toEqual(buildRunnerSequence(MEDIO, 'ej-1'));
  });

  it('con otro ejercicio el orden puede ser otro', () => {
    const ordenes = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => JSON.stringify(buildRunnerSequence(MEDIO, s)))
    );
    expect(ordenes.size).toBeGreaterThan(1);
  });

  it('empieza por un peón si lo hay: el salto básico para entrar en materia', () => {
    for (const semilla of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      expect(buildRunnerSequence(MEDIO, semilla)[0].kind).toBe('pawn');
    }
  });

  it('sin peones empieza por lo que haya', () => {
    const secuencia = buildRunnerSequence('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'x');
    expect(secuencia.map((p) => p.kind).sort()).toEqual(['king', 'king', 'rook']);
  });

  it('tiene las mismas piezas que escogió, solo que mezcladas', () => {
    const escogidas = chooseObstacles(piecesOfFen(MEDIO));
    const secuencia = buildRunnerSequence(MEDIO, 'ej-1');
    const clave = (p: RunnerPiece) => `${p.kind}-${p.color}`;

    expect(secuencia.map(clave).sort()).toEqual(escogidas.map(clave).sort());
  });

  it('un tablero vacío da una carrera vacía (el runner termina sin obstáculos)', () => {
    expect(buildRunnerSequence('8/8/8/8/8/8/8/8 w - - 0 1', 'x')).toEqual([]);
  });
});

describe('seededRandom y hashString', () => {
  it('la misma semilla da la misma serie, entre 0 y 1', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const serie = Array.from({ length: 20 }, () => a());

    expect(serie).toEqual(Array.from({ length: 20 }, () => b()));
    serie.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it('semillas distintas dan series distintas', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('el hash es estable y distingue textos', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});

describe('spriteName', () => {
  it('coincide con los nombres de los assets', () => {
    expect(spriteName('knight', 'b')).toBe('piece-knight-b');
    expect(spriteName('pawn', 'w')).toBe('piece-pawn-w');
  });
});
