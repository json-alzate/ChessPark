/**
 * Nombre que se enseña de un tema de ejercicio que no está en la lista de temas de la app
 * (`assets/data/themes-puzzle.json`).
 *
 * Los ejercicios del catálogo traen etiquetas de Lichess que la app no ofrece para elegir (el enroque,
 * la captura al paso, la coronación, las partidas de maestros…). Sin esto, esas etiquetas salían como
 * un hueco vacío junto al resto de temas. Los que se conocen llevan su traducción; el resto se enseña
 * con su nombre «legible» (de `enPassant` a «En passant»), mejor eso que nada.
 */

const EXTRA_THEMES: Record<string, { es: string; en: string }> = {
  castling: { es: 'Enroque', en: 'Castling' },
  enPassant: { es: 'Captura al paso', en: 'En passant' },
  promotion: { es: 'Coronación', en: 'Promotion' },
  underPromotion: { es: 'Subpromoción', en: 'Underpromotion' },
  master: { es: 'Partida de maestros', en: 'Master game' },
  masterVsMaster: { es: 'Maestro contra maestro', en: 'Master vs master' },
  superGM: { es: 'Supergran maestro', en: 'Super GM game' },
};

/** `enPassant` → `En passant`; `mateIn6` → `Mate in 6`. */
export function humanizeTheme(value: string): string {
  const spaced = value
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** El nombre de un tema fuera de la lista de la app, en el idioma pedido. */
export function fallbackThemeName(value: string, lang: string): string {
  const known = EXTRA_THEMES[value];
  if (known) {
    return lang === 'es' ? known.es : known.en;
  }
  return humanizeTheme(value);
}
