import { MAX_OBSTACLES, MAX_PER_KIND, WALL_COUNT, WALL_KINDS } from '@features/chess-runner/config/runner.config';
import { RunnerPiece } from '@features/chess-runner/models/runner.model';
import {
  buildRunnerSequence,
  chooseObstacles,
  hashString,
  pieceKey,
  piecesOfFen,
  seededRandom,
  wallsForLevel,
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

  it('va de las piezas más bajas a las más altas: la dificultad sube dentro de la carrera', () => {
    const orden = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];
    for (const semilla of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const alturas = buildRunnerSequence(INICIAL, semilla).map((p) => orden.indexOf(p.kind));
      expect(alturas).toEqual([...alturas].sort((a, b) => a - b));
    }
  });

  it('cada pieza lleva su propio ritmo (entre 0 y 1), el mismo para el mismo ejercicio, y no todas igual', () => {
    const secuencia = buildRunnerSequence(INICIAL, 'ej-1');
    const ritmos = secuencia.map((p) => p.beat);

    ritmos.forEach((ritmo) => {
      expect(ritmo).toBeGreaterThanOrEqual(0);
      expect(ritmo).toBeLessThanOrEqual(1);
    });
    expect(new Set(ritmos).size).toBeGreaterThan(1);
    expect(buildRunnerSequence(INICIAL, 'ej-1').map((p) => p.beat)).toEqual(ritmos);
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

describe('falanges por nivel', () => {
  const paredes = (secuencia: RunnerPiece[]) => secuencia.filter((p) => (p.wall ?? 1) > 1);
  const SEMILLAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('wallsForLevel: ninguna en el nivel 1 y cada vez más', () => {
    expect([1, 2, 4, 5, 7, 8, 10].map(wallsForLevel)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  it('en el nivel 1 no hay falanges: se aprende primero el salto', () => {
    for (const semilla of SEMILLAS) {
      expect(paredes(buildRunnerSequence(INICIAL, semilla, 1))).toEqual([]);
      expect(paredes(buildRunnerSequence(INICIAL, semilla))).toEqual([]);
    }
  });

  it('desde el nivel 2 hay las que toquen, de tres piezas', () => {
    for (const semilla of SEMILLAS) {
      expect(paredes(buildRunnerSequence(INICIAL, semilla, 2))).toHaveLength(1);
      expect(paredes(buildRunnerSequence(INICIAL, semilla, 6))).toHaveLength(2);
      expect(paredes(buildRunnerSequence(INICIAL, semilla, 9))).toHaveLength(3);
    }
    expect(paredes(buildRunnerSequence(INICIAL, 'a', 9))[0].wall).toBe(WALL_COUNT);
  });

  it('nunca es la primera pieza, ni una que se deslice', () => {
    for (const semilla of SEMILLAS) {
      const secuencia = buildRunnerSequence(INICIAL, semilla, 10);
      expect(secuencia[0].wall).toBeUndefined();
      for (const pared of paredes(secuencia)) {
        expect(WALL_KINDS).toContain(pared.kind);
      }
    }
  });

  it('si no hay piezas que lo admitan, no se inventa ninguna', () => {
    // Solo una torre y una dama: las dos se deslizan
    const secuencia = buildRunnerSequence('3q4/8/8/8/8/8/8/3R4 w - - 0 1', 'x', 10);
    expect(paredes(secuencia)).toEqual([]);
  });

  it('las falanges no cambian el orden, los ritmos ni las piezas: solo marcan alguna', () => {
    const llanas = buildRunnerSequence(INICIAL, 'ej-1', 1);
    const conParedes = buildRunnerSequence(INICIAL, 'ej-1', 9);

    expect(conParedes.map(({ kind, color, beat }) => ({ kind, color, beat }))).toEqual(
      llanas.map(({ kind, color, beat }) => ({ kind, color, beat }))
    );
  });

  it('es determinista: el mismo ejercicio y nivel dan las mismas falanges', () => {
    expect(buildRunnerSequence(INICIAL, 'ej-1', 6)).toEqual(buildRunnerSequence(INICIAL, 'ej-1', 6));
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

describe('pieceKey', () => {
  it('coincide con los nombres del sprite de piezas del tablero (bando y letra)', () => {
    expect(pieceKey('knight', 'b')).toBe('bn');
    expect(pieceKey('pawn', 'w')).toBe('wp');
    expect(pieceKey('king', 'w')).toBe('wk');
    expect(pieceKey('queen', 'b')).toBe('bq');
    expect(pieceKey('rook', 'w')).toBe('wr');
    expect(pieceKey('bishop', 'b')).toBe('bb');
  });
});
