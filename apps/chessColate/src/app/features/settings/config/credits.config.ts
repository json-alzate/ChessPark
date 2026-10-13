import type { PiecesStyle } from '@chesspark/models';
import type { CreditLicense, CreditLicenseId, PieceCredit } from '../models/credits.model';

/** Repositorio de Lichess de donde salen los sets de piezas y los colores de tablero planos. */
export const LICHESS_LILA_URL = 'https://github.com/lichess-org/lila';

/** Base de datos abierta de puzzles de Lichess (CC0). */
export const LICHESS_PUZZLES_URL = 'https://database.lichess.org/#puzzles';

export const CREDIT_LICENSES: Record<CreditLicenseId, CreditLicense> = {
  'GPL-2.0+': { label: 'GPLv2+', url: 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html' },
  MIT: { label: 'MIT', url: 'https://opensource.org/license/mit' },
  'Apache-2.0': { label: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
  'CC0-1.0': { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'CC-BY-3.0': { label: 'CC BY 3.0', url: 'https://creativecommons.org/licenses/by/3.0/' },
  'CC-BY-4.0': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
};

/**
 * Autor y licencia de cada set de piezas. Es un `Record<PiecesStyle, …>`: al añadir un set
 * nuevo a la app el compilador exige darle su crédito aquí. Detalle y criterio de licencias en
 * `docs/CREDITOS_PIEZAS.md`.
 */
export const PIECE_CREDITS: Record<PiecesStyle, PieceCredit> = {
  cburnett: {
    author: 'Colin M.L. Burnett',
    url: 'https://en.wikipedia.org/wiki/User:Cburnett',
    license: 'GPL-2.0+',
  },
  fantasy: { author: 'Maurizio Monge', url: 'https://github.com/maurimo/chess-art', license: 'MIT' },
  spatial: { author: 'Maurizio Monge', url: 'https://github.com/maurimo/chess-art', license: 'MIT' },
  celtic: { author: 'Maurizio Monge', url: 'https://github.com/maurimo/chess-art', license: 'MIT' },
  chessnut: {
    author: 'Alexis Luengas',
    url: 'https://github.com/LexLuengas/chessnut-pieces',
    license: 'Apache-2.0',
  },
  rhosgfx: { author: 'RhosGFX', url: 'https://rhosgfx.itch.io/', license: 'CC0-1.0' },
  'kiwen-suwi': { author: 'neverRare', url: 'https://github.com/neverRare', license: 'CC-BY-4.0' },
  firi: { author: 'James Faure', url: 'https://github.com/jfaure/Firi-pieceset', license: 'CC-BY-4.0' },
  totoy: { author: 'Kosal Sen', license: 'CC-BY-4.0' },
  papercut: { author: 'Nikolay Anzarov', url: 'https://nikoichu.itch.io/', license: 'CC-BY-4.0' },
};
