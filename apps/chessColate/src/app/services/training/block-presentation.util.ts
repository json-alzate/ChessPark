import { Block } from '@cpark/models';

/** Imagen de los bloques sin tema (los que se juegan por apertura). */
const OPENING_IMAGE = '/assets/images/puzzle-themes/opening.svg';
/** Imagen común a todos los mates en N: no existe una por cada N. */
const MATE_IMAGE = '/assets/images/puzzle-themes/mate.svg';

/**
 * Textos e imagen con los que se presenta un bloque antes de jugarlo. Son,
 * tal cual, los `componentProps` que recibe `BlockPresentationComponent`.
 */
export interface BlockPresentation {
  title: string;
  description: string;
  image: string;
}

/**
 * Catálogos y traducciones de los que sale la presentación. Se reciben como
 * funciones para que la derivación sea pura y se pruebe sin Angular: la
 * pantalla las toma de `AppService` (temas y aperturas en el idioma activo) y
 * de Transloco; las pruebas pasan dobles.
 */
export interface BlockPresentationSources {
  /** Nombre legible de un tema de puzzle. */
  themeName(theme: string): string;
  /** Descripción de un tema de puzzle. */
  themeDescription(theme: string): string;
  /** Nombre legible de una familia de aperturas. */
  openingName(openingFamily: string): string;
  /** Descripción de una familia de aperturas. */
  openingDescription(openingFamily: string): string;
  /** Traducción de una clave de i18n (`PUZZLES.with`, `PUZZLES.colors.*`). */
  translate(key: string): string;
}

/**
 * Deriva el título, la descripción y la imagen con los que se presenta un
 * bloque, a partir del bloque y de los catálogos que se le pasan.
 *
 * - Título: el propio del bloque si lo tiene; si no, el nombre del tema (o de
 *   la apertura, en bloques sin tema) seguido del color cuando el bloque fija
 *   uno ("Clavada con blancas"); con color aleatorio queda solo el nombre.
 * - Imagen: la del tema, salvo que todos los mates en N comparten una y los
 *   bloques sin tema llevan la de aperturas.
 * - Descripción: la propia del bloque, salvo que sea solo el texto del color
 *   (así guardaban la descripción rutinas antiguas, y repetirla debajo del
 *   título no aporta nada); en ese caso, o sin descripción, la del catálogo
 *   del tema o de la apertura.
 *
 * Solo se consulta el catálogo que corresponde (tema o apertura): consultar
 * el otro con un valor vacío deja avisos en consola.
 *
 * @param block Bloque que está a punto de jugarse.
 * @param sources Catálogos y traductor.
 * @returns Textos e imagen listos para el modal de presentación.
 */
export function buildBlockPresentation(
  block: Block,
  sources: BlockPresentationSources
): BlockPresentation {
  const theme = block.theme;
  const openingFamily = block.openingFamily || '';

  const themeOrOpeningName = theme
    ? sources.themeName(theme)
    : sources.openingName(openingFamily);

  const whiteColorText = sources.translate('PUZZLES.colors.white');
  const blackColorText = sources.translate('PUZZLES.colors.black');
  const colorText =
    block.color === 'white'
      ? whiteColorText
      : block.color === 'black'
      ? blackColorText
      : null;

  let title: string;
  if (block.title) {
    title = block.title;
  } else if (themeOrOpeningName && colorText) {
    title = `${themeOrOpeningName}${sources.translate('PUZZLES.with')}${colorText}`;
  } else {
    title = themeOrOpeningName;
  }

  const isDescriptionJustColor =
    block.description === whiteColorText ||
    block.description === blackColorText;
  const description =
    block.description && !isDescriptionJustColor
      ? block.description
      : theme
      ? sources.themeDescription(theme)
      : sources.openingDescription(openingFamily);

  return { title, description, image: blockPresentationImage(theme) };
}

/** Ruta de la imagen que ilustra el tema de un bloque (o las aperturas si no tiene). */
export function blockPresentationImage(theme: string | undefined): string {
  if (!theme) return OPENING_IMAGE;
  if (theme.includes('mateIn')) return MATE_IMAGE;
  return `/assets/images/puzzle-themes/${theme}.svg`;
}
