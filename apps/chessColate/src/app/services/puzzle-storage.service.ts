import { Injectable, inject } from '@angular/core';

import { TranslocoService } from '@jsverse/transloco';

import {
  CachedFileIndexEntry,
  PuzzlesProvider,
  StorageSummary,
} from '@chesspark/puzzles-provider';

import { AppService } from '@services/app.service';

/** Un archivo descargado, tal como se muestra en una fila de la lista. */
export interface StorageFileItem {
  /** URL del CDN — clave de borrado. Nunca se muestra al usuario. */
  url: string;
  eloStart?: number;
  eloEnd?: number;
  /** Rango listo para pintar: "1500–1519", o "—" si no se pudo derivar. */
  eloLabel: string;
  count?: number;
  sizeBytes: number;
  /** true si el tamaño no se pudo calcular (se pinta "—") */
  sizeUnknown: boolean;
  timestamp: number;
}

/** Grupo de archivos de un mismo tema o de una misma apertura. */
export interface StorageGroup {
  /** Valor interno: 'fork', 'Sicilian_Defense'… */
  key: string;
  kind: 'theme' | 'opening' | 'unknown';
  /** Nombre traducido para mostrar. */
  name: string;
  files: StorageFileItem[];
  sizeBytes: number;
  sizeUnknown: boolean;
}

/**
 * Fachada de la pantalla de gestión de descargas.
 *
 * Traduce lo que hay en IndexedDB (URLs del CDN) a algo legible: agrupa por
 * tema o apertura, resuelve nombres traducidos y formatea tamaños. La página
 * nunca habla con `PuzzlesCacheService` directamente ni ve una URL.
 */
@Injectable({ providedIn: 'root' })
export class PuzzleStorageService {
  private puzzlesProvider = inject(PuzzlesProvider);
  private appService = inject(AppService);
  private translocoService = inject(TranslocoService);

  private get cacheService() {
    return this.puzzlesProvider.getCacheService();
  }

  /**
   * Lista los archivos descargados agrupados por tema/apertura, de mayor a
   * menor tamaño: quien entra aquí viene a liberar espacio, así que lo caro
   * va primero.
   */
  async getGroups(): Promise<StorageGroup[]> {
    const entries = await this.cacheService.listCachedFiles();
    const groups = new Map<string, StorageGroup>();

    for (const entry of entries) {
      const { key, kind } = this.resolveGroupKey(entry);

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          kind,
          name: this.resolveGroupName(key, kind),
          files: [],
          sizeBytes: 0,
          sizeUnknown: false,
        };
        groups.set(key, group);
      }

      const sizeUnknown = entry.sizeBytes === undefined;
      group.files.push({
        url: entry.key,
        eloStart: entry.eloStart,
        eloEnd: entry.eloEnd,
        eloLabel: this.formatEloRange(entry.eloStart, entry.eloEnd),
        count: entry.count,
        sizeBytes: entry.sizeBytes ?? 0,
        sizeUnknown,
        timestamp: entry.timestamp,
      });
      group.sizeBytes += entry.sizeBytes ?? 0;
      group.sizeUnknown = group.sizeUnknown || sizeUnknown;
    }

    const result = [...groups.values()];
    for (const group of result) {
      // Dentro de un tema el orden natural es por dificultad, no por tamaño
      group.files.sort((a, b) => (a.eloStart ?? 0) - (b.eloStart ?? 0));
    }
    result.sort((a, b) => b.sizeBytes - a.sizeBytes);

    return result;
  }

  /** Totales para el resumen de Ajustes. */
  async getSummary(): Promise<StorageSummary> {
    return this.cacheService.getStorageSummary();
  }

  /** Borra un archivo concreto. */
  async deleteFile(url: string): Promise<void> {
    await this.cacheService.deleteCachedPuzzles(url);
  }

  /** Borra todos los archivos de un tema o apertura. */
  async deleteGroup(group: StorageGroup): Promise<void> {
    await this.cacheService.deleteCachedFiles(group.files.map((file) => file.url));
  }

  /**
   * Borra todo lo almacenado: los archivos de puzzles y el pool de
   * entrenamiento continuo, que vive en otro store. Si no se vaciara el pool,
   * "borrar todo" dejaría ~50 puzzles dentro y el total mostrado mentiría.
   */
  async deleteAll(): Promise<void> {
    await this.cacheService.clearCache();
    await this.cacheService.clearInfinityPool();
  }

  /**
   * Formatea bytes con el separador decimal del idioma activo
   * (18,3 MB en español · 18.3 MB en inglés).
   */
  formatBytes(bytes: number): string {
    if (!bytes || bytes < 0) return '0 KB';

    const locale = this.translocoService.getActiveLang() === 'es' ? 'es-ES' : 'en-US';
    const units: { limit: number; divisor: number; suffix: string; decimals: number }[] = [
      { limit: 1024 * 1024, divisor: 1024, suffix: 'KB', decimals: 0 },
      { limit: 1024 * 1024 * 1024, divisor: 1024 * 1024, suffix: 'MB', decimals: 1 },
      { limit: Infinity, divisor: 1024 * 1024 * 1024, suffix: 'GB', decimals: 2 },
    ];

    if (bytes < 1024) {
      return '< 1 KB';
    }

    const unit = units.find((candidate) => bytes < candidate.limit) ?? units[units.length - 1];
    const value = bytes / unit.divisor;
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: unit.decimals,
      maximumFractionDigits: unit.decimals,
    }).format(value);

    return `${formatted} ${unit.suffix}`;
  }

  /** "1500–1519" (guión largo, como en el diseño). */
  private formatEloRange(eloStart?: number, eloEnd?: number): string {
    if (eloStart === undefined || eloEnd === undefined) return '—';
    return `${eloStart}–${eloEnd}`;
  }

  private resolveGroupKey(entry: CachedFileIndexEntry): {
    key: string;
    kind: StorageGroup['kind'];
  } {
    if (entry.theme) return { key: entry.theme, kind: 'theme' };
    if (entry.opening) return { key: entry.opening, kind: 'opening' };
    return { key: '__unknown__', kind: 'unknown' };
  }

  /**
   * Nombre traducido del tema/apertura. Si el catálogo no lo conoce (tema
   * nuevo en el CDN, o datos aún sin cargar) se cae al valor interno antes
   * que dejar la fila sin título.
   */
  private resolveGroupName(key: string, kind: StorageGroup['kind']): string {
    if (kind === 'theme') {
      return this.appService.getNameThemePuzzleByValue(key) || key;
    }
    if (kind === 'opening') {
      return this.appService.getNameOpeningByValue(key) || key.replace(/_/g, ' ');
    }
    return this.translocoService.translate('STORAGE.otherFiles');
  }
}
