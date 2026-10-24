import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { ChessGame } from '@chesspark/models';

import { ProfileService } from '@core/account/profile.service';
import { GameReflectionRepository } from '@features/game-reflection/data/game-reflection.repository';
import {
  GameReflection,
  GameTag,
} from '@features/game-reflection/models/game-reflection.model';
import {
  ReflectionSelection,
  buildReflection,
  cleanTagLabel,
  gameKeyOf,
  isSelectionEmpty,
  isValidTagLabel,
  newCustomTagId,
} from '@features/game-reflection/utils/game-reflection.util';

/**
 * Lo que el usuario anota de una partida —lo mejor que hizo y lo que debe
 * mejorar— y los tags propios que crea para anotarlo.
 *
 * Solo con sesión: sin ella no hay dónde guardarlo (la clave de la partida es
 * la de la plataforma, así que lo anotado vuelve solo tras reinstalar).
 */
@Injectable({
  providedIn: 'root',
})
export class GameReflectionService {
  private repository = inject(GameReflectionRepository);
  private profileService = inject(ProfileService);

  /** Tags del usuario ya leídos; se renueva al cambiar de cuenta. */
  private tagsCache: { uid: string; tags: GameTag[] } | null = null;

  /** El uid de quien tiene la sesión abierta, o null si no hay. */
  get uid(): string | null {
    return this.profileService.getProfile?.uid ?? null;
  }

  /** El uid de la sesión cada vez que cambia (al iniciar o cerrar sesión). */
  get uid$(): Observable<string | null> {
    return this.profileService.subscribeToProfile().pipe(
      map((profile) => profile?.uid ?? null),
      distinctUntilChanged()
    );
  }

  get canSave(): boolean {
    return this.uid !== null;
  }

  /** Lo anotado de esta partida, o null si no hay sesión o no se anotó nada. */
  async getReflection(game: ChessGame): Promise<GameReflection | null> {
    const uid = this.uid;
    if (!uid) {
      return null;
    }
    return this.repository.getReflection(uid, gameKeyOf(game));
  }

  /** Guarda lo elegido para la partida; con las dos listas vacías borra la anotación. */
  async saveSelection(
    game: ChessGame,
    selection: ReflectionSelection
  ): Promise<void> {
    const uid = this.requireUid();

    if (isSelectionEmpty(selection)) {
      await this.repository.deleteReflection(uid, gameKeyOf(game));
      return;
    }
    await this.repository.saveReflection(
      uid,
      buildReflection(game, selection, Date.now())
    );
  }

  /** Todo lo anotado: la base de las estadísticas. */
  async getAllReflections(): Promise<GameReflection[]> {
    const uid = this.uid;
    return uid ? this.repository.getReflections(uid) : [];
  }

  /** Los tags propios del usuario. */
  async getTags(): Promise<GameTag[]> {
    const uid = this.uid;
    if (!uid) {
      return [];
    }
    if (this.tagsCache?.uid !== uid) {
      this.tagsCache = { uid, tags: await this.repository.getTags(uid) };
    }
    return this.tagsCache.tags;
  }

  /**
   * Crea un tag propio. Quien llama ya comprobó que no existe uno igual
   * (`findTagByLabel`), porque necesita las traducciones del sistema.
   */
  async createTag(label: string): Promise<GameTag> {
    const uid = this.requireUid();
    if (!isValidTagLabel(label)) {
      throw new Error('El nombre del tag no es válido');
    }

    const tags = await this.getTags();
    const tag: GameTag = {
      id: newCustomTagId(),
      label: cleanTagLabel(label),
      createdAt: Date.now(),
    };
    await this.repository.saveTag(uid, tag);
    // Un tag guardado solo cuenta si de verdad se escribió
    this.tagsCache = { uid, tags: [...tags, tag] };
    return tag;
  }

  private requireUid(): string {
    const uid = this.uid;
    if (!uid) {
      throw new Error('Hace falta una sesión para guardar la reflexión');
    }
    return uid;
  }
}
