/**
 * Las lecciones de patrón: un ejemplo mínimo y limpio de cada patrón del currículo, que el perrito «cuenta» con un
 * tablero pequeño y sin una sola palabra: se ve la posición, se hace la jugada y se marcan las piezas que importan.
 *
 * Cada ejemplo es un FEN con las jugadas en UCI (las blancas empiezan; si hay réplica de las negras va intercalada).
 * Están comprobados con `chess.js` en las pruebas: legales, y con el patrón que dicen enseñar. Las frases que los acompañan
 * (la idea, qué mirar, qué ocurre y cómo reconocerlo) están en los textos de la app, en `CHESS_RUNNER.lessons.<patrón>`.
 */

export interface RunnerLesson {
  /** El patrón (tema del catálogo) que enseña. */
  theme: string;
  fen: string;
  /** Jugadas en UCI, alternando blancas y negras. */
  moves: string[];
  /** Casillas que se señalan antes de empezar: lo que hay que mirar (una pieza colgada, un rey…). */
  focus: string[];
  /** Casillas que se iluminan al final, con una flecha desde la pieza que acaba de moverse. */
  targets: string[];
  /** Cuántas jugadas se hacen antes de señalar los objetivos (por defecto, todas). */
  highlightAfter?: number;
  /** A cuáles de los objetivos va la flecha (por defecto, a todos; el caballo atrapado, por ejemplo, solo a su casilla). */
  arrowTo?: string[];
  /** Flechas explícitas, de una casilla a otra: sustituyen a las que parten de la última pieza movida. */
  arrows?: ReadonlyArray<readonly [string, string]>;
}

