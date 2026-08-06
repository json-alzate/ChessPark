import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon, AlertController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  downloadOutline,
  chevronForwardOutline,
  documentTextOutline,
  libraryOutline,
  refreshOutline,
} from 'ionicons/icons';

import { GameCollectionInfo } from '@chesspark/games-provider';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@services/analytics.service';
import { GamesService } from '@services/games.service';
import { formatBytes } from '@services/games.util';

addIcons({
  homeOutline,
  downloadOutline,
  chevronForwardOutline,
  documentTextOutline,
  libraryOutline,
  refreshOutline,
});

/** Una colección con lo que la pantalla necesita saber de ella. */
interface CatalogRow {
  collection: GameCollectionInfo;
  downloaded: boolean;
  /** Fracción descargada mientras baja; null = indeterminada; undefined = quieta. */
  progress?: number | null;
  failed?: boolean;
}

/**
 * Catálogo de partidas: qué campeones hay, cuáles están en el dispositivo y
 * cuánto ocupa cada paquete antes de descargarlo.
 */
@Component({
  selector: 'app-games',
  templateUrl: './games.page.html',
  styleUrls: ['./games.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    NavbarComponent,
  ],
})
export class GamesPage implements OnInit {
  private router = inject(Router);
  private gamesService = inject(GamesService);
  private analytics = inject(AnalyticsService);
  private alertController = inject(AlertController);
  private transloco = inject(TranslocoService);

  loading = true;
  /** No se pudo traer el índice y tampoco hay nada guardado. */
  offline = false;

  rows: CatalogRow[] = [];

  /** Formulario de "abrir un PGN propio". */
  showPasteForm = false;
  pastedPgn = '';

  readonly formatBytes = formatBytes;

  get downloadedRows(): CatalogRow[] {
    return this.rows.filter((row) => row.downloaded);
  }

  get availableRows(): CatalogRow[] {
    return this.rows.filter((row) => !row.downloaded);
  }

  async ngOnInit(): Promise<void> {
    await this.load();

    void this.analytics.logEvent('games_catalog_opened', {
      downloaded_count: this.downloadedRows.length,
    });
  }

  private async load(options: { forceRefresh?: boolean } = {}): Promise<void> {
    this.loading = true;
    try {
      const [collections, downloaded] = await Promise.all([
        this.gamesService.getCatalog(options),
        this.gamesService.getDownloadedIds(),
      ]);

      this.rows = collections.map((collection) => ({
        collection,
        downloaded: downloaded.includes(collection.id),
      }));
      this.offline = this.rows.length === 0;
    } catch (error) {
      console.error('Error al cargar el catálogo de partidas:', error);
      this.offline = true;
    } finally {
      this.loading = false;
    }
  }

  refresh(): void {
    void this.load({ forceRefresh: true });
  }

  /** Descarga un paquete mostrando el avance en su propia fila. */
  async download(row: CatalogRow): Promise<void> {
    if (row.progress !== undefined) {
      return;
    }

    row.failed = false;
    row.progress = 0;

    try {
      await this.gamesService.download(row.collection, (fraction) => {
        row.progress = fraction;
      });
      row.downloaded = true;
    } catch (error) {
      console.error('Error al descargar el paquete:', error);
      row.failed = true;
    } finally {
      row.progress = undefined;
    }
  }

  openCollection(row: CatalogRow): void {
    this.router.navigate(['/games', row.collection.id]);
  }

  /** Porcentaje ya redondeado para pintarlo; null cuando no se sabe. */
  progressPercent(row: CatalogRow): number | null {
    return row.progress === null || row.progress === undefined
      ? null
      : Math.round(row.progress * 100);
  }

  // — PGN propio ————————————————————————————————————————————

  togglePasteForm(): void {
    this.showPasteForm = !this.showPasteForm;
    this.pastedPgn = '';
  }

  async openPastedPgn(): Promise<void> {
    await this.openPgn(
      this.pastedPgn,
      this.transloco.translate('GAMES.ownPgnTitle')
    );
  }

  /** Abre un archivo .pgn del dispositivo. */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      await this.openPgn(await file.text(), file.name.replace(/\.pgn$/i, ''));
    } catch (error) {
      console.error('Error al leer el archivo PGN:', error);
      await this.showInvalidPgn();
    } finally {
      // Permite volver a elegir el mismo archivo
      input.value = '';
    }
  }

  private async openPgn(pgn: string, title: string): Promise<void> {
    if (!pgn.trim()) {
      return;
    }

    const pack = this.gamesService.openUserPgn(pgn, title);
    if (!pack) {
      await this.showInvalidPgn();
      return;
    }

    this.showPasteForm = false;
    this.pastedPgn = '';
    this.router.navigate(['/games/pgn']);
  }

  private async showInvalidPgn(): Promise<void> {
    const alert = await this.alertController.create({
      header: this.transloco.translate('GAMES.invalidPgnTitle'),
      message: this.transloco.translate('GAMES.invalidPgnMessage'),
      buttons: [this.transloco.translate('COMMON.actions.close')],
    });
    await alert.present();
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }
}
