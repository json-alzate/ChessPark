import { Component, ElementRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  copyOutline,
  documentTextOutline,
  downloadOutline,
  warningOutline,
} from 'ionicons/icons';

import { Puzzle } from '@chesspark/models';

import {
  CUSTOM_PGN_ISSUES_SHOWN,
  CUSTOM_PGN_TEMPLATE_FILE,
  CUSTOM_PUZZLES_MAX,
  CUSTOM_PUZZLES_MIN,
} from '../../config/custom-puzzles.config';
import { CUSTOM_PGN_TEMPLATE } from '../../config/custom-pgn-template';
import { PgnImportFailure, PgnIssue, PgnNote } from '../../models/custom-puzzles.model';
import {
  CustomPuzzlesImport,
  CustomPuzzlesImportService,
} from '../../services/custom-puzzles-import.service';

/** Los ejercicios leídos, listos para usar. */
export interface PgnImported {
  name: string;
  puzzles: Puzzle[];
}

/**
 * Pide un PGN de ejercicios (archivo o texto pegado), lo lee y enseña el
 * informe: cuántos entraron y, de los que no, cuál es y por qué. También trae
 * la ayuda con la estructura del archivo y un ejemplo.
 *
 * No guarda nada: avisa de lo cargado (o de que ya no hay nada cargado) y
 * quien lo usa decide qué hacer.
 */
@Component({
  selector: 'app-pgn-importer',
  standalone: true,
  imports: [TranslocoPipe, IonIcon],
  templateUrl: './pgn-importer.component.html',
})
export class PgnImporterComponent {
  private importService = inject(CustomPuzzlesImportService);

  @Output() imported = new EventEmitter<PgnImported | null>();

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  readonly maxExercises = CUSTOM_PUZZLES_MAX;
  readonly minExercises = CUSTOM_PUZZLES_MIN;
  readonly template = CUSTOM_PGN_TEMPLATE;
  readonly issuesShown = CUSTOM_PGN_ISSUES_SHOWN;

  pastedText = '';
  reading = false;
  copied = false;

  /** Lo último que se leyó bien. */
  loaded: Extract<CustomPuzzlesImport, { status: 'ok' }> | null = null;
  /** Por qué no se pudo leer lo último. */
  failure: PgnImportFailure | null = null;
  /** Informe del último intento (también cuando no entró ninguno). */
  issues: PgnIssue[] = [];
  notes: PgnNote[] = [];

  constructor() {
    addIcons({
      checkmarkCircleOutline,
      copyOutline,
      documentTextOutline,
      downloadOutline,
      warningOutline,
    });
  }

  get tooFew(): boolean {
    return !!this.loaded && this.loaded.puzzles.length < this.minExercises;
  }

  get hiddenIssues(): number {
    return Math.max(0, this.issues.length - this.issuesShown);
  }

  pickFile(): void {
    this.importService.trackStarted('file');
    this.fileInput?.nativeElement.click();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se vacía para poder elegir otra vez el mismo archivo (ya corregido)
    input.value = '';
    if (!file) {
      return;
    }
    this.reading = true;
    this.apply(await this.importService.importFile(file));
    this.reading = false;
  }

  readPasted(): void {
    this.importService.trackStarted('paste');
    this.apply(this.importService.importText(this.pastedText));
  }

  clear(): void {
    this.pastedText = '';
    this.loaded = null;
    this.failure = null;
    this.issues = [];
    this.notes = [];
    this.imported.emit(null);
  }

  async copyTemplate(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.template);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el ejemplo sigue a la vista para copiarlo a mano
    }
  }

  downloadTemplate(): void {
    const url = URL.createObjectURL(new Blob([this.template], { type: 'application/x-chess-pgn' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = CUSTOM_PGN_TEMPLATE_FILE;
    link.click();
    URL.revokeObjectURL(url);
  }

  private apply(result: CustomPuzzlesImport): void {
    this.issues = result.report?.issues ?? [];
    this.notes = result.report?.notes ?? [];

    if (result.status === 'ok') {
      this.loaded = result;
      this.failure = null;
      this.imported.emit(
        result.puzzles.length >= this.minExercises
          ? { name: result.name, puzzles: result.puzzles }
          : null
      );
      return;
    }

    this.loaded = null;
    this.failure = result.reason;
    this.imported.emit(null);
  }
}
