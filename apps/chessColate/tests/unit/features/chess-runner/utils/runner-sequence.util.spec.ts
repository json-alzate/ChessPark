import {
  difficultyForLevel,
  MAX_OBSTACLES,
  MAX_PER_KIND,
  MAX_WAVES,
  REST_SECONDS,
  WALL_COUNT,
  WALL_KINDS,
} from '@features/chess-runner/config/runner.config';
import { RunnerPiece } from '@features/chess-runner/models/runner.model';
import {
  buildRunnerSequence,
  chooseObstacles,
  expectedRunSeconds,
  hashString,
  pieceKey,
  piecesOfFen,
  seededRandom,
  targetRunSeconds,
  wallsForLevel,
  tightShare,
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

  describe('las oleadas', () => {
    const ORDEN = ['pawn', 'rook', 'bishop', 'knight', 'queen', 'king'];
    const SEMILLAS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const tipos = (piezas: RunnerPiece[]) => [...new Set(piezas.map((p) => p.kind))];

    it('la primera es la presentación: cada tipo de pieza una vez, de la más baja a la más alta', () => {
      for (const semilla of SEMILLAS) {
        const secuencia = buildRunnerSequence(INICIAL, semilla);
        const distintos = tipos(chooseObstacles(piecesOfFen(INICIAL)));
        const primera = secuencia.slice(0, distintos.length);

        expect(primera.map((p) => ORDEN.indexOf(p.kind))).toEqual([0, 1, 2, 3, 4, 5]);
        expect(primera[distintos.length - 1].rest).toBeGreaterThan(0);
      }
    });

    it('hay un respiro tras cada oleada menos la última, y la carrera nunca acaba con una pausa', () => {
      for (const semilla of SEMILLAS) {
        for (const nivel of [1, 5, 10]) {
          const secuencia = buildRunnerSequence(INICIAL, semilla, nivel);
          const conRespiro = secuencia.filter((p) => (p.rest ?? 0) > 0);

          expect(conRespiro.length).toBeGreaterThanOrEqual(1);
          expect(conRespiro.length).toBeLessThanOrEqual(MAX_WAVES - 1);
          expect(secuencia[secuencia.length - 1].rest).toBeUndefined();
          conRespiro.forEach((p) => expect(p.rest).toBe(REST_SECONDS));
        }
      }
    });

    it('la última oleada va de la pieza más alta a la más baja', () => {
      // Con carreras largas (niveles altos) cabe la tercera oleada entera
      const secuencia = buildRunnerSequence(INICIAL, 'a', 20);
      const ultimoRespiro = secuencia.map((p) => p.rest).lastIndexOf(REST_SECONDS);
      const cola = secuencia.slice(ultimoRespiro + 1).map((p) => ORDEN.indexOf(p.kind));

      expect(cola.length).toBeGreaterThan(2);
      expect(cola).toEqual([...cola].sort((a, b) => b - a));
    });

    it('lo que sale es lo que hay en el tablero: ninguna pieza de más', () => {
      const permitidas = new Set(chooseObstacles(piecesOfFen(MEDIO)).map((p) => `${p.kind}-${p.color}`));
      const secuencia = buildRunnerSequence(MEDIO, 'ej-1');

      expect(secuencia.every((p) => permitidas.has(`${p.kind}-${p.color}`))).toBe(true);
      // Y están todas las que se eligieron
      const vistas = new Set(secuencia.map((p) => `${p.kind}-${p.color}`));
      expect(vistas).toEqual(permitidas);
    });
  });

  describe('lo que dura', () => {
    const POSICIONES = [INICIAL, MEDIO, FINAL_DE_PEONES, '4k3/8/8/8/8/8/8/R3K3 w - - 0 1'];

    it.each([1, 3, 5, 8, 10])('en el nivel %s dura lo que toca, más o menos, sea cual sea el ejercicio', (nivel) => {
      for (const fen of POSICIONES) {
        const secuencia = buildRunnerSequence(fen, 'ej-1', nivel);
        const segundos = expectedRunSeconds(secuencia, difficultyForLevel(nivel));

        expect(segundos).toBeGreaterThan(targetRunSeconds(nivel) - 3);
        expect(segundos).toBeLessThan(targetRunSeconds(nivel) + 3);
      }
    });

    it('el objetivo crece un poco con el nivel y ronda la media minuta', () => {
      expect(targetRunSeconds(1)).toBeGreaterThanOrEqual(20);
      expect(targetRunSeconds(10)).toBeLessThanOrEqual(32);
      expect(targetRunSeconds(10)).toBeGreaterThan(targetRunSeconds(1));
    });

    it('una posición con pocas piezas repite las que hay, sin pasarse del tope', () => {
      const secuencia = buildRunnerSequence('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'x');

      expect(secuencia.length).toBeGreaterThan(8);
      expect(secuencia.length).toBeLessThanOrEqual(26);
      expect(new Set(secuencia.map((p) => p.kind))).toEqual(new Set(['rook', 'king']));
    });

    it('un ejercicio con muchas piezas se recorta: nunca pasa de lo que toca por mucho', () => {
      const secuencia = buildRunnerSequence(INICIAL, 'ej-1', 1);

      expect(secuencia.length).toBeLessThanOrEqual(26);
      expect(secuencia.length).toBeGreaterThanOrEqual(12);
    });

    it('expectedRunSeconds: vacía no dura nada y una falange alarga', () => {
      const dificultad = difficultyForLevel(1);
      const corta: RunnerPiece[] = [{ kind: 'pawn', color: 'w', beat: 0.5 }, { kind: 'pawn', color: 'w', beat: 0.5 }];
      const conFalange = [corta[0], { ...corta[1], wall: 3 }];

      expect(expectedRunSeconds([], dificultad)).toBe(0);
      expect(expectedRunSeconds(conFalange, dificultad)).toBeGreaterThan(expectedRunSeconds(corta, dificultad) + 0.5);
    });
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

  it('sin peones empieza por lo que haya, de la más baja a la más alta', () => {
    const secuencia = buildRunnerSequence('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'x');
    expect(secuencia.slice(0, 2).map((p) => p.kind)).toEqual(['rook', 'king']);
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

  it('una falange es de las mismas piezas que ya había: no inventa tipos ni colores', () => {
    const permitidas = new Set(chooseObstacles(piecesOfFen(INICIAL)).map((p) => `${p.kind}-${p.color}`));
    const secuencia = buildRunnerSequence(INICIAL, 'ej-1', 9);

    expect(secuencia.every((p) => permitidas.has(`${p.kind}-${p.color}`))).toBe(true);
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

describe('el ritmo de la carrera', () => {
  const beats = (nivel: number) => {
    const todos: number[] = [];
    for (let i = 0; i < 40; i++) {
      buildRunnerSequence(INICIAL, `ritmo-${i}`, nivel).forEach((p) => todos.push(p.beat ?? 0.5));
    }
    return todos;
  };
  const parte = (lista: number[], f: (b: number) => boolean) => lista.filter(f).length / lista.length;

  it('la parte de piezas encadenadas crece con el nivel, hasta la mitad', () => {
    expect(tightShare(1)).toBeCloseTo(0.12, 5);
    expect(tightShare(5)).toBeGreaterThan(tightShare(1));
    expect(tightShare(10)).toBeGreaterThan(tightShare(5));
    expect(tightShare(99)).toBe(0.5);
    expect(tightShare(0)).toBe(tightShare(1));
  });

  it('no es un metrónomo: hay piezas encadenadas, ritmo normal y respiros largos', () => {
    const lista = beats(10);

    expect(parte(lista, (b) => b < 0.1)).toBeGreaterThan(0.15);
    expect(parte(lista, (b) => b >= 0.25 && b <= 0.75)).toBeGreaterThan(0.3);
    expect(parte(lista, (b) => b >= 0.85)).toBeGreaterThan(0.1);
  });

  it('con más nivel salen más encadenadas', () => {
    expect(parte(beats(15), (b) => b < 0.1)).toBeGreaterThan(parte(beats(1), (b) => b < 0.1) + 0.1);
  });

  it('es determinista: el mismo ejercicio da el mismo ritmo', () => {
    expect(beats(7)).toEqual(beats(7));
  });
});
