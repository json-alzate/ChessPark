import { BORDER_TYPE, Chessboard, ChessboardConfig } from 'cm-chessboard';

/** Carpeta de assets de cm-chessboard (piezas y estilos), copiada al build de las apps. */
export const CHESSBOARD_ASSETS_URL = 'assets/cm-chessboard/assets/';

/** Clase CSS con la que cm-chessboard viste al tablero en toda la app. */
export const CHESSBOARD_CSS_CLASS = 'chessboard-js';

/** Archivo de piezas dentro de los assets. */
export const CHESSBOARD_PIECES_FILE = 'pieces/standard.svg';

/** Extensión de cm-chessboard (Markers, Arrows, PromotionDialog...) tal como la espera su configuración. */
export interface ChessboardExtension {
  class: unknown;
  props?: Record<string, unknown>;
}

/**
 * Lo único que cambia de un tablero a otro. Todo lo demás (assets, estilo, piezas,
 * modo responsive) es común y lo fija `buildChessboardConfig`.
 */
export interface ChessboardOptions {
  /** Posición inicial en FEN. */
  position: string;
  /**
   * Lado que se ve abajo. Si no se indica, la clave `orientation` no se envía y
   * cm-chessboard usa su valor por defecto (blancas abajo).
   */
  orientation?: 'w' | 'b';
  /** Borde del tablero. Por defecto `thin`; `none` lo quita (p. ej. mapa de calor). */
  border?: 'thin' | 'none';
  /**
   * Extensiones que necesita este tablero. Si no se indica, la clave `extensions`
   * no se envía. Las clases se importan en el componente que las usa.
   */
  extensions?: ChessboardExtension[];
}

/**
 * Arma la configuración de cm-chessboard que comparten los tableros de la app.
 *
 * Es una función pura: sirve para comprobar qué configuración recibe el tablero sin
 * tener que construir uno. Solo incluye `orientation` y `extensions` cuando se piden,
 * porque cm-chessboard trata una clave presente con valor `undefined` distinto de una
 * clave ausente.
 */
export function buildChessboardConfig(options: ChessboardOptions): ChessboardConfig {
  return {
    responsive: true,
    position: options.position,
    ...(options.orientation ? { orientation: options.orientation } : {}),
    assetsUrl: CHESSBOARD_ASSETS_URL,
    assetsCache: true,
    style: {
      cssClass: CHESSBOARD_CSS_CLASS,
      borderType: BORDER_TYPE[options.border ?? 'thin'],
      pieces: { file: CHESSBOARD_PIECES_FILE },
    },
    ...(options.extensions ? { extensions: options.extensions } : {}),
  };
}

/**
 * Crea un tablero de cm-chessboard con la configuración común de la app.
 *
 * Los componentes llaman a esta función en lugar de repetir el bloque de
 * configuración: si cambia la ruta de assets, el estilo o las piezas, se cambia
 * aquí una sola vez.
 *
 * Es síncrona, como el constructor de `Chessboard`. Los componentes que ya hacían
 * `await new Chessboard(...)` conservan su `await`.
 *
 * @param container - Elemento donde se dibuja el tablero
 * @param options - Posición y lo que cambia entre tableros
 * @returns El tablero ya construido
 */
export function createChessboard(container: HTMLElement, options: ChessboardOptions): Chessboard {
  return new Chessboard(container, buildChessboardConfig(options));
}
