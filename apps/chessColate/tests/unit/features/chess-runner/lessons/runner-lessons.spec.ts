import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { Chess } from 'chess.js';

import { CHAPTERS } from '@features/chess-runner/campaign/runner-curriculum';
import { LESSONS, lessonFor, RunnerLesson } from '@features/chess-runner/lessons/runner-lessons.data';
import {
  ARROW_SECONDS,
  EMPHASIS_SECONDS,
  INTRO_SECONDS,
  lessonDuration,
  lessonFrame,
  lessonSegments,
  MOVE_SECONDS,
  parseBoard,
  PAUSE_SECONDS,
  squareToCell,
} from '@features/chess-runner/lessons/runner-lesson.util';

const I18N = resolve(__dirname, '../../../../../src/assets/i18n');
const leerIdioma = (idioma: string) => JSON.parse(readFileSync(join(I18N, `${idioma}.json`), 'utf-8'));
const ES = leerIdioma('es');
const EN = leerIdioma('en');

/** Juega la lección con chess.js y devuelve el tablero final y las jugadas en SAN. */
function jugar(lesson: RunnerLesson, hasta = lesson.moves.length) {
  const chess = new Chess(lesson.fen);
  const san: string[] = [];
  for (const uci of lesson.moves.slice(0, hasta)) {
    san.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
  }
  return { chess, san };
}

/** Casillas que ataca una pieza (sin importar de quién es el turno): se le da el turno y se miran sus capturas. */
function ataques(fen: string, square: string): string[] {
  const color = new Chess(fen).get(square as never)?.color;
  const partes = fen.split(' ');
  partes[1] = color ?? 'w';
  partes[3] = '-';
  const chess = new Chess(partes.join(' '), { skipValidation: true } as never);
  return chess
    .moves({ square: square as never, verbose: true })
    .filter((m) => m.captured)
    .map((m) => m.to);
}

