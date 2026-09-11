import { ArchiveMonth, ChessGame } from '@cpark/models';

import { LICHESS_CONFIG } from './constants';
import { normalizeGames, parseNdjson } from './normalize';
import {
  LichessProviderConfig,
  LichessRateLimitError,
  LichessUserNotFoundError,
} from './types';

/**
 * Cliente de la API pública de lichess.
 *
 * Misma idea que el de chess.com: solo habla con la red y devuelve el modelo
 * común. La diferencia está en el formato —lichess manda NDJSON, un JSON por
 * línea— y en que no hay un listado de meses con partidas, así que los meses
 * los decide quien llama.
 */
export class LichessProvider {
  readonly platform = 'lichess' as const;

  private readonly baseUrl: string;
  private readonly minRequestIntervalMs: number;

  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(config: LichessProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? LICHESS_CONFIG.BASE_URL;
    this.minRequestIntervalMs =
      config.minRequestIntervalMs ?? LICHESS_CONFIG.MIN_REQUEST_INTERVAL_MS;
  }

  /** true si lichess conoce a ese usuario. */
  async userExists(username: string): Promise<boolean> {
    const response = await this.request(
      `${this.baseUrl}/user/${encodeURIComponent(username)}`,
      'application/json'
    );
    return response.ok;
  }

  /**
   * Las partidas de un mes, ya normalizadas.
   *
   * lichess filtra por fecha, no por mes, así que se le pide el intervalo
   * exacto: desde el primer milisegundo del mes hasta el último.
   */
  async fetchMonth(
    username: string,
    { year, month }: ArchiveMonth
  ): Promise<ChessGame[]> {
    const since = new Date(year, month - 1, 1).getTime();
    const until = new Date(year, month, 1).getTime() - 1;

    return this.fetchRange(username, since, until);
  }

  /** Las partidas entre dos instantes (milisegundos UTC), ya normalizadas. */
  async fetchRange(
    username: string,
    since: number,
    until: number
  ): Promise<ChessGame[]> {
    const params = new URLSearchParams({
      since: String(since),
      until: String(until),
      perfType: LICHESS_CONFIG.PERF_TYPES,
      // Sin esto la partida llega sin PGN ni nombre de apertura
      pgnInJson: 'true',
      opening: 'true',
    });

    const url = `${this.baseUrl}/games/user/${encodeURIComponent(
      username
    )}?${params.toString()}`;

    const response = await this.request(url, 'application/x-ndjson');

    if (response.status === 404) {
      throw new LichessUserNotFoundError(username);
    }
    if (response.status === 429) {
      throw new LichessRateLimitError();
    }
    if (!response.ok) {
      throw new Error(`lichess respondió ${response.status}`);
    }

    return normalizeGames(parseNdjson(await response.text()), username);
  }

  /**
   * Encola una petición respetando el ritmo mínimo, igual que el conector de
   * chess.com: descargar un año no debe convertirse en una ráfaga.
   */
  private request(url: string, accept: string): Promise<Response> {
    const next = this.queue.then(async () => {
      const waitMs = this.lastRequestAt + this.minRequestIntervalMs - Date.now();
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRequestAt = Date.now();
      return fetch(url, { headers: { Accept: accept } });
    });

    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** Instancia lista para usar, con la configuración por defecto. */
export function createLichessProvider(
  config?: LichessProviderConfig
): LichessProvider {
  return new LichessProvider(config);
}
