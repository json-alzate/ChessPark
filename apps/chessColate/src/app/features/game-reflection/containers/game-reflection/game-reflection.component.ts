import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ChessGame } from '@chesspark/models';

import { LoginComponent } from '@shared/components/login/login.component';
import { TagPickerComponent } from '@features/game-reflection/components/tag-picker/tag-picker.component';
import { REFLECTION_LIMITS } from '@features/game-reflection/config/game-reflection.config';
import {
  GameTag,
  ReflectionList,
  TagOption,
} from '@features/game-reflection/models/game-reflection.model';
import { GameReflectionService } from '@features/game-reflection/services/game-reflection.service';
import {
  ReflectionSelection,
  addTagToSelection,
  buildTagOptions,
  findTagByLabel,
  isCustomTagId,
  isValidTagLabel,
  labelOfTag,
  removeTagFromSelection,
  selectionOf,
} from '@features/game-reflection/utils/game-reflection.util';

/**
 * «Mi reflexión» de una partida propia: hasta 2 cosas que hizo bien y hasta 3
 * por mejorar, elegidas entre sugerencias o creadas al momento. Guarda en
 * cuanto se toca algo.
 */
@Component({
  selector: 'app-game-reflection',
  templateUrl: './game-reflection.component.html',
  standalone: true,
  imports: [TranslocoPipe, TagPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameReflectionComponent implements OnInit, OnChanges {
  @Input({ required: true }) game!: ChessGame;

  private reflections = inject(GameReflectionService);
  private transloco = inject(TranslocoService);
  private cdr = inject(ChangeDetectorRef);
  private modalController = inject(ModalController);
  private destroyRef = inject(DestroyRef);

  readonly lists: ReflectionList[] = ['best', 'improve'];
  readonly limits = REFLECTION_LIMITS;

  selection: ReflectionSelection = { best: [], improve: [] };
  queries: Record<ReflectionList, string> = { best: '', improve: '' };
  loading = true;
  saving = false;
  failed = false;

  private customTags: GameTag[] = [];
  /** Para ignorar la respuesta de una partida si ya se cambió a otra. */
  private loadToken = 0;
  /** De qué sesión es lo que se ve (null = sin sesión). */
  private loadedFor: string | null = null;

  get canSave(): boolean {
    return this.reflections.canSave;
  }

  ngOnInit(): void {
    // Al iniciar o cerrar sesión desde aquí (o desde otro sitio) la tarjeta se renueva sola
    this.reflections.uid$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((uid) => {
        if (uid !== this.loadedFor) {
          void this.load();
        }
      });
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['game']) {
      await this.load();
    }
  }

  /** Abre el modal de inicio de sesión; al entrar, `uid$` recarga la tarjeta. */
  async openLogin(): Promise<void> {
    const modal = await this.modalController.create({
      component: LoginComponent,
      componentProps: { segmentEmailPassword: 'login' },
    });
    await modal.present();
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.loadedFor = this.reflections.uid;
    this.customTags = [];
    this.loading = true;
    this.failed = false;
    this.queries = { best: '', improve: '' };
    this.selection = { best: [], improve: [] };
    this.cdr.markForCheck();

    if (this.canSave) {
      try {
        const [reflection, tags] = await Promise.all([
          this.reflections.getReflection(this.game),
          this.reflections.getTags(),
        ]);
        if (token !== this.loadToken) {
          return;
        }
        this.customTags = tags;
        this.selection = selectionOf(reflection);
      } catch (error) {
        console.error('Error al leer la reflexión:', error);
        if (token === this.loadToken) {
          this.failed = true;
        }
      }
    }

    if (token === this.loadToken) {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // — Lo que ve el selector ————————————————————————————————————

  selectedOptions(list: ReflectionList): TagOption[] {
    return this.selection[list]
      .map((id) => ({
        id,
        label: labelOfTag(id, this.customTags, this.systemLabel),
        system: !isCustomTagId(id),
      }))
      .filter((option) => option.label);
  }

  optionsFor(list: ReflectionList): TagOption[] {
    return buildTagOptions({
      query: this.queries[list],
      customTags: this.customTags,
      systemLabel: this.systemLabel,
      chosen: [...this.selection.best, ...this.selection.improve],
    });
  }

  canCreate(list: ReflectionList): boolean {
    const query = this.queries[list];
    return (
      isValidTagLabel(query) &&
      !findTagByLabel(query, this.customTags, this.systemLabel)
    );
  }

  titleOf(list: ReflectionList): string {
    return this.transloco.translate(`GAME_REFLECTION.${list}`);
  }

  // — Acciones ————————————————————————————————————————————————

  setQuery(list: ReflectionList, value: string): void {
    this.queries = { ...this.queries, [list]: value };
  }

  async pick(list: ReflectionList, option: TagOption): Promise<void> {
    await this.apply(addTagToSelection(this.selection, list, option.id), list);
  }

  async remove(list: ReflectionList, id: string): Promise<void> {
    await this.apply(removeTagFromSelection(this.selection, list, id), list);
  }

  /** Crea el tag con lo escrito y lo elige; si ya existía uno igual, elige ese. */
  async create(list: ReflectionList): Promise<void> {
    const label = this.queries[list];
    if (!isValidTagLabel(label) || this.saving) {
      return;
    }

    const existing = findTagByLabel(label, this.customTags, this.systemLabel);
    if (existing) {
      await this.pick(list, existing);
      return;
    }

    this.saving = true;
    this.failed = false;
    let created: GameTag;
    try {
      created = await this.reflections.createTag(label);
    } catch (error) {
      console.error('Error al crear el tag:', error);
      this.failed = true;
      this.saving = false;
      this.cdr.markForCheck();
      return;
    }
    this.customTags = [...this.customTags, created];
    this.saving = false;
    await this.pick(list, { id: created.id, label: created.label, system: false });
  }

  /** Guarda la selección nueva; si falla, vuelve a la anterior y avisa. */
  private async apply(next: ReflectionSelection, list: ReflectionList): Promise<void> {
    if (next === this.selection || this.saving) {
      return;
    }

    const previous = this.selection;
    this.selection = next;
    this.queries = { ...this.queries, [list]: '' };
    this.saving = true;
    this.failed = false;
    this.cdr.markForCheck();

    try {
      await this.reflections.saveSelection(this.game, next);
    } catch (error) {
      console.error('Error al guardar la reflexión:', error);
      this.selection = previous;
      this.failed = true;
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  private systemLabel = (key: string): string =>
    this.transloco.translate(`GAME_REFLECTION.systemTags.${key}`);
}