describe('las lecciones de patrón', () => {
  it('hay una para cada capítulo del currículo, del patrón que dice', () => {
    for (const capitulo of CHAPTERS) {
      const leccion = lessonFor(capitulo.theme);
      expect(leccion).not.toBeNull();
      expect(leccion!.theme).toBe(capitulo.theme);
    }
    expect(Object.keys(LESSONS).sort()).toEqual(CHAPTERS.map((c) => c.theme).sort());
  });

  it('un tema sin lección devuelve null', () => {
    expect(lessonFor('endgame')).toBeNull();
  });

  describe.each(Object.values(LESSONS))('$theme', (leccion) => {
    it('todas las jugadas son legales, empezando por las blancas', () => {
      expect(new Chess(leccion.fen).turn()).toBe('w');
      expect(() => jugar(leccion)).not.toThrow();
    });

    it('los objetivos y lo que se señala son casillas de verdad', () => {
      for (const casilla of [...leccion.focus, ...leccion.targets]) {
        expect(casilla).toMatch(/^[a-h][1-8]$/);
      }
      expect(leccion.targets.length).toBeGreaterThan(0);
      expect(leccion.focus.length).toBeGreaterThan(0);
    });

    it('es mínima: pocas piezas, para que se entienda de un vistazo', () => {
      expect(parseBoard(leccion.fen).size).toBeLessThanOrEqual(10);
      expect(leccion.moves.length).toBeLessThanOrEqual(3);
    });

    it('dura lo justo para leerse sin aburrir', () => {
      expect(lessonDuration(leccion)).toBeGreaterThan(6);
      expect(lessonDuration(leccion)).toBeLessThan(15);
    });

    it('trae sus frases en los dos idiomas: idea, qué mirar, qué se juega, por qué funciona y cómo reconocerlo', () => {
      for (const idioma of [ES, EN]) {
        const frases = idioma.CHESS_RUNNER.lessons[leccion.theme];
        for (const clave of ['idea', 'see', 'play', 'why', 'tip']) {
          expect(typeof frases[clave]).toBe('string');
          expect(frases[clave].length).toBeGreaterThan(10);
          // Caben en dos o tres líneas del móvil
          expect(frases[clave].length).toBeLessThan(110);
        }
        // Cada jugada tras la primera lleva su frase (`play2`, `play3`) o, si no, la de «después» (`then`)
        for (let paso = 1; paso < leccion.moves.length; paso++) {
          expect(typeof (frases[`play${paso + 1}`] ?? frases['then'])).toBe('string');
        }
      }
    });
  });

  describe('lo que enseña cada una (comprobado con chess.js)', () => {
    it('pieza colgada: el alfil se come un caballo que nadie defiende', () => {
      const { chess, san } = jugar(LESSONS['hangingPiece']);

      expect(san).toEqual(['Bxd5']);
      expect(chess.get('d5' as never)?.type).toBe('b');
      // Antes de la jugada, ninguna pieza negra defendía el caballo
      const antes = new Chess(LESSONS['hangingPiece'].fen);
      expect(antes.get('d5' as never)).toMatchObject({ type: 'n', color: 'b' });
    });

    it('horquilla: tras la jugada el caballo ataca al rey y a la torre a la vez', () => {
      const { chess, san } = jugar(LESSONS['fork']);

      expect(san).toEqual(['Nd6+']);
      expect(chess.inCheck()).toBe(true);
      const atacadas = ataques(chess.fen(), 'd6');
      expect(atacadas).toEqual(expect.arrayContaining(['e8', 'c8']));
    });

    it('clavada: el caballo no puede moverse porque detrás hay un rey en la misma columna', () => {
      const { chess } = jugar(LESSONS['pin']);
      const legales = chess.moves({ square: 'e5' as never, verbose: true });

      // Todas sus jugadas dejarían al rey en jaque: no tiene ninguna legal
      expect(legales).toHaveLength(0);
      expect(chess.get('e5' as never)?.type).toBe('n');
    });

    it('ensartada: la torre da jaque, el rey se aparta y se come lo que había detrás', () => {
      const { chess, san } = jugar(LESSONS['skewer']);

      expect(san).toEqual(['Ra5+', 'Ke6', 'Rxh5']);
      expect(chess.get('h5' as never)).toMatchObject({ type: 'r', color: 'w' });
    });

    it('ataque descubierto: al irse el alfil, la torre ataca a la dama', () => {
      const { san } = jugar(LESSONS['discoveredAttack'], 1);
      const despues = jugar(LESSONS['discoveredAttack'], 1).chess;

      expect(san).toEqual(['Bxh7+']);
      // Con el alfil fuera de la columna, la torre ve a la dama
      expect(ataques(despues.fen(), 'e1')).toContain('e8');
      expect(jugar(LESSONS['discoveredAttack']).san).toEqual(['Bxh7+', 'Kxh7', 'Rxe8']);
    });

    it('jaque doble: el caballo da jaque y descubre el de la torre', () => {
      const { chess } = jugar(LESSONS['doubleCheck']);
      const jaqueadoPor = ataques(chess.fen(), 'f6').includes('e8') && ataques(chess.fen(), 'e1').includes('e8');

      expect(chess.inCheck()).toBe(true);
      expect(jaqueadoPor).toBe(true);
      // Solo puede responder moviendo el rey
      expect(new Set(chess.moves({ verbose: true }).map((m) => m.piece))).toEqual(new Set(['k']));
    });

    it('mate del pasillo: es mate', () => {
      const { chess, san } = jugar(LESSONS['backRankMate']);

      expect(san).toEqual(['Re8#']);
      expect(chess.isCheckmate()).toBe(true);
    });

    it('pieza atrapada: el caballo no tiene dónde ir sin perderse, y el alfil se lo lleva', () => {
      const { chess, san } = jugar(LESSONS['trappedPiece'], 1);
      expect(san).toEqual(['Be4']);

      // Sus dos casillas (b6 y c7) están cubiertas: cualquier salida lo pierde
      const salidas = chess.moves({ square: 'a8' as never, verbose: true }).map((m) => m.to);
      expect(salidas.sort()).toEqual(['b6', 'c7']);
      // Y en las dos hay una pieza blanca esperando para comérselo
      for (const salida of salidas) {
        const prueba = new Chess(chess.fen());
        prueba.move({ from: 'a8', to: salida });
        const capturas = prueba.moves({ verbose: true }).filter((m) => m.to === salida && m.captured);
        expect(capturas.length).toBeGreaterThan(0);
      }
      expect(jugar(LESSONS['trappedPiece']).san).toEqual(['Be4', 'Kd7', 'Bxa8']);
    });

    it('mate ahogado: el caballo da mate con el rey encerrado por sus propias piezas', () => {
      const { chess, san } = jugar(LESSONS['smotheredMate']);

      expect(san).toEqual(['Nf7#']);
      expect(chess.isCheckmate()).toBe(true);
    });

    it('mate en dos: la segunda torre cierra la fila y es mate', () => {
      const { chess, san } = jugar(LESSONS['mateIn2']);

      expect(san).toEqual(['Ra7', 'Kg8', 'Rb8#']);
      expect(chess.isCheckmate()).toBe(true);
    });

    it('mate en uno: la dama da mate protegida por el rey', () => {
      const { chess, san } = jugar(LESSONS['mateIn1']);

      expect(san).toEqual(['Qg7#']);
      expect(chess.isCheckmate()).toBe(true);
    });

    it('capturar al defensor: el alfil se lleva al caballo que protegía el peón de e5, y el caballo se lleva el peón', () => {
      const leccion = LESSONS['capturingDefender'];
      const { san } = jugar(leccion);

      expect(san).toEqual(['Bxc6', 'dxc6', 'Nxe5']);
      // Antes: el caballo de c6 defendía el peón de e5 (comerlo con el caballo se pagaba)
      const antes = new Chess(leccion.fen);
      expect(antes.get('c6' as never)).toMatchObject({ type: 'n', color: 'b' });
      antes.move({ from: 'f3', to: 'e5' });
      expect(antes.moves({ verbose: true }).some((m) => m.to === 'e5' && m.captured === 'n')).toBe(true);
      // Después de quitar al defensor, nadie puede recapturar en e5
      const sinDefensor = jugar(leccion, 2).chess;
      sinDefensor.move({ from: 'f3', to: 'e5' });
      expect(sinDefensor.moves({ verbose: true }).filter((m) => m.to === 'e5')).toEqual([]);
    });

    it('desviación: la dama se sacrifica, el rey la captura y deja sin defensa la torre', () => {
      const { chess, san } = jugar(LESSONS['deflection']);

      expect(san).toEqual(['f8=Q+', 'Kxf8', 'Kxg6']);
      expect(chess.get('g6' as never)).toMatchObject({ type: 'k', color: 'w' });
      // Al principio el rey negro defiende la torre de g6: el rey blanco no puede comérsela
      const antes = new Chess(LESSONS['deflection'].fen);
      expect(antes.moves({ verbose: true }).some((m) => m.to === 'g6')).toBe(false);
    });

    it('atracción: el sacrificio de torre lleva al rey a e8 y el peón corona con jaque', () => {
      const { chess, san } = jugar(LESSONS['attraction']);

      expect(san).toEqual(['Rxe8+', 'Kxe8', 'a8=Q+']);
      expect(chess.inCheck()).toBe(true);
      expect(chess.get('a8' as never)).toMatchObject({ type: 'q', color: 'w' });
    });

    it('rayos X: la torre de g7 captura a la de g4 a través de donde estaba la otra', () => {
      const { chess, san } = jugar(LESSONS['xRayAttack']);

      expect(san).toEqual(['g4+', 'Rxg4', 'Rxg4']);
      expect(chess.get('g4' as never)).toMatchObject({ type: 'r', color: 'w' });
      // Al inicio la torre blanca «ve» a la negra de g5 y detrás, g4 está tapada por ella
      expect(ataques(LESSONS['xRayAttack'].fen, 'g7')).toContain('g5');
    });

    it('jugada intermedia: primero un jaque y después el peón captura la torre', () => {
      const { chess, san } = jugar(LESSONS['intermezzo']);

      expect(san).toEqual(['Rc5+', 'Kd7', 'cxd4']);
      expect(chess.get('d4' as never)).toMatchObject({ type: 'p', color: 'w' });
      // Capturar de inmediato dejaba la torre de b5 en prisa del alfil: el jaque lo evita
      const sinJaque = jugar({ ...LESSONS['intermezzo'], moves: ['c3d4'] }).chess;
      expect(sinJaque.moves({ verbose: true }).some((m) => m.captured === 'r' && m.to === 'b5')).toBe(true);
    });

    it.each([
      ['arabianMate', 'Rh7#'],
      ['anastasiaMate', 'Rh2#'],
      ['bodenMate', 'Ba6#'],
      ['hookMate', 'Rf8#'],
    ])('%s: el mate es de una jugada', (tema, jugada) => {
      const { chess, san } = jugar(LESSONS[tema]);

      expect(san).toEqual([jugada]);
      expect(chess.isCheckmate()).toBe(true);
    });
  });
});

