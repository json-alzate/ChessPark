import { fallbackThemeName, humanizeTheme } from '@core/app/theme-name.util';

describe('humanizeTheme', () => {
  it('separa las palabras de un nombre en camelCase y lo deja en tipo oración', () => {
    expect(humanizeTheme('enPassant')).toBe('En passant');
    expect(humanizeTheme('underPromotion')).toBe('Under promotion');
  });

  it('separa los números', () => {
    expect(humanizeTheme('mateIn6')).toBe('Mate in 6');
  });

  it('un nombre de una sola palabra solo cambia la mayúscula', () => {
    expect(humanizeTheme('castling')).toBe('Castling');
  });

  it('quita los guiones bajos', () => {
    expect(humanizeTheme('some_theme')).toBe('Some theme');
  });

  it('nunca devuelve vacío para algo que no es vacío', () => {
    for (const valor of ['x', 'fooBarBaz', 'a1']) {
      expect(humanizeTheme(valor).length).toBeGreaterThan(0);
    }
  });
});

describe('fallbackThemeName', () => {
  it('traduce las etiquetas conocidas de Lichess al idioma pedido', () => {
    expect(fallbackThemeName('castling', 'es')).toBe('Enroque');
    expect(fallbackThemeName('castling', 'en')).toBe('Castling');
    expect(fallbackThemeName('enPassant', 'es')).toBe('Captura al paso');
    expect(fallbackThemeName('promotion', 'es')).toBe('Coronación');
  });

  it('cualquier idioma que no sea español usa el inglés', () => {
    expect(fallbackThemeName('enPassant', 'fr')).toBe('En passant');
  });

  it('una etiqueta desconocida se enseña legible, igual en cualquier idioma', () => {
    expect(fallbackThemeName('totallyNewTheme', 'es')).toBe('Totally new theme');
    expect(fallbackThemeName('totallyNewTheme', 'en')).toBe('Totally new theme');
  });
});