export const LESSONS: Record<string, RunnerLesson> = {
  // La dama da jaque desde g7, protegida por el rey: no hay casilla libre
  mateIn1: {
    theme: 'mateIn1',
    fen: '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1',
    moves: ['g1g7'],
    focus: ['h8', 'g8', 'h7'],
    targets: ['h8'],
  },
  // Un alfil que se come un caballo sin protección
  hangingPiece: {
    theme: 'hangingPiece',
    fen: '4k3/8/8/3n4/8/1B6/8/4K3 w - - 0 1',
    moves: ['b3d5'],
    focus: ['d5'],
    targets: ['d5'],
  },
  // El caballo ataca a la vez al rey y a la torre
  fork: {
    theme: 'fork',
    fen: '2r1k3/8/8/5N2/8/8/8/4K3 w - - 0 1',
    moves: ['f5d6'],
    focus: ['e8', 'c8'],
    targets: ['e8', 'c8'],
  },
  // La torre ataca al caballo, que no puede moverse porque detrás está el rey
  pin: {
    theme: 'pin',
    fen: '4k3/8/8/4n3/8/8/8/R5K1 w - - 0 1',
    moves: ['a1e1'],
    focus: ['e5', 'e8'],
    targets: ['e5', 'e8'],
  },
  // La torre da jaque; el rey se aparta y cae lo que había detrás
  skewer: {
    theme: 'skewer',
    fen: '8/8/8/4k2r/8/8/8/R5K1 w - - 0 1',
    moves: ['a1a5', 'e5e6', 'a5h5'],
    focus: ['e5', 'h5'],
    targets: ['h5'],
  },
  // El alfil se mueve con jaque y deja a la torre atacando a la dama
  discoveredAttack: {
    theme: 'discoveredAttack',
    fen: '4q1k1/5ppp/8/8/4B3/8/8/3KR3 w - - 0 1',
    moves: ['e4h7', 'g8h7', 'e1e8'],
    focus: ['e8', 'e4'],
    targets: ['e8'],
  },
  // Un solo movimiento da jaque con dos piezas a la vez
  doubleCheck: {
    theme: 'doubleCheck',
    fen: '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1',
    moves: ['e4f6'],
    focus: ['e8'],
    targets: ['e8'],
  },
  // El rey no puede salir de su fila: lo tapan sus propios peones
  backRankMate: {
    theme: 'backRankMate',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    moves: ['e1e8'],
    focus: ['g8', 'f7', 'g7', 'h7'],
    targets: ['g8'],
  },
  // El caballo no tiene casillas a donde ir: el alfil lo ataca y se lo lleva
  trappedPiece: {
    theme: 'trappedPiece',
    fen: 'n3k3/8/8/P7/8/3B4/8/2R1K3 w - - 0 1',
    moves: ['d3e4', 'e8d7', 'e4a8'],
    focus: ['a8', 'b6', 'c7'],
    targets: ['a8', 'b6', 'c7'],
    highlightAfter: 1,
    arrowTo: ['a8'],
  },
  // El rey, encerrado por sus propias piezas, recibe el jaque del caballo
  smotheredMate: {
    theme: 'smotheredMate',
    fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
    moves: ['g5f7'],
    focus: ['h8', 'g8', 'g7', 'h7'],
    targets: ['h8'],
  },
  // Dos torres que se turnan para cerrar al rey, fila a fila
  mateIn2: {
    theme: 'mateIn2',
    fen: '7k/8/8/8/8/8/R7/1R4K1 w - - 0 1',
    moves: ['a2a7', 'h8g8', 'b1b8'],
    focus: ['h8'],
    targets: ['g8'],
  },

  // El alfil se come al caballo que defendía el peón de e5; las negras recapturan y el caballo blanco se lleva el peón
  capturingDefender: {
    theme: 'capturingDefender',
    fen: '4k3/3p4/2n5/1B2p3/8/5N2/8/6K1 w - - 0 1',
    moves: ['b5c6', 'd7c6', 'f3e5'],
    focus: ['c6', 'e5'],
    targets: ['e5'],
    highlightAfter: 1,
    arrows: [['f3', 'e5']],
  },
  // El peón corona con jaque, el rey lo captura y deja sin defensa la torre de g6
  deflection: {
    theme: 'deflection',
    fen: '8/5Pk1/6r1/6PK/8/8/8/8 w - - 0 1',
    moves: ['f7f8q', 'g7f8', 'h5g6'],
    focus: ['g7', 'g6'],
    targets: ['g6'],
    highlightAfter: 2,
    arrows: [['h5', 'g6']],
  },
  // El sacrificio de la torre atrae al rey a e8, donde el peón corona con jaque
  attraction: {
    theme: 'attraction',
    fen: '4rk2/P7/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['e1e8', 'f8e8', 'a7a8q'],
    focus: ['e8', 'a7'],
    targets: ['e8'],
  },
  // La torre de g7 ataca g4 a través de la torre negra de g5
  xRayAttack: {
    theme: 'xRayAttack',
    fen: '8/6R1/5p1p/6rk/8/6PK/8/8 w - - 0 1',
    moves: ['g3g4', 'g5g4', 'g7g4'],
    focus: ['g7', 'g5'],
    targets: ['g4'],
    arrows: [['g7', 'g4']],
  },
  // Primero un jaque; después, con el rey apartado, el peón se come la torre que atacaba
  intermezzo: {
    theme: 'intermezzo',
    fen: '2k5/8/b7/1R6/3r4/1KP5/8/8 w - - 0 1',
    moves: ['b5c5', 'c8d7', 'c3d4'],
    focus: ['b5', 'd4'],
    targets: ['d4'],
    arrows: [['c3', 'd4']],
  },
  // La torre da jaque desde h7, protegida por el caballo, al rey encerrado en la esquina
  arabianMate: {
    theme: 'arabianMate',
    fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1',
    moves: ['a7h7'],
    focus: ['h8', 'f6'],
    targets: ['h8'],
  },
  // El peón negro de g7 le tapa la salida al rey; el caballo cubre g8 y g6 y la torre da el jaque
  anastasiaMate: {
    theme: 'anastasiaMate',
    fen: '8/4N1pk/8/8/8/8/R7/6K1 w - - 0 1',
    moves: ['a2h2'],
    focus: ['h7', 'g7', 'e7'],
    targets: ['h7'],
  },
  // Dos alfiles que se cruzan: uno da jaque y el otro corta las salidas del rey
  bodenMate: {
    theme: 'bodenMate',
    fen: '2kr4/3p4/8/8/2B2B2/8/8/6K1 w - - 0 1',
    moves: ['c4a6'],
    focus: ['c8', 'd8', 'd7'],
    targets: ['c8'],
  },
  // La torre da jaque desde f8, protegida por el caballo, que a su vez protege el peón de g6; el peón negro tapa la salida
  hookMate: {
    theme: 'hookMate',
    fen: '6k1/6pN/6P1/8/5R2/8/8/K7 w - - 0 1',
    moves: ['f4f8'],
    focus: ['g8', 'h7', 'g6'],
    targets: ['g8'],
  },
};

export function lessonFor(theme: string): RunnerLesson | null {
  return LESSONS[theme] ?? null;
}