describe('las frases de la lección', () => {
  it('cada tramo sabe qué frase toca: ver, jugar, por qué, y el consejo al terminar', () => {
    const leccion = LESSONS['skewer'];
    const fases = (t: number) => {
      const marco = lessonFrame(leccion, t);
      return [marco.phase, marco.step];
    };

    expect(fases(0.2)).toEqual(['see', 0]);
    expect(fases(INTRO_SECONDS + 0.1)).toEqual(['play', 0]);
    expect(fases(INTRO_SECONDS + MOVE_SECONDS + PAUSE_SECONDS + 0.1)).toEqual(['play', 1]);
    expect(fases(INTRO_SECONDS + 2 * (MOVE_SECONDS + PAUSE_SECONDS) + 0.1)).toEqual(['play', 2]);
    expect(fases(lessonDuration(leccion) - 0.5)).toEqual(['why', 0]);
    expect(fases(lessonDuration(leccion) + 1)).toEqual(['tip', 0]);
  });

  it('si el patrón se ilumina a mitad, lo que queda por jugar es «después»', () => {
    const leccion = LESSONS['trappedPiece'];
    const enfasis = lessonSegments(leccion).find((s) => s.kind === 'emphasis')!;

    expect(lessonFrame(leccion, enfasis.start + 0.2).phase).toBe('why');
    const despues = lessonFrame(leccion, enfasis.end + 0.1);
    expect(despues.phase).toBe('then');
    expect(despues.step).toBe(1);
  });

  it('las flechas explícitas sustituyen a las que salen de la última pieza', () => {
    const leccion = LESSONS['capturingDefender'];
    const enfasis = lessonSegments(leccion).find((s) => s.kind === 'emphasis')!;
    const marco = lessonFrame(leccion, enfasis.start + ARROW_SECONDS + 0.1);

    expect(marco.arrows.map((a) => [a.from, a.to])).toEqual([['f3', 'e5']]);
  });
});

