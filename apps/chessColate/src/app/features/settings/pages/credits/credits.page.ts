import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { homeOutline, settingsOutline } from 'ionicons/icons';
import type { PiecesStyle } from '@chesspark/models';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import {
  CREDIT_LICENSES,
  LICHESS_LILA_URL,
  LICHESS_PUZZLES_URL,
  PIECE_CREDITS,
} from '../../config/credits.config';
import { MUSIC_CREDITS } from '../../config/music-credits.config';
import { countAuthors, formatDuration, groupMusicByLicense } from '../../utils/credits.util';

addIcons({ homeOutline, settingsOutline });

const MUSIC_SOURCE_NAMES = { ccmixter: 'ccMixter', commons: 'Wikimedia Commons' } as const;

/**
 * Créditos y licencias de lo que la app usa de terceros: piezas, puzzles y la música del directo.
 * Es pública (sin sesión): la URL va en la descripción del canal de YouTube, porque las
 * licencias CC BY de la música exigen una lista pública de autores.
 */
@Component({
  selector: 'app-credits',
  templateUrl: './credits.page.html',
  styleUrls: ['./credits.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, TranslocoPipe, NavbarComponent],
})
export class CreditsPage {
  private router = inject(Router);

  readonly licenses = CREDIT_LICENSES;
  readonly lichessLilaUrl = LICHESS_LILA_URL;
  readonly lichessPuzzlesUrl = LICHESS_PUZZLES_URL;
  readonly sourceNames = MUSIC_SOURCE_NAMES;
  readonly formatDuration = formatDuration;

  /** Un renglón por set de piezas, en el orden de `PIECE_CREDITS`. */
  readonly pieces = (Object.keys(PIECE_CREDITS) as PiecesStyle[]).map((id) => ({
    id,
    ...PIECE_CREDITS[id],
  }));

  readonly musicGroups = groupMusicByLicense(MUSIC_CREDITS);
  readonly musicSummary = {
    tracks: MUSIC_CREDITS.length,
    authors: countAuthors(MUSIC_CREDITS),
  };

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
