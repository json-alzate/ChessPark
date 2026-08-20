import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  refreshOutline,
  statsChartOutline,
  trashOutline,
  linkOutline,
} from 'ionicons/icons';

import { ChessGame, ChessPlatform, TimeClass } from '@cpark/models';
import {
  ActivityDay,
  applyFilters,
  GeneralStats,
  getActivityHeatmap,
  getGeneralStats,
  getOpeningStats,
  getRatingProgress,
  OpeningStats,
  RatingDataPoint,
  ReportFilters,
} from '@chesspark/game-reporter';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@services/analytics.service';
import {
  GameAnalyticsService,
  UnknownUsernameError,
} from '@services/game-analytics.service';
import {
  ConnectedAccounts,
  HISTORY_RANGES,
  HistoryRange,
  platformLabel,
  TIME_CLASSES,
  toPercent,
} from '@services/game-analytics.util';

import { ActivityHeatmapComponent } from './components/activity-heatmap/activity-heatmap.component';
import { OpeningsTableComponent } from './components/openings-table/openings-table.component';
import { RatingChartComponent } from './components/rating-chart/rating-chart.component';

addIcons({
  homeOutline,
  refreshOutline,
  statsChartOutline,
  trashOutline,
  linkOutline,
});

/**
 * Análisis de las partidas del usuario en chess.com y lichess.
 *
 * La pantalla tiene dos caras: la de conectar una cuenta, cuando aún no hay
 * ninguna, y la del reporte. Al volver se pinta primero lo que ya está en el
 * dispositivo y solo después se va a la red: los números aparecen al instante
 * aunque la descarga tarde.
 */
@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    NavbarComponent,
    RatingChartComponent,
    ActivityHeatmapComponent,
    OpeningsTableComponent,
  ],
})
export class AnalyticsPage implements OnInit {
  private router = inject(Router);
  private alertController = inject(AlertController);
  private transloco = inject(TranslocoService);
  private analytics = inject(AnalyticsService);
  private gameAnalytics = inject(GameAnalyticsService);

  /** Formulario de conexión. */
  chesscomInput = '';
  lichessInput = '';
  historyMonths: HistoryRange = 6;

  /** Cuentas ya guardadas; mientras estén vacías se ve el formulario. */
  accounts: ConnectedAccounts = { chesscom: '', lichess: '' };

  loading = true;
  syncing = false;
  /** Comprobando que los nombres existen antes de descargar. */
  verifying = false;
  /** Qué falló en la última operación, ya traducido. */
  errorMessage = '';

  /** Avance de la descarga, de 0 a 100. */
  progressPercent = 0;
  progressLabel = '';

  /** Todas las partidas descargadas, sin filtrar. */
  private allGames: ChessGame[] = [];

  // Filtros de la pantalla
  platformFilter: ChessPlatform | 'both' = 'both';
  timeClassFilter: TimeClass[] = [];

  // Reportes ya calculados
  stats: GeneralStats | null = null;
  ratingPoints: RatingDataPoint[] = [];
  openings: OpeningStats[] = [];
  activityDays: ActivityDay[] = [];

  readonly historyRanges = HISTORY_RANGES;
  readonly timeClasses = TIME_CLASSES;
  readonly platformLabel = platformLabel;
  readonly toPercent = toPercent;

  get hasAccounts(): boolean {
    return Boolean(this.accounts.chesscom || this.accounts.lichess);
  }

  /** Hay cuentas conectadas pero ninguna partida que enseñar. */
  get allGamesEmpty(): boolean {
    return this.allGames.length === 0;
  }

  get canConnect(): boolean {
    return Boolean(this.chesscomInput.trim() || this.lichessInput.trim());
  }

  /** Las cuentas conectadas, para listarlas y poder desconectarlas. */
  get connectedList(): Array<{ platform: ChessPlatform; username: string }> {
    const list: Array<{ platform: ChessPlatform; username: string }> = [];
    if (this.accounts.chesscom) {
      list.push({ platform: 'chess.com', username: this.accounts.chesscom });
    }
    if (this.accounts.lichess) {
      list.push({ platform: 'lichess', username: this.accounts.lichess });
    }
    return list;
  }

  async ngOnInit(): Promise<void> {
    const settings = this.gameAnalytics.getSettings();
    this.accounts = settings.accounts;
    this.historyMonths = settings.historyMonths;
    this.chesscomInput = settings.accounts.chesscom;
    this.lichessInput = settings.accounts.lichess;

    if (this.hasAccounts) {
      this.allGames = await this.gameAnalytics.loadStored(this.accounts);
      this.recalculate();

      // Nada guardado todavía: la primera descarga tiene que salir sola
      if (this.allGames.length === 0) {
        void this.sync();
      }
    }

    this.loading = false;

    void this.analytics.logEvent('game_analytics_opened', {
      connected: this.connectedList.length,
      games_count: this.allGames.length,
    });
  }

  // — Conectar ————————————————————————————————————————————————

  /** Guarda las cuentas escritas y arranca la primera descarga. */
  async connect(): Promise<void> {
    if (!this.canConnect || this.verifying) {
      return;
    }

    this.errorMessage = '';
    this.verifying = true;

    try {
      const chesscom = this.chesscomInput.trim();
      const lichess = this.lichessInput.trim();

      if (chesscom && !(await this.gameAnalytics.verifyUsername('chess.com', chesscom))) {
        await this.showUnknownUsername('chess.com', chesscom);
        return;
      }
      if (lichess && !(await this.gameAnalytics.verifyUsername('lichess', lichess))) {
        await this.showUnknownUsername('lichess', lichess);
        return;
      }

      this.accounts = { chesscom, lichess };
      this.gameAnalytics.saveSettings({
        accounts: this.accounts,
        historyMonths: this.historyMonths,
      });

      void this.analytics.logEvent('game_analytics_connected', {
        platforms: [chesscom ? 'chesscom' : '', lichess ? 'lichess' : '']
          .filter(Boolean)
          .join('+'),
        history_months: this.historyMonths,
      });
    } finally {
      this.verifying = false;
    }

    await this.sync();
  }

