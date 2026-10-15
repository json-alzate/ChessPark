import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  addOutline,
  removeOutline,
  rocketOutline,
  shuffleOutline,
} from 'ionicons/icons';

import { AppService } from '@core/app/app.service';
import { ProfileService } from '@core/account/profile.service';

import {
  WOODPECKER_CYCLES,
  WOODPECKER_DEFAULT_PACE,
  WOODPECKER_DEFAULT_SIZE,
  WOODPECKER_ELO,
  WOODPECKER_MAX_RANDOM_THEMES,
  WOODPECKER_PACES,
  WOODPECKER_SIZES,
} from '../../config/woodpecker.config';
import { WoodpeckerOrder, WoodpeckerPace } from '../../models/woodpecker.model';
import {
  adjustEloRange,
  defaultEloRange,
  estimateCycleMinutes,
  WoodpeckerSetupInput,
} from '../../utils/woodpecker-config.util';
import { timeForCycle } from '../../utils/woodpecker-cycle.util';

/** Un tema que se puede elegir, listo para pintar. */
interface ThemeOption {
  value: string;
  name: string;
  img: string;
}

interface ThemeGroupOption {
  name: string;
  themes: ThemeOption[];
}

/**
 * Pantalla de configuración del set: tamaño, rango de ELO, temas, vueltas,
 * orden y ritmo. No arma nada: solo recoge lo elegido y lo emite; quien crea
 * el set es la página.
 */
@Component({
  selector: 'app-woodpecker-setup',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonIcon],
  templateUrl: './woodpecker-setup.component.html',
  styleUrl: './woodpecker-setup.component.scss',
})
export class WoodpeckerSetupComponent implements OnInit {
  private appService = inject(AppService);
  private profileService = inject(ProfileService);
  private translocoService = inject(TranslocoService);

  /** Temas del catálogo que se pueden elegir. */
  @Input() availableThemes: string[] = [];
  /** El set se está armando: no se puede volver a pulsar. */
  @Input() busy = false;
  /** Ya hay un set: crear otro lo sustituye, y se avisa. */
  @Input() replacesExisting = false;
  /** La explicación del método arranca desplegada solo la primera vez. */
  @Input() introOpen = true;

  @Output() create = new EventEmitter<WoodpeckerSetupInput>();

  readonly sizes = WOODPECKER_SIZES;
  readonly eloLimits = WOODPECKER_ELO;
  readonly cyclesLimits = WOODPECKER_CYCLES;
  readonly paces = Object.keys(WOODPECKER_PACES) as WoodpeckerPace[];
  readonly orders: WoodpeckerOrder[] = ['shuffle', 'same', 'reverse'];
  readonly maxRandomThemes = WOODPECKER_MAX_RANDOM_THEMES;

  size: number = WOODPECKER_DEFAULT_SIZE;
  eloMin = 0;
  eloMax = 0;
  themeMode: 'all' | 'pick' = 'all';
  selectedThemes = new Set<string>();
  cycles: number = WOODPECKER_CYCLES.default;
  order: WoodpeckerOrder = 'shuffle';
  pace: WoodpeckerPace = WOODPECKER_DEFAULT_PACE;

  groups: ThemeGroupOption[] = [];

  constructor() {
    addIcons({ addOutline, removeOutline, rocketOutline, shuffleOutline });
  }

  ngOnInit(): void {
    const userElo = this.profileService.getProfile?.elo ?? 1500;
    ({ eloMin: this.eloMin, eloMax: this.eloMax } = defaultEloRange(userElo));
    this.groups = this.buildGroups();
  }

  get cycleMinutes(): number {
    return estimateCycleMinutes(this.size);
  }

  get canCreate(): boolean {
    return !this.busy && (this.themeMode === 'all' || this.selectedThemes.size > 0);
  }

  /** Segundos por ejercicio de las primeras vueltas del ritmo, para enseñar cómo baja. */
  paceSequence(pace: WoodpeckerPace): number[] {
    const spec = WOODPECKER_PACES[pace];
    const shown = Math.min(this.cycles, 5);
    const times: number[] = [];
    for (let cycle = 1; cycle <= shown; cycle++) {
      const seconds = timeForCycle(spec, cycle);
      if (seconds !== null) {
        times.push(seconds);
      }
    }
    return times;
  }

  /** ¿Quedan vueltas que el resumen del ritmo no enseña? */
  get paceHasMore(): boolean {
    return this.cycles > 5;
  }

  paceBaseSeconds(pace: WoodpeckerPace): number {
    return WOODPECKER_PACES[pace].baseTimePerPuzzleSec;
  }

  paceDecrease(pace: WoodpeckerPace): number {
    return WOODPECKER_PACES[pace].decreasePercent;
  }

  setSize(size: number): void {
    this.size = size;
  }

  onEloMin(event: Event): void {
    this.applyRange('min', event);
  }

  onEloMax(event: Event): void {
    this.applyRange('max', event);
  }

  setThemeMode(mode: 'all' | 'pick'): void {
    this.themeMode = mode;
  }

  toggleTheme(value: string): void {
    // Set nuevo para que el cambio sea visible a la plantilla sin más trámites
    const next = new Set(this.selectedThemes);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    this.selectedThemes = next;
  }

  changeCycles(delta: number): void {
    this.cycles = Math.min(
      this.cyclesLimits.max,
      Math.max(this.cyclesLimits.min, this.cycles + delta)
    );
  }

  setOrder(order: WoodpeckerOrder): void {
    this.order = order;
  }

  setPace(pace: WoodpeckerPace): void {
    this.pace = pace;
  }

  submit(): void {
    if (!this.canCreate) {
      return;
    }
    this.create.emit({
      size: this.size,
      eloMin: this.eloMin,
      eloMax: this.eloMax,
      // En el orden del catálogo, no en el de los clics
      themes:
        this.themeMode === 'all'
          ? 'all'
          : this.availableThemes.filter((theme) => this.selectedThemes.has(theme)),
      cycles: this.cycles,
      order: this.order,
      pace: this.pace,
    });
  }

  private applyRange(moved: 'min' | 'max', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    ({ eloMin: this.eloMin, eloMax: this.eloMax } = adjustEloRange(
      { eloMin: this.eloMin, eloMax: this.eloMax },
      moved,
      value
    ));
  }

  /** Temas elegibles agrupados como en el resto de la app, solo con los del catálogo. */
  private buildGroups(): ThemeGroupOption[] {
    const lang = this.translocoService.getActiveLang();
    return this.appService.getThemesPuzzle
      .map((group) => ({
        name: this.groupName(group.groupName),
        themes: group.themes
          .filter((theme) => this.availableThemes.includes(theme.value))
          .map((theme) => ({
            value: theme.value,
            name: lang === 'es' ? theme.nameEs : theme.nameEn,
            img: theme.img,
          })),
      }))
      .filter((group) => group.themes.length > 0);
  }

  /** El nombre del grupo viene en español del JSON de temas; se traduce si hay traducción. */
  private groupName(groupName: string): string {
    const key = `WOODPECKER.setup.themes.groups.${groupName}`;
    const translated = this.translocoService.translate(key);
    return translated === key ? groupName : translated;
  }
}
