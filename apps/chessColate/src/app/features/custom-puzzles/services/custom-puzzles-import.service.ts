import { inject, Injectable } from '@angular/core';

import { Puzzle } from '@chesspark/models';

import { AnalyticsService } from '@core/analytics/analytics.service';

import {
  CUSTOM_PGN_MAX_CHARS,
  CUSTOM_PUZZLES_MAX,
  CUSTOM_PUZZLES_MIN,
} from '../config/custom-puzzles.config';
import {
  PgnImportFailure,
  PgnImportResult,
} from '../models/custom-puzzles.model';
import {
  checkPgnText,
  limitExercises,
  parsePgnExercises,
} from '../utils/pgn-puzzles.util';

/** Cómo salió la lectura de un PGN de ejercicios. */
export type CustomPuzzlesImport =
  | {
      status: 'ok';
      /** Nombre del archivo (o vacío si se pegó el texto). */
      name: string;
      /** Los ejercicios que se usarán: los válidos, hasta el tope. */
      puzzles: Puzzle[];
      /** Válidos que sobraron por el tope de ejercicios. */
      dropped: number;
      report: PgnImportResult;
    }
  | { status: 'failed'; reason: PgnImportFailure; report?: PgnImportResult };

/**
 * Lee ejercicios propios de un archivo PGN o de texto pegado. La conversión es
 * de `utils/pgn-puzzles.util`; aquí solo se lee el archivo y se anota la analítica.
 * No guarda nada: quien use los ejercicios decide dónde viven.
 */
@Injectable({
  providedIn: 'root',
})
export class CustomPuzzlesImportService {
  private analytics = inject(AnalyticsService);

  /** Lo que el usuario eligió importar un archivo o pegó texto (antes de leerlo). */
  trackStarted(via: 'file' | 'paste'): void {
    void this.analytics.logEvent('custom_pgn_import_started', { via });
  }

  async importFile(file: File): Promise<CustomPuzzlesImport> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return this.fail('unreadable');
    }
    return this.importText(text, file.name);
  }

  importText(text: string, name = ''): CustomPuzzlesImport {
    const unreadable = checkPgnText(text, CUSTOM_PGN_MAX_CHARS);
    if (unreadable) {
      return this.fail(unreadable);
    }

    let report: PgnImportResult;
    try {
      report = parsePgnExercises(text);
    } catch {
      return this.fail('unreadable');
    }

    if (report.total === 0) {
      return this.fail('no-exercises', report);
    }
    if (report.puzzles.length === 0) {
      return this.fail('no-exercises', report);
    }

    const { kept, dropped } = limitExercises(report.puzzles, CUSTOM_PUZZLES_MAX);
    void this.analytics.logEvent('custom_pgn_import_completed', {
      total: report.total,
      imported: kept.length,
      failed: report.issues.length,
      enough: kept.length >= CUSTOM_PUZZLES_MIN,
    });
    return { status: 'ok', name, puzzles: kept, dropped, report };
  }

  private fail(reason: PgnImportFailure, report?: PgnImportResult): CustomPuzzlesImport {
    void this.analytics.logEvent('custom_pgn_import_failed', { reason });
    return { status: 'failed', reason, report };
  }
}
