import { playerColorFromFen, resolvePlayerColor } from '../../training/player-color.util';

/** FEN de posición inicial con las blancas en turno. */
const FEN_WHITE_TO_MOVE =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Mismo tablero con las negras en turno. */
const FEN_BLACK_TO_MOVE =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1';

describe('playerColorFromFen', () => {
  it('juega negras cuando el FEN tiene blancas en turno', () => {
    expect(playerColorFromFen(FEN_WHITE_TO_MOVE)).toBe('black');
  });

  it('juega blancas cuando el FEN tiene negras en turno', () => {
    expect(playerColorFromFen(FEN_BLACK_TO_MOVE)).toBe('white');
  });

  it('devuelve null sin FEN', () => {
    expect(playerColorFromFen(undefined)).toBeNull();
    expect(playerColorFromFen('')).toBeNull();
  });

  it('devuelve null si el FEN no trae un turno válido', () => {
    expect(playerColorFromFen('solo-tablero')).toBeNull();
    expect(playerColorFromFen('8/8/8/8/8/8/8/8 x - - 0 1')).toBeNull();
  });

  it('acepta espacios alrededor y mayúsculas en el turno', () => {
    expect(playerColorFromFen(`  ${FEN_WHITE_TO_MOVE.replace(' w ', ' W ')}  `)).toBe(
      'black'
    );
  });
});

describe('resolvePlayerColor', () => {
  it('un bloque de color fijo manda sobre el FEN', () => {
    expect(resolvePlayerColor('white', FEN_WHITE_TO_MOVE)).toBe('white');
    expect(resolvePlayerColor('black', FEN_BLACK_TO_MOVE)).toBe('black');
  });

  it('un bloque random deriva el color del FEN del puzzle', () => {
    expect(resolvePlayerColor('random', FEN_WHITE_TO_MOVE)).toBe('black');
    expect(resolvePlayerColor('random', FEN_BLACK_TO_MOVE)).toBe('white');
  });

  it('sin color ni FEN válido cae a blancas', () => {
    expect(resolvePlayerColor(undefined, undefined)).toBe('white');
    expect(resolvePlayerColor('random', 'basura')).toBe('white');
  });
});
