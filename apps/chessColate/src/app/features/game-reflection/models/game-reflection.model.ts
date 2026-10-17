import { ChessPlatform, UserOutcome } from '@chesspark/models';

/** Un tag que el usuario creó. El texto es suyo y no se traduce. */
export interface GameTag {
  /** 'u_a8f3k2'. Es lo que guardan las reflexiones, no el texto. */
  id: string;
  /** Nombre corto tal como lo escribió. */
  label: string;
  createdAt: number;
  /** Oculto en las sugerencias; las reflexiones antiguas lo siguen mostrando. */
  archived?: boolean;
}

/**
 * Lo que el usuario anotó de una partida.
 *
 * Los tags se guardan por id —clave de la lista del sistema o id de un tag
 * propio—, nunca por texto: así renombrar un tag o cambiar de idioma no parte
 * las estadísticas. La plataforma, la fecha y el resultado van copiados para
 * poder cruzarlos sin tener que volver a descargar la partida.
 */
export interface GameReflection {
  /** 'lichess:q7ZvsdUF': identificador de la partida en la plataforma. */
  gameKey: string;
  platform: ChessPlatform;
  playedAt: number;
  outcome: UserOutcome;
  /** Lo mejor que hizo. */
  best: string[];
  /** Lo que debe mejorar. */
  improve: string[];
  updatedAt: number;
}

/** Cuál de las dos listas de la reflexión. */
export type ReflectionList = 'best' | 'improve';

/** Una opción lista para pintar: ya con su texto visible. */
export interface TagOption {
  id: string;
  label: string;
  /** true si es de la lista del sistema (texto traducido). */
  system: boolean;
}