  /** Desconecta una cuenta y borra sus partidas del dispositivo. */
  async disconnect(platform: ChessPlatform, username: string): Promise<void> {
    const confirmed = await this.confirm(
      this.transloco.translate('ANALYTICS.disconnectTitle'),
      this.transloco.translate('ANALYTICS.disconnectMessage', {
        platform: platformLabel(platform),
        username,
      })
    );
    if (!confirmed) {
      return;
    }

    const settings = await this.gameAnalytics.disconnect(platform, username);
    this.accounts = settings.accounts;
    this.chesscomInput = settings.accounts.chesscom;
    this.lichessInput = settings.accounts.lichess;

    this.allGames = this.hasAccounts
      ? await this.gameAnalytics.loadStored(this.accounts)
      : [];
    this.recalculate();
  }

  // — Descargar ————————————————————————————————————————————————

  /** Pide a las plataformas lo que falte y recalcula los reportes. */
  async sync(): Promise<void> {
    if (this.syncing || !this.hasAccounts) {
      return;
    }

    this.syncing = true;
    this.errorMessage = '';
    this.progressPercent = 0;
    this.progressLabel = '';

    try {
      this.allGames = await this.gameAnalytics.sync(
        this.accounts,
        this.historyMonths,
        (progress) => {
          this.progressPercent = Math.round(
            (progress.done / Math.max(progress.total, 1)) * 100
          );
          this.progressLabel = `${platformLabel(progress.platform)} · ${progress.monthKey}`;
        }
      );
      this.recalculate();
    } catch (error) {
      console.error('Error al descargar las partidas:', error);
      this.errorMessage =
        error instanceof UnknownUsernameError
          ? this.transloco.translate('ANALYTICS.errors.unknownUser', {
              platform: platformLabel(error.platform),
            })
          : this.transloco.translate('ANALYTICS.errors.syncFailed');
    } finally {
      this.syncing = false;
    }
  }

  /** Cambiar el rango obliga a bajar los meses que aún no estén. */
  async setHistoryRange(months: HistoryRange): Promise<void> {
    if (months === this.historyMonths) {
      return;
    }
    this.historyMonths = months;
    this.gameAnalytics.saveSettings({ historyMonths: months });

    if (this.hasAccounts) {
      await this.sync();
    }
  }

  // — Filtros ————————————————————————————————————————————————

  setPlatformFilter(platform: ChessPlatform | 'both'): void {
    this.platformFilter = platform;
    this.recalculate();
    void this.analytics.logEvent('game_analytics_filtered', {
      platform,
      time_classes: this.timeClassFilter.join(',') || 'all',
    });
  }

  toggleTimeClass(timeClass: TimeClass): void {
    this.timeClassFilter = this.timeClassFilter.includes(timeClass)
      ? this.timeClassFilter.filter((item) => item !== timeClass)
      : [...this.timeClassFilter, timeClass];
    this.recalculate();
  }

  isTimeClassActive(timeClass: TimeClass): boolean {
    return this.timeClassFilter.includes(timeClass);
  }

  /** Qué familias de tiempo hay realmente entre las partidas descargadas. */
  get availableTimeClasses(): TimeClass[] {
    const present = new Set(this.allGames.map((game) => game.timeClass));
    return this.timeClasses.filter((timeClass) => present.has(timeClass));
  }

  /** Las plataformas que tienen partidas; con una sola no hay nada que elegir. */
  get availablePlatforms(): ChessPlatform[] {
    return [...new Set(this.allGames.map((game) => game.source))];
  }

  /**
   * Recalcula los cuatro reportes sobre el subconjunto filtrado.
   *
   * Se filtra una vez y se reparte: cada reporte recorre la lista una vez más,
   * lo que para unos miles de partidas es inmediato y evita tener que
   * sincronizar cachés entre ellos.
   */
  private recalculate(): void {
    const filters: ReportFilters = {
      platform: this.platformFilter,
      timeClasses: this.timeClassFilter,
    };

    const games = applyFilters(this.allGames, filters);

    this.stats = games.length ? getGeneralStats(games) : null;
    this.ratingPoints = getRatingProgress(games);
    this.openings = getOpeningStats(games);
    this.activityDays = getActivityHeatmap(games);
  }

  // — Ayudas de plantilla ————————————————————————————————————

  formatDate(timestamp: number): string {
    if (!timestamp) {
      return '—';
    }
    return new Date(timestamp).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  private async showUnknownUsername(
    platform: ChessPlatform,
    username: string
  ): Promise<void> {
    const alert = await this.alertController.create({
      header: this.transloco.translate('ANALYTICS.errors.unknownUserTitle'),
      message: this.transloco.translate('ANALYTICS.errors.unknownUser', {
        platform: platformLabel(platform),
        username,
      }),
      buttons: [this.transloco.translate('COMMON.actions.close')],
    });
    await alert.present();
  }

  private async confirm(header: string, message: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: this.transloco.translate('COMMON.actions.cancel'),
          role: 'cancel',
        },
        {
          text: this.transloco.translate('STORAGE.confirm.delete'),
          role: 'destructive',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }
}
