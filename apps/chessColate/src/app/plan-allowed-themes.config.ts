import { PlanTypes } from '@cpark/models';

/**
 * Temas permitidos por plan por defecto.
 * Solo se usan valores que existan en AVAILABLE_THEMES de la librería @chesspark/puzzles-provider.
 * Si un plan no está definido o tiene array vacío, se usa la lista completa de temas.
 * 
 * IMPORTANTE: Todos los temas hardcodeados en block.service.ts deben estar en estas listas:
 * - Plan 10 usa: 'mateIn1', 'endgame' (deben estar en plan10)
 * - Plan 20 usa: 'mateIn1', 'endgame', 'mateIn3' (deben estar en plan20)
 * - Plan 30 usa: 'mateIn1', 'endgame', 'pawnEndgame', 'mateIn4' (deben estar en plan30)
 */
export const PLAN_ALLOWED_THEMES: Partial<Record<PlanTypes, string[]>> = {
  // Plan 3: Fundamentos básicos
  plan3: [
    'opening',
    'middlegame',
    'endgame',
    'fork',
    'pin',
    'skewer',
    'hangingPiece',
    'mateIn1',
    'mateIn2',
    'short',
    'oneMove'
  ],

  // Plan 5: Intermedio con mates
  plan5: [
    'opening',
    'middlegame',
    'endgame',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'sacrifice',
    'mateIn1',
    'mateIn2',
    'mateIn3',
    'backRankMate',
    'short',
    'long',
    'oneMove'
  ],

  // Plan 10: Variado sin temas muy avanzados
  // INCLUYE: 'mateIn1', 'endgame' (usados en bloques 3 y 4)
  plan10: [
    'opening',
    'middlegame',
    'endgame', // ✅ REQUERIDO - usado en bloque 4
    'rookEndgame',
    'bishopEndgame',
    'pawnEndgame',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'sacrifice',
    'attraction',
    'deflection',
    'mate',
    'mateIn1', // ✅ REQUERIDO - usado en bloque 3
    'mateIn2',
    'mateIn3',
    'backRankMate',
    'smotheredMate',
    'short',
    'long',
    'oneMove'
  ],

  // Plan 20: Temas avanzados y mates complejos
  // INCLUYE: 'mateIn1', 'endgame', 'mateIn3' (usados en bloques 3, 6, 7)
  plan20: [
    'opening',
    'middlegame',
    'endgame', // ✅ REQUERIDO - usado en bloque 6
    'rookEndgame',
    'bishopEndgame',
    'pawnEndgame',
    'knightEndgame',
    'queenEndgame',
    'queenRookEndgame',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'sacrifice',
    'attraction',
    'deflection',
    'interference',
    'intermezzo',
    'quietMove',
    'mate',
    'mateIn1', // ✅ REQUERIDO - usado en bloque 3
    'mateIn2',
    'mateIn3', // ✅ REQUERIDO - usado en bloque 7
    'mateIn4',
    'backRankMate',
    'smotheredMate',
    'hookMate',
    'short',
    'long',
    'veryLong',
    'oneMove'
  ],

  // Plan 30: SOLO temas avanzados y complejos
  // INCLUYE: 'mateIn1', 'endgame', 'pawnEndgame', 'mateIn4' (usados en bloques 3, 6, 6)
  plan30: [
    // Fases del juego
    'opening',
    'middlegame',
    'endgame', // ✅ REQUERIDO - usado en bloque 6
    'rookEndgame',
    'bishopEndgame',
    'pawnEndgame', // ✅ REQUERIDO - usado en bloque 6
    'knightEndgame',
    'queenEndgame',
    'queenRookEndgame',

    // Temas tácticos intermedios
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'sacrifice',
    'capturingDefender',
    'exposedKing',
    'hangingPiece',
    'kingsideAttack',
    'queensideAttack',
    'trappedPiece',

    // Temas avanzados (prioridad)
    'attraction',
    'clearance',
    'defensiveMove',
    'deflection',
    'interference',
    'intermezzo',
    'quietMove',
    'xRayAttack',
    'zugzwang',

    // Mates complejos (NO básicos)
    'mate',
    'mateIn2',
    'mateIn3',
    'mateIn4', // ✅ REQUERIDO - usado en bloque 5
    'mateIn5',
    'backRankMate',

    // Duración (solo ejercicios largos)
    'long',
    'veryLong',

    // Objetivos
    'equality',
    'advantage',
    'crushing'
  ]
};
