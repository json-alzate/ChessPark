/**
 * Apoyos compartidos por las pruebas de análisis de partidas, reproductor de
 * partidas y minijuegos (coordinates, knight-tour).
 */
import { Component, ContentChild, Input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { IonModal } from '@ionic/angular/standalone';
import { TranslocoTestingModule } from '@jsverse/transloco';

/**
 * Traducciones vacías: Transloco devuelve la propia clave cuando no hay
 * traducción, así que las pruebas comprueban claves (`COORDINATES.stats.correct`).
 */
export const translocoTesting = () =>
  TranslocoTestingModule.forRoot({
    langs: { es: {} },
    translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
    preloadLangs: true,
  });

/**
 * Doble de AppearanceService: lo único que lee la app en estas pantallas es el set de piezas
 * (lo usa `kingImage`). Se carga al llamarlo para que las pruebas que no pintan reyes no
 * arrastren la librería del tablero; quien lo use debe hacer
 * `jest.mock('@chesspark/board', () => ({}))` en su spec.
 */
export const appearanceDouble = () => {
  const { AppearanceService } = jest.requireActual<
    typeof import('@services/app/appearance.service')
  >('@services/app/appearance.service');
  return {
    provide: AppearanceService,
    useValue: { pieces: () => 'cburnett', board: () => 'green' },
  };
};

/**
 * Sustituto de `ion-modal`: pinta siempre el contenido de su `<ng-template>`
 * (el real solo lo monta al presentarse, con animaciones y shadow DOM).
 * `present` y `dismiss` son dobles que se pueden inspeccionar.
 */
@Component({
  selector: 'ion-modal',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `<ng-container *ngTemplateOutlet="content ?? null" />`,
  providers: [{ provide: IonModal, useExisting: StubIonModal }],
})
export class StubIonModal {
  @ContentChild(TemplateRef) content?: TemplateRef<unknown>;
  present = jest.fn().mockResolvedValue(undefined);
  dismiss = jest.fn().mockResolvedValue(true);
}

/** Cambia el `ion-modal` real de un componente por el sustituto. */
export function conModalFalso<T>(component: new (...args: never[]) => T) {
  TestBed.overrideComponent(component, {
    remove: { imports: [IonModal] },
    add: { imports: [StubIonModal] },
  });
}

/** Texto visible del elemento (sin espacios repetidos). */
export const textoDe = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Cambia, en un componente standalone, cada import original por su sustituto. */
export function sustituirImports<T>(
  component: new (...args: never[]) => T,
  pares: ReadonlyArray<readonly [unknown, unknown]>
) {
  TestBed.overrideComponent(component, {
    remove: { imports: pares.map(([original]) => original) as never[] },
    add: { imports: pares.map(([, sustituto]) => sustituto) as never[] },
  });
}

/** Barra de navegación vacía: la real inyecta media app y no es lo que se prueba aquí. */
@Component({ selector: 'app-navbar', standalone: true, template: '' })
export class StubNavbar {}

/** Gráfica de rating sin Chart.js: solo conserva lo que recibe. */
@Component({ selector: 'app-rating-chart', standalone: true, template: '' })
export class StubRatingChart {
  @Input() points: unknown[] = [];
}

@Component({ selector: 'app-activity-heatmap', standalone: true, template: '' })
export class StubActivityHeatmap {
  @Input() days: unknown[] = [];
}
