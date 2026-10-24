import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

/**
 * Dobles compartidos por las pruebas de racha, ajustes, donación, privacidad y
 * recordatorios.
 */

/**
 * Transloco real, sin red y sin archivos: solo conoce las traducciones que se le
 * pasen. Una clave sin traducir se pinta tal cual (`'STREAK.title'`), así las
 * pruebas buscan la clave y no dependen del texto en español.
 */
export function translocoParaPruebas(
  traducciones: Record<string, string> = {}
) {
  return TranslocoTestingModule.forRoot({
    langs: { es: traducciones },
    translocoConfig: {
      availableLangs: ['es'],
      defaultLang: 'es',
      missingHandler: { logMissingKey: false },
    },
    preloadLangs: true,
  });
}

/** Barra de navegación falsa: la real arrastra sesión, tema y menú. */
@Component({ selector: 'app-navbar', standalone: true, template: '' })
export class NavbarFalsa {}

/** Asa para cambiar el tamaño del tablero falsa: solo existe en escritorio con ratón. */
@Component({ selector: 'app-board-resize-handle', standalone: true, template: '' })
export class AsaRedimensionarFalsa {
  @Input() reserve = 150;
}

/** Selector de apariencia falso (tema, piezas y tablero). */
@Component({ selector: 'app-appearance-picker', standalone: true, template: '' })
export class SelectorAparienciaFalso {
  @Input() tabbed = false;
}

/** Tablero de puzzles falso: expone los mismos inputs y outputs que el real. */
@Component({
  selector: 'lib-board-puzzle',
  standalone: true,
  template: '<div data-testid="tablero"></div>',
})
export class TableroPuzzleFalso {
  @Input() setPuzzle: unknown;
  @Input() setForceStopTimer = false;
  @Output() puzzleCompleted = new EventEmitter<unknown>();
  @Output() puzzleFailed = new EventEmitter<unknown>();
  @Output() puzzleEndByTime = new EventEmitter<unknown>();
}

/**
 * Modal/alerta falsa de Ionic. `resultado` es lo que devuelve al cerrarse
 * (`role` incluido).
 */
export function superposicionFalsa(
  resultado: { role?: string; data?: unknown } = { role: 'cancel' }
) {
  return {
    present: jest.fn().mockResolvedValue(undefined),
    dismiss: jest.fn().mockResolvedValue(true),
    onDidDismiss: jest.fn().mockResolvedValue(resultado),
    onWillDismiss: jest.fn().mockResolvedValue(resultado),
  };
}

/** Controlador falso (ModalController, AlertController...) que entrega `superposicion`. */
export function controladorFalso(
  superposicion: ReturnType<typeof superposicionFalsa>
) {
  return { create: jest.fn().mockResolvedValue(superposicion) };
}

/** Deja correr las microtareas pendientes (promesas encadenadas). */
export async function vaciarPromesas(vueltas = 20): Promise<void> {
  for (let i = 0; i < vueltas; i++) {
    await Promise.resolve();
  }
}

/** Promesa que se resuelve a mano, para simular descargas lentas. */
export function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}
