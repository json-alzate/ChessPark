import { ArchiveMonth, ChessGame } from '@cpark/models';

import { CHESS_COM_CONFIG } from './constants';
import { normalizeGames } from './normalize';
import {
  ChessComArchivesResponse,
  ChessComMonthResponse,
  ChessComProviderConfig,
  ChessComUserNotFoundError,
} from './types';

/**
 * Cliente de la API pública de chess.com.
 *
 * Solo habla con la red: pide meses y los traduce al modelo común. Qué meses
 * hacen falta y dónde se guardan es cosa de quien lo llama, para que este
 * objeto se pueda probar sin base de datos ni navegador.
 *
 * chess.com pide no pasar de una petición por segundo, así que el cliente se
 * autorregula: las llamadas se encolan y salen espaciadas aunque quien las
 * pida las lance todas de golpe.
 */
export class ChessComProvider {
  readonly platform = 'chess.com' as const;

  private readonly baseUrl: string;
  private readonly minRequestIntervalMs: number;

  /** Cola de peticiones: garantiza el ritmo sin bloquear el hilo. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(config: ChessComProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? CHESS_COM_CONFIG.BASE_URL;
    this.minRequestIntervalMs =
      config.minRequestIntervalMs ?? CHESS_COM_CONFIG.MIN_REQUEST_INTERVAL_MS;
  }

  /** true si chess.com conoce a ese usuario. */
  async userExists(username: string): Promise<boolean> {
    const response = await this.request(
      `${this.baseUrl}/player/${encodeURIComponent(username.toLowerCase())}`
    );
    return response.ok;
  }

  /**
   * Los meses en que el usuario jugó algo, de más antiguo a más nuevo.
   * Evita pedir meses vacíos: una cuenta creada este año no tiene 2019.
   */
  async listArchiveMonths(username: string): Promise<ArchiveMonth[]> {
    const response = await this.request(
      `${this.baseUrl}/player/${encodeURIComponent(
        username.toLowerCase()
      )}/games/archives`
    );

    if (response.status === 404) {
      throw new ChessComUserNotFoundError(username);
    }
    if (!response.ok) {
      throw new Error(`chess.com respondió ${response.status}`);
    }

    const body = (await response.json()) as ChessComArchivesResponse;
    return (body.archives ?? [])
      .map((url) => {
        const parts = url.split('/');
        const month = Number(parts.pop());
        const year = Number(parts.pop());
        return { year, month };
      })
      .filter((month) => Number.isFinite(month.year) && month.month >= 1)
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }

  /**
   * Las partidas de un mes, ya normalizadas. Un mes sin partidas devuelve una
   * lista vacía en vez de fallar: no jugar no es un error.
   */
  async fetchMonth(
    username: string,
    { year, month }: ArchiveMonth
  ): Promise<ChessGame[]> {
    const url = `${this.baseUrl}/player/${encodeURIComponent(
      username.toLowerCase()
    )}/games/${year}/${String(month).padStart(2, '0')}`;

    const response = await this.request(url);

    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new Error(`chess.com respondió ${response.status} en ${year}/${month}`);
    }

    const body = (await response.json()) as ChessComMonthResponse;
    return normalizeGames(body.games ?? [], username);
  }

  /**
   * Encola una petición respetando el ritmo mínimo. Todas las llamadas del
   * proveedor pasan por aquí, así que el límite se cumple aunque la pantalla
   * pida varios meses a la vez.
   */
  private request(url: string): Promise<Response> {
    const next = this.queue.then(async () => {
      const waitMs = this.lastRequestAt + this.minRequestIntervalMs - Date.now();
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRequestAt = Date.now();
      return fetch(url, { headers: { Accept: 'application/json' } });
    });

    // La cola no se puede romper: si una petición falla, la siguiente sigue
    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** Instancia lista para usar, con la configuración por defecto. */
export function createChessComProvider(
  config?: ChessComProviderConfig
): ChessComProvider {
  return new ChessComProvider(config);
}
