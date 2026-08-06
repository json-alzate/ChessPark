import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon, AlertController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  libraryOutline,
  playOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';

import { GameCollectionInfo, GameHeader } from '@chesspark/games-provider';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@services/analytics.service';
import { GamesService } from '@services/games.service';
import {
  ColorFilter,
  EMPTY_FILTERS,
  GameFilters,
  ResultFilter,
  filterGames,
  opponentOf,
  outcomeFor,
} from '@services/games.util';

addIcons({
  homeOutline,
  libraryOutline,
  playOutline,
  searchOutline,
  trashOutline,
});

/**
 * Las partidas de un jugador: el botón de modo TV, la búsqueda por rival y los
 * filtros de resultado y color.
 */
@Component({
  selector: 'app-games-player',
  templateUrl: './player.page.html',
  styleUrls: ['./player.page.scss'],
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
export class GamesPlayerPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private gamesService = inject(GamesService);
  private analytics = inject(AnalyticsService);
  private alertController = inject(AlertController);
  private transloco = inject(TranslocoService);

  collection: GameCollectionInfo | null = null;
  loading = true;
  /** Avance mientras se descarga el paquete por primera vez. */
  progress: number | null = null;
  error = false;

  /** Cabeceras de todas las partidas del paquete. */
  private allGames: GameHeader[] = [];
  /** Las que pasan los filtros; es lo que se pinta. */
  visibleGames: GameHeader[] = [];

  filters: GameFilters = { ...EMPTY_FILTERS };

  /** Cuántas filas se pintan; crece al llegar al final de la lista. */
  private readonly PAGE_SIZE = 40;
  shownCount = this.PAGE_SIZE;

  /** Es un PGN del usuario, no una colección del catálogo. */
  isUserPgn = false;

  readonly opponentOf = opponentOf;
  readonly outcomeFor = outcomeFor;

  get playerId(): string {
    return this.collection?.id ?? '';
  }

  get pagedGames(): GameHeader[] {
    return this.visibleGames.slice(0, this.shownCount);
  }

  get hasMore(): boolean {
    return this.shownCount < this.visibleGames.length;
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.isUserPgn = id === null;

    if (this.isUserPgn) {
      this.loadFromOpenPack();
      return;
    }

    await this.loadCollection(id as string);
  }

  /** El PGN que trajo el usuario ya está abierto en el servicio. */
  private loadFromOpenPack(): void {
    const pack = this.gamesService.currentPack;
    if (!pack) {
      this.router.navigate(['/games']);
      return;
    }

    this.collection = pack.collection;
    this.allGames = pack.headers;
    this.applyFilters();
    this.loading = false;
  }

  private async loadCollection(id: string): Promise<void> {
    try {
      const collection = await this.gamesService.getCollection(id);
      if (!collection) {
        this.router.navigate(['/games']);
        return;
      }
      this.collection = collection;

      const pack = await this.gamesService.openCollection(
        collection,
        (fraction) => {
          this.progress = fraction;
        }
      );
      this.allGames = pack.headers;
      this.applyFilters();
    } catch (err) {
      console.error('Error al abrir la colección:', err);
      this.error = true;
    } finally {
      this.loading = false;
      this.progress = null;
    }
  }

  // — Filtros ————————————————————————————————————————————————

  applyFilters(): void {
    this.visibleGames = filterGames(this.allGames, this.playerId, this.filters);
    this.shownCount = this.PAGE_SIZE;
  }

  setResultFilter(result: ResultFilter): void {
    this.filters.result = result;
    this.applyFilters();
  }

  setColorFilter(color: ColorFilter): void {
    this.filters.color = color;
    this.applyFilters();
  }

  showMore(): void {
    this.shownCount += this.PAGE_SIZE;
  }

  // — Navegación ————————————————————————————————————————————

  /** Abre una partida concreta. */
  openGame(header: GameHeader): void {
    this.router.navigate(['/games/viewer'], {
      queryParams: { index: header.index },
    });
  }

  /** Arranca el modo TV con las partidas que se están viendo. */
  startTv(): void {
    if (this.visibleGames.length === 0) {
      return;
    }

    void this.analytics.logEvent('games_tv_started', {
      player: this.playerId || 'own_pgn',
      games_count: this.visibleGames.length,
    });

    this.router.navigate(['/games/viewer'], {
      queryParams: { index: this.visibleGames[0].index, tv: 1 },
    });
  }

  async confirmDelete(): Promise<void> {
    if (!this.collection || this.isUserPgn) {
      return;
    }

    const alert = await this.alertController.create({
      header: this.transloco.translate('GAMES.deletePackTitle'),
      message: this.transloco.translate('GAMES.deletePackMessage', {
        name: this.collection.name,
      }),
      buttons: [
        { text: this.transloco.translate('COMMON.actions.cancel'), role: 'cancel' },
        {
          text: this.transloco.translate('GAMES.delete'),
          role: 'destructive',
          handler: () => {
            void this.deletePack();
          },
        },
      ],
    });
    await alert.present();
  }

  private async deletePack(): Promise<void> {
    if (!this.collection) {
      return;
    }
    await this.gamesService.deletePack(this.collection.id);
    this.router.navigate(['/games']);
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToCatalog(): void {
    this.router.navigate(['/games']);
  }
}
