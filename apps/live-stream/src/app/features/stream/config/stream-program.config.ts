/** Un bloque del programa: qué tema se emite durante un rato. */
export interface ProgramBlock {
  /** Valor del tema tal como lo conoce `puzzles-provider` (p. ej. `mateIn2`). */
  theme: string;
  /** Nombre que se muestra en el panel, en inglés sencillo (basado en el de ChessColate). */
  label: string;
}

/**
 * Temas del directo, en el orden en que rotan. Alternan tácticas y mates para que no se
 * sienta repetitivo. El ELO no depende del tema: sube por su cuenta (ver `elo-ladder.util`).
 * Todos tienen archivos en el manifiesto de `puzzles-provider` en el rango de ELO de la escalera.
 */
export const DEFAULT_PROGRAM: readonly ProgramBlock[] = [
  { theme: 'fork', label: 'Fork' },
  { theme: 'mateIn2', label: 'Mate in 2' },
  { theme: 'pin', label: 'Pin' },
  { theme: 'hangingPiece', label: 'Hanging Piece' },
  { theme: 'backRankMate', label: 'Back Rank Mate' },
  { theme: 'skewer', label: 'Skewer' },
  { theme: 'sacrifice', label: 'Sacrifice' },
  { theme: 'discoveredAttack', label: 'Discovered Attack' },
  { theme: 'deflection', label: 'Deflection' },
  { theme: 'mateIn3', label: 'Mate in 3' },
  { theme: 'trappedPiece', label: 'Trapped Piece' },
  { theme: 'quietMove', label: 'Quiet Move' },
];
