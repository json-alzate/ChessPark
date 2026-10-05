import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

import { OpeningStats } from '@chesspark/game-reporter';

import {
  CatalogOpening,
  catalogOpeningFor,
  toPercent,
} from '@services/game-analytics.util';

/** Cuántas filas se ven antes de pedir "ver más". */
const PAGE_SIZE = 8;

/**
 * Rendimiento por apertura, de la más jugada a la menos.
 *
 * Solo se listan las aperturas con un mínimo de partidas: una fila con una sola
 * partida y "100 %" no dice nada de cómo se juega esa apertura.
 */
@Component({
  selector: 'app-openings-table',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './openings-table.component.html',
  styleUrls: ['./openings-table.component.scss'],
})
export class OpeningsTableComponent implements OnChanges {
  @Input() openings: OpeningStats[] = [];
  /** Partidas mínimas para que una apertura aparezca. */
  @Input() minGames = 3;
  /** Catálogo de puzzles: solo las aperturas que aparecen en él se pueden practicar. */
  @Input() catalog: CatalogOpening[] = [];
  /** La apertura que el usuario quiere practicar. */
  @Output() practice = new EventEmitter<CatalogOpening>();

  rows: OpeningStats[] = [];
  visible = PAGE_SIZE;

  readonly toPercent = toPercent;

  ngOnChanges(): void {
    this.rows = this.openings.filter((row) => row.games >= this.minGames);
    this.visible = PAGE_SIZE;
  }

  get shownRows(): OpeningStats[] {
    return this.rows.slice(0, this.visible);
  }

  get hasMore(): boolean {
    return this.visible < this.rows.length;
  }

  practiceFor(row: OpeningStats): CatalogOpening | null {
    return catalogOpeningFor(row, this.catalog);
  }

  showMore(): void {
    this.visible += PAGE_SIZE;
  }
}
