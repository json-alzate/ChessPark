import { CUSTOM_PGN_TEMPLATE } from '@features/custom-puzzles/config/custom-pgn-template';
import { parsePgnExercises } from '@features/custom-puzzles/utils/pgn-puzzles.util';

describe('CUSTOM_PGN_TEMPLATE', () => {
  const lectura = parsePgnExercises(CUSTOM_PGN_TEMPLATE);

  it('el ejemplo de la ayuda se lee entero, sin un solo problema', () => {
    expect(lectura.total).toBe(3);
    expect(lectura.puzzles).toHaveLength(3);
    expect(lectura.issues).toEqual([]);
    expect(lectura.notes).toEqual([]);
  });

  it('enseña las etiquetas opcionales: rating y temas', () => {
    expect(lectura.puzzles.map((p) => p.rating)).toEqual([900, 1200, 600]);
    expect(lectura.puzzles.map((p) => p.themes)).toEqual([['mateIn1', 'backRankMate'], ['fork'], ['mateIn1']]);
  });
});
