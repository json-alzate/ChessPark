import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  homeOutline,
  settingsOutline,
  serverOutline,
  trashOutline,
  chevronDownOutline,
} from 'ionicons/icons';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { AnalyticsService } from '@services/analytics.service';
import {
  PuzzleStorageService,
  StorageFileItem,
  StorageGroup,
} from '@services/puzzle-storage.service';
import { GamesService } from '@services/games.service';
import { GameCollectionInfo } from '@chesspark/games-provider';

addIcons({
  homeOutline,
  settingsOutline,
  serverOutline,
  trashOutline,
  chevronDownOutline,
});

/**
 * Pantalla de gestión de descargas: lista los archivos de puzzles guardados en
 * el dispositivo, agrupados por tema o apertura, y permite borrarlos uno a uno,
 * por grupo o todos de golpe.
 *
 * Todo lo que se lista es caché: borrar nunca pierde progreso, ELO ni planes,
 * solo obliga a volver a descargar el archivo la próxima vez que haga falta.
 */
@Component({
  selector: 'app-storage',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, NavbarComponent],
  templateUrl: './storage.page.html',
  styleUrls: ['./storage.page.scss'],
})
export class StoragePage implements OnInit {
  private router = inject(Router);
  private alertController = inject(AlertController);
  private translocoService = inject(TranslocoService);
  private analyticsService = inject(AnalyticsService);
  private puzzleStorageService = inject(PuzzleStorageService);
  private gamesService = inject(GamesService);

  groups: StorageGroup[] = [];
  /** Paquetes de partidas descargados; ocupan tanto como los puzzles. */
  gamePacks: GameCollectionInfo[] = [];
  gamePacksSizeBytes = 0;
  totalFiles = 0;
  totalSizeBytes = 0;
  /** El primer listado puede tardar (completa el tamaño de descargas antiguas). */
  loading = true;
  /** Claves de los grupos desplegados. */
  private expanded = new Set<string>();

  async ngOnInit(): Promise<void> {
    await this.refresh();

    // Primera medida real de cuánto caché acumula un usuario
    void this.analyticsService.logEvent('puzzle_storage_opened', {
      files_count: this.totalFiles,
      size_mb: this.toMb(this.totalSizeBytes),
    });
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  isExpanded(group: StorageGroup): boolean {
    return this.expanded.has(group.key);
  }

  toggleGroup(group: StorageGroup): void {
    if (this.expanded.has(group.key)) {
      this.expanded.delete(group.key);
    } else {
      this.expanded.add(group.key);
    }
  }

  formatBytes(bytes: number): string {
    return this.puzzleStorageService.formatBytes(bytes);
  }

  /** Tamaño de una fila, o "—" cuando no se pudo calcular. */
  fileSizeLabel(file: StorageFileItem): string {
    return file.sizeUnknown ? '—' : this.formatBytes(file.sizeBytes);
  }

  groupSizeLabel(group: StorageGroup): string {
    return group.sizeUnknown && group.sizeBytes === 0 ? '—' : this.formatBytes(group.sizeBytes);
  }

  filesCountLabel(count: number): string {
    return count === 1
      ? this.translocoService.translate('STORAGE.oneFile')
      : this.translocoService.translate('STORAGE.filesCount', { count });
  }

  async confirmDeleteFile(group: StorageGroup, file: StorageFileItem): Promise<void> {
    const confirmed = await this.confirm(
      this.translocoService.translate('STORAGE.confirm.fileTitle'),
      this.translocoService.translate('STORAGE.confirm.fileMessage', {
        name: group.name,
        eloRange: file.eloLabel,
      })
    );
    if (!confirmed) return;

    await this.puzzleStorageService.deleteFile(file.url);
    void this.analyticsService.logEvent('puzzle_storage_file_deleted', {
      theme: group.key,
      elo_start: file.eloStart ?? 0,
    });
    await this.refresh();
  }

  async confirmDeleteGroup(group: StorageGroup): Promise<void> {
    const confirmed = await this.confirm(
      this.translocoService.translate('STORAGE.confirm.groupTitle', { name: group.name }),
      this.translocoService.translate('STORAGE.confirm.groupMessage', {
        files: group.files.length,
        size: this.groupSizeLabel(group),
      })
    );
    if (!confirmed) return;

    const filesCount = group.files.length;
    const sizeMb = this.toMb(group.sizeBytes);
    await this.puzzleStorageService.deleteGroup(group);
    void this.analyticsService.logEvent('puzzle_storage_theme_deleted', {
      theme: group.key,
      files_count: filesCount,
      size_mb: sizeMb,
    });
    await this.refresh();
  }

  /** Borra el paquete de partidas de un jugador. */
  async confirmDeletePack(pack: GameCollectionInfo): Promise<void> {
    const confirmed = await this.confirm(
      this.translocoService.translate('GAMES.deletePackTitle'),
      this.translocoService.translate('GAMES.deletePackMessage', {
        name: pack.name,
      })
    );
    if (!confirmed) return;

    await this.gamesService.deletePack(pack.id);
    await this.refresh();
  }

  async confirmDeleteAll(): Promise<void> {
    const confirmed = await this.confirm(
      this.translocoService.translate('STORAGE.confirm.allTitle'),
      this.translocoService.translate('STORAGE.confirm.allMessage', {
        files: this.totalFiles,
        size: this.formatBytes(this.totalSizeBytes),
      })
    );
    if (!confirmed) return;

    const filesCount = this.totalFiles;
    const sizeMb = this.toMb(this.totalSizeBytes);
    await this.puzzleStorageService.deleteAll();
    // Si no se borraran, el total seguiría contándolos y el número mentiría.
    await this.gamesService.clearGamePacks();
    void this.analyticsService.logEvent('puzzle_storage_cleared', {
      files_count: filesCount,
      size_mb: sizeMb,
    });
    await this.refresh();
  }

  /**
   * Vuelve a leer el almacenamiento y recalcula los totales. La lista
   * encogiendo es el feedback del borrado: no hace falta un toast.
   */
  private async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [groups, packs] = await Promise.all([
        this.puzzleStorageService.getGroups(),
        this.gamesService.getDownloadedCollections(),
      ]);

      this.groups = groups;
      this.gamePacks = packs;
      this.gamePacksSizeBytes = packs.reduce(
        (total, pack) => total + pack.sizeBytes,
        0
      );

      this.totalFiles =
        this.groups.reduce((total, group) => total + group.files.length, 0) +
        packs.length;
      this.totalSizeBytes =
        this.groups.reduce((total, group) => total + group.sizeBytes, 0) +
        this.gamePacksSizeBytes;
      // Un grupo que ya no existe no debe seguir marcado como desplegado
      const keys = new Set(this.groups.map((group) => group.key));
      this.expanded = new Set([...this.expanded].filter((key) => keys.has(key)));
    } catch (error) {
      console.warn('[StoragePage] No se pudo leer el almacenamiento:', error);
      this.groups = [];
      this.gamePacks = [];
      this.gamePacksSizeBytes = 0;
      this.totalFiles = 0;
      this.totalSizeBytes = 0;
    } finally {
      this.loading = false;
    }
  }

  private async confirm(header: string, message: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: this.translocoService.translate('COMMON.actions.cancel'),
          role: 'cancel',
        },
        {
          text: this.translocoService.translate('STORAGE.confirm.delete'),
          role: 'destructive',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  /** MB con un decimal, para no enviar bytes crudos a analítica. */
  private toMb(bytes: number): number {
    return Math.round((bytes / (1024 * 1024)) * 10) / 10;
  }
}
