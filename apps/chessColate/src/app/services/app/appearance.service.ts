import { Injectable, computed, inject, signal } from '@angular/core';
import {
  getChessboardAppearance,
  isBoardStyle,
  isPiecesStyle,
  setChessboardAppearance,
} from '@chesspark/board';
import {
  APP_THEMES,
  AppTheme,
  BoardStyle,
  DARK_APP_THEMES,
  DEFAULT_APP_THEME,
  PiecesStyle,
} from '@chesspark/models';
import { distinctUntilChanged, map } from 'rxjs';

import { ProfileService } from '@services/account/profile.service';

/** Claves de localStorage con la apariencia elegida (la que usan los invitados). */
const PIECES_STORAGE_KEY = 'chessColate_pieces';
const BOARD_STORAGE_KEY = 'chessColate_board';
const THEME_STORAGE_KEY = 'chessColate_theme';

function isAppTheme(value: unknown): value is AppTheme {
  return APP_THEMES.includes(value as AppTheme);
}

/**
 * Estilo de piezas, color del tablero y tema de DaisyUI de la app.
 *
 * Funciona como el idioma: se guarda en el dispositivo para que también lo tengan
 * los invitados y, si hay sesión, además en el perfil. Cuando llega el perfil, lo
 * que trae predomina sobre lo local.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceService {
  private profileService = inject(ProfileService);

  private readonly state = signal(getChessboardAppearance());

  readonly pieces = computed(() => this.state().pieces);
  readonly board = computed(() => this.state().board);
  readonly theme = signal<AppTheme>(DEFAULT_APP_THEME);

  /**
   * Aplica lo guardado en el dispositivo y queda atento al perfil. Se llama una vez
   * al arrancar la app, antes de que se dibuje el primer tablero.
   */
  init(): void {
    this.apply({
      pieces: this.readStored(PIECES_STORAGE_KEY, isPiecesStyle),
      board: this.readStored(BOARD_STORAGE_KEY, isBoardStyle),
      theme: this.readStored(THEME_STORAGE_KEY, isAppTheme) ?? DEFAULT_APP_THEME,
    });

    // Solo cuando cambia lo que trae el perfil: otras actualizaciones del perfil (un
    // elo, por ejemplo) pueden llegar con el valor anterior mientras se guarda uno nuevo
    this.profileService.profile$
      .pipe(
        map((profile) => ({
          pieces: isPiecesStyle(profile?.pieces) ? profile.pieces : undefined,
          board: isBoardStyle(profile?.board) ? profile.board : undefined,
          theme: isAppTheme(profile?.theme) ? profile.theme : undefined,
        })),
        distinctUntilChanged(
          (a, b) => a.pieces === b.pieces && a.board === b.board && a.theme === b.theme
        )
      )
      .subscribe((fromProfile) => this.apply(fromProfile));
  }

  setPieces(pieces: PiecesStyle): void {
    if (pieces === this.pieces()) return;
    this.apply({ pieces });
    // Sin sesión no hay perfil que actualizar: queda solo en el dispositivo
    this.profileService.requestUpdateProfile({ pieces });
  }

  setBoard(board: BoardStyle): void {
    if (board === this.board()) return;
    this.apply({ board });
    this.profileService.requestUpdateProfile({ board });
  }

  setTheme(theme: AppTheme): void {
    if (theme === this.theme()) return;
    this.apply({ theme });
    this.profileService.requestUpdateProfile({ theme });
  }

  /** Aplica a los tableros y al tema, deja las señales al día y lo guarda en el dispositivo. */
  private apply(next: { pieces?: PiecesStyle; board?: BoardStyle; theme?: AppTheme }): void {
    if (next.theme) {
      this.applyTheme(next.theme);
    }
    setChessboardAppearance(next);
    const applied = getChessboardAppearance();
    this.state.set(applied);
    this.store(PIECES_STORAGE_KEY, applied.pieces);
    this.store(BOARD_STORAGE_KEY, applied.board);
  }

  /**
   * El tema va en <html>: así cubre también los modales y menús de Ionic, que viven
   * fuera de las páginas. La clase de Ionic cambia sus colores propios a oscuro o claro
   * según el tema.
   */
  private applyTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.store(THEME_STORAGE_KEY, theme);
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('ion-palette-dark', DARK_APP_THEMES.includes(theme));
  }

  private readStored<T extends string>(
    key: string,
    isValid: (value: unknown) => value is T
  ): T | undefined {
    try {
      const stored = localStorage.getItem(key);
      return isValid(stored) ? stored : undefined;
    } catch {
      return undefined;
    }
  }

  private store(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Si localStorage no está disponible, se ignora silenciosamente
    }
  }
}
