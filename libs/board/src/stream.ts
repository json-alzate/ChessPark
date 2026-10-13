/**
 * Entrada de `@chesspark/board` sin Ionic, para apps que solo muestran tableros
 * (p. ej. la transmisión en directo).
 *
 * El barrel principal (`index.ts`) exporta también `board-puzzle` y `board-puzzle-solution`,
 * que importan `@ionic/angular`: con solo importar el barrel, esas dependencias terminan
 * en el bundle aunque la app no use esos componentes. Esta entrada no pasa por ellos.
 */
export * from './lib/board-game-player/board-game-player.component';
export * from './lib/chessboard-appearance/chessboard-appearance';
