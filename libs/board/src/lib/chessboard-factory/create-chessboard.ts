import { BORDER_TYPE, Chessboard, ChessboardConfig } from 'cm-chessboard';
import {
  CHESSBOARD_ASSETS_URL,
  getChessboardAppearance,
  PIECES_FILES,
} from '../chessboard-appearance/chessboard-appearance';

export { CHESSBOARD_ASSETS_URL };

/** Extensión de cm-chessboard (Markers, Arrows, PromotionDialog...) tal como la espera su configuración. */
export interface ChessboardExtension {
  class: unknown;
  props?: Record<string, unknown>;
}

/**
 * Lo único que cambia de un tablero a otro. Todo lo demás (assets, estilo, piezas,
 * modo responsive) es común y lo fija `buildChessboardConfig`; el color del tablero y
 * el set de piezas salen de la apariencia que eligió el usuario.
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
  const appearance = getChessboardAppearance();
  return {
    responsive: true,
    position: options.position,
    ...(options.orientation ? { orientation: options.orientation } : {}),
    assetsUrl: CHESSBOARD_ASSETS_URL,
    assetsCache: true,
    style: {
      cssClass: appearance.board,
      borderType: BORDER_TYPE[options.border ?? 'thin'],
      pieces: { file: PIECES_FILES[appearance.pieces] },
    },
    ...(options.extensions ? { extensions: options.extensions } : {}),
  };
}

/**
 * Pone en una configuración ya armada el color y las piezas que eligió el usuario.
 *
 * Es para los tableros que reciben su configuración completa desde fuera
 * (`lib-board`, `lib-chess960-board`) y no pasan por `buildChessboardConfig`.
 */
export function withChessboardAppearance(config: ChessboardConfig): ChessboardConfig {
  const appearance = getChessboardAppearance();
  return {
    ...config,
    style: {
      ...config.style,
      cssClass: appearance.board,
      pieces: { ...config.style?.pieces, file: PIECES_FILES[appearance.pieces] },
    },
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
