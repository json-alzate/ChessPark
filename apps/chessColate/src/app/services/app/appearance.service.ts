import { Injectable, computed, inject, signal } from '@angular/core';
import {
  getChessboardAppearance,
  isBoardStyle,
  isPiecesStyle,
  setChessboardAppearance,
} from '@chesspark/board';
import { BoardStyle, PiecesStyle } from '@chesspark/models';
import { distinctUntilChanged, map } from 'rxjs';

import { ProfileService } from '@services/account/profile.service';

/** Claves de localStorage con la apariencia elegida (la que usan los invitados). */
const PIECES_STORAGE_KEY = 'chessColate_pieces';
const BOARD_STORAGE_KEY = 'chessColate_board';

/**
 * Estilo de piezas y color del tablero.
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

  /**
   * Aplica lo guardado en el dispositivo y queda atento al perfil. Se llama una vez
   * al arrancar la app, antes de que se dibuje el primer tablero.
   */
  init(): void {
    this.apply({
      pieces: this.readStored(PIECES_STORAGE_KEY, isPiecesStyle),
      board: this.readStored(BOARD_STORAGE_KEY, isBoardStyle),
    });

    // Solo cuando cambia lo que trae el perfil: otras actualizaciones del perfil (un
    // elo, por ejemplo) pueden llegar con el valor anterior mientras se guarda uno nuevo
    this.profileService.profile$
      .pipe(
        map((profile) => ({
          pieces: isPiecesStyle(profile?.pieces) ? profile.pieces : undefined,
          board: isBoardStyle(profile?.board) ? profile.board : undefined,
        })),
        distinctUntilChanged(
          (a, b) => a.pieces === b.pieces && a.board === b.board
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

  /** Aplica a los tableros, deja la señal al día y lo guarda en el dispositivo. */
  private apply(next: { pieces?: PiecesStyle; board?: BoardStyle }): void {
    setChessboardAppearance(next);
    const applied = getChessboardAppearance();
    this.state.set(applied);
    this.store(PIECES_STORAGE_KEY, applied.pieces);
    this.store(BOARD_STORAGE_KEY, applied.board);
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