describe('la línea de tiempo de una lección', () => {
  const unaJugada = LESSONS['fork'];
  const tresJugadas = LESSONS['skewer'];

  it('empieza con la intro, sigue con cada jugada y su pausa, y acaba con el énfasis', () => {
    const tipos = lessonSegments(tresJugadas).map((s) => s.kind);

    expect(tipos).toEqual(['intro', 'move', 'pause', 'move', 'pause', 'move', 'pause', 'emphasis']);
  });

  it('el énfasis puede ir a mitad (pieza atrapada) y la lección sigue después', () => {
    const tipos = lessonSegments(LESSONS['trappedPiece']).map((s) => s.kind);

    expect(tipos).toEqual(['intro', 'move', 'pause', 'emphasis', 'move', 'pause', 'move', 'pause']);
  });

  it('los tiempos suman lo que dura', () => {
    expect(lessonDuration(unaJugada)).toBeCloseTo(INTRO_SECONDS + MOVE_SECONDS + PAUSE_SECONDS + EMPHASIS_SECONDS, 5);
    const segmentos = lessonSegments(tresJugadas);
    for (let i = 1; i < segmentos.length; i++) {
      expect(segmentos[i].start).toBeCloseTo(segmentos[i - 1].end, 9);
    }
  });

  it('al principio todo está en su sitio y se señala lo que hay que mirar', () => {
    const marco = lessonFrame(unaJugada, 0.3);

    expect(marco.pieces).toHaveLength(parseBoard(unaJugada.fen).size);
    expect(marco.rings.map((r) => r.square).sort()).toEqual([...unaJugada.focus].sort());
    expect(marco.rings.every((r) => r.kind === 'focus')).toBe(true);
    expect(marco.arrows).toEqual([]);
    expect(marco.done).toBe(false);
  });

  it('el brillo late: su intensidad cambia con el tiempo y nunca sale de 0 a 1', () => {
    const intensidades = [0.1, 0.25, 0.4, 0.55, 0.7].map((t) => lessonFrame(unaJugada, t).rings[0].strength);

    expect(new Set(intensidades).size).toBeGreaterThan(2);
    intensidades.forEach((i) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThanOrEqual(1);
    });
  });

  it('durante la jugada la pieza se desliza de una casilla a la otra', () => {
    const inicio = squareToCell('f5');
    const fin = squareToCell('d6');
    const mitad = lessonFrame(unaJugada, INTRO_SECONDS + MOVE_SECONDS / 2);
    const caballo = mitad.pieces.find((p) => p.key === 'wn')!;

    expect(caballo.x).toBeGreaterThan(Math.min(inicio.x, fin.x));
    expect(caballo.x).toBeLessThan(Math.max(inicio.x, fin.x));
    expect(caballo.y).toBeGreaterThan(Math.min(inicio.y, fin.y) - 1e-9);
    expect(caballo.y).toBeLessThan(Math.max(inicio.y, fin.y) + 1e-9);
    // Los focos de la intro ya se apagaron
    expect(mitad.rings).toEqual([]);
  });

  it('una captura hace desaparecer a la pieza comida', () => {
    const leccion = LESSONS['hangingPiece'];
    const antes = lessonFrame(leccion, INTRO_SECONDS + 0.01).pieces.find((p) => p.key === 'bn')!;
    const casi = lessonFrame(leccion, INTRO_SECONDS + MOVE_SECONDS * 0.95).pieces.find((p) => p.key === 'bn');
    const despues = lessonFrame(leccion, INTRO_SECONDS + MOVE_SECONDS + 0.1).pieces.find((p) => p.key === 'bn');

    expect(antes.alpha).toBe(1);
    expect(casi!.alpha).toBeLessThan(0.5);
    expect(despues).toBeUndefined();
  });

  it('al acabar la jugada la pieza está en su casilla nueva', () => {
    const marco = lessonFrame(unaJugada, INTRO_SECONDS + MOVE_SECONDS + 0.01);
    const caballo = marco.pieces.find((p) => p.key === 'wn')!;

    expect({ x: caballo.x, y: caballo.y }).toEqual(squareToCell('d6'));
  });

  it('en el énfasis se iluminan los objetivos y salen flechas desde donde acaba de llegar la pieza', () => {
    const marco = lessonFrame(unaJugada, INTRO_SECONDS + MOVE_SECONDS + PAUSE_SECONDS + ARROW_SECONDS + 0.1);

    expect(marco.rings.map((r) => r.square).sort()).toEqual(['c8', 'e8']);
    expect(marco.rings.every((r) => r.kind === 'target')).toBe(true);
    expect(marco.arrows.map((a) => [a.from, a.to])).toEqual([['d6', 'e8'], ['d6', 'c8']]);
    expect(marco.arrows.every((a) => a.progress === 1)).toBe(true);
  });

  it('las flechas se van dibujando poco a poco', () => {
    const empieza = INTRO_SECONDS + MOVE_SECONDS + PAUSE_SECONDS;
    const a = lessonFrame(unaJugada, empieza + 0.05).arrows[0].progress;
    const b = lessonFrame(unaJugada, empieza + ARROW_SECONDS / 2).arrows[0].progress;

    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(1);
  });

  it('si el objetivo es la casilla donde llegó la pieza (una captura), hay brillo pero no flecha', () => {
    const marco = lessonFrame(LESSONS['hangingPiece'], lessonDuration(LESSONS['hangingPiece']) - 0.5);

    expect(marco.rings.map((r) => r.square)).toEqual(['d5']);
    expect(marco.arrows).toEqual([]);
  });

  it('la flecha puede ir solo a una parte de los objetivos', () => {
    const leccion = LESSONS['trappedPiece'];
    const enfasis = lessonSegments(leccion).find((s) => s.kind === 'emphasis')!;
    const marco = lessonFrame(leccion, enfasis.start + 1);

    expect(marco.rings.map((r) => r.square).sort()).toEqual(['a8', 'b6', 'c7']);
    expect(marco.arrows.map((a) => a.to)).toEqual(['a8']);
  });

  it('antes de empezar y después de acabar el marco es válido, y solo el final está «hecho»', () => {
    const total = lessonDuration(tresJugadas);

    expect(lessonFrame(tresJugadas, -5).done).toBe(false);
    expect(lessonFrame(tresJugadas, total - 0.01).done).toBe(false);
    expect(lessonFrame(tresJugadas, total).done).toBe(true);
    expect(lessonFrame(tresJugadas, total + 50).pieces.length).toBeGreaterThan(0);
  });

  it('la ensartada acaba con la torre blanca en h5 y sin la torre negra', () => {
    const marco = lessonFrame(tresJugadas, lessonDuration(tresJugadas));
    const claves = marco.pieces.map((p) => p.key).sort();

    expect(claves).toEqual(['bk', 'wk', 'wr']);
    const torre = marco.pieces.find((p) => p.key === 'wr')!;
    expect({ x: torre.x, y: torre.y }).toEqual(squareToCell('h5'));
  });
});

describe('parseBoard y squareToCell', () => {
  it('lee un FEN a casillas', () => {
    const tablero = parseBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');

    expect(tablero.size).toBe(32);
    expect(tablero.get('e4')).toBe('wp');
    expect(tablero.get('e8')).toBe('bk');
    expect(tablero.get('e2')).toBeUndefined();
  });

  it('un FEN roto no lanza', () => {
    expect(parseBoard('').size).toBe(0);
    expect(parseBoard('xx').size).toBe(0);
  });

  it('las casillas van de a8 (0,0) a h1 (7,7)', () => {
    expect(squareToCell('a8')).toEqual({ x: 0, y: 0 });
    expect(squareToCell('h1')).toEqual({ x: 7, y: 7 });
    expect(squareToCell('e4')).toEqual({ x: 4, y: 4 });
  });
});
