import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';

import { TAG_LABEL_MAX_LENGTH } from '@features/game-reflection/config/game-reflection.config';
import { TagOption } from '@features/game-reflection/models/game-reflection.model';

addIcons({ addOutline, closeOutline });

/** Cuántas sugerencias se muestran a la vez; el resto se encuentra escribiendo. */
const VISIBLE_SUGGESTIONS = 8;

/**
 * Una lista de tags con tope: los elegidos arriba, y un campo para buscar entre
 * las sugerencias o crear un tag nuevo. No guarda nada: avisa de lo que el
 * usuario hace y el contenedor decide.
 */
@Component({
  selector: 'app-tag-picker',
  templateUrl: './tag-picker.component.html',
  standalone: true,
  imports: [TranslocoPipe, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagPickerComponent {
  /** Título de la lista, ya traducido. */
  @Input({ required: true }) title = '';
  /** Cuántos tags admite. */
  @Input({ required: true }) max = 1;
  @Input() selected: TagOption[] = [];
  /** Sugerencias para el texto escrito, ya filtradas y ordenadas. */
  @Input() options: TagOption[] = [];
  /** El texto escrito se puede crear como tag nuevo. */
  @Input() canCreate = false;
  /** El texto escrito, para el botón de crear. */
  @Input() query = '';
  @Input() disabled = false;

  @Output() queryChange = new EventEmitter<string>();
  @Output() picked = new EventEmitter<TagOption>();
  @Output() removed = new EventEmitter<string>();
  @Output() created = new EventEmitter<void>();

  readonly maxLabelLength = TAG_LABEL_MAX_LENGTH;

  get isFull(): boolean {
    return this.selected.length >= this.max;
  }

  get visibleOptions(): TagOption[] {
    return this.options.slice(0, VISIBLE_SUGGESTIONS);
  }

  onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  /** Enter crea el tag si es nuevo, o elige la primera sugerencia si coincide. */
  onEnter(): void {
    if (this.canCreate) {
      this.created.emit();
    } else if (this.query.trim() && this.visibleOptions.length > 0) {
      this.picked.emit(this.visibleOptions[0]);
    }
  }
}
