import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  GameSettings,
  SettingsSideMenuComponent,
} from '@app/features/coordinates/components/settings-side-menu/settings-side-menu.component';
import { conModalFalso, StubIonModal, translocoTesting } from '@tests/support/analisis-juegos';

const base: GameSettings = {
  showCoordinates: false,
  showPieces: false,
  showRandomPieces: false,
  infiniteMode: false,
  playSound: false,
};

describe('SettingsSideMenuComponent', () => {
  let fixture: ComponentFixture<SettingsSideMenuComponent>;
  let component: SettingsSideMenuComponent;
  let emitidos: GameSettings[];

  const interruptores = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('input[type=checkbox]'));
  const [COORDENADAS, PIEZAS, ALEATORIAS, INFINITO, SONIDO] = [0, 1, 2, 3, 4];

  function alternar(indice: number, valor: boolean) {
    const input = interruptores()[indice];
    input.checked = valor;
    input.dispatchEvent(new Event('change'));
  }

  beforeEach(async () => {
    // El ion-modal registrado en jsdom avisa de que no halla el botón `trigger`: ruido, no un fallo
    const warn = console.warn.bind(console);
    jest.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      if (!String(args[0]).includes('[Ionic Warning]')) warn(...args);
    });
    conModalFalso(SettingsSideMenuComponent);
    await TestBed.configureTestingModule({
      imports: [SettingsSideMenuComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(SettingsSideMenuComponent);
    component = fixture.componentInstance;
    emitidos = [];
    component.settingsChange.subscribe((s) => emitidos.push(s));
  });

  afterEach(() => jest.restoreAllMocks());

  it('refleja los ajustes recibidos en los interruptores', () => {
    component.settings = { ...base, showCoordinates: true, showPieces: true, playSound: true };
    fixture.detectChanges();
    expect(interruptores().map((i) => i.checked)).toEqual([true, true, false, false, true]);
  });

  it('las piezas aleatorias quedan deshabilitadas mientras no se muestren piezas', () => {
    component.settings = base;
    fixture.detectChanges();
    expect(interruptores()[ALEATORIAS].disabled).toBe(true);

    component.settings = { ...base, showPieces: true };
    fixture.detectChanges();
    expect(interruptores()[ALEATORIAS].disabled).toBe(false);
  });

  it('emite una copia de los ajustes con solo el cambio hecho', () => {
    component.settings = base;
    fixture.detectChanges();
    alternar(COORDENADAS, true);
    expect(emitidos).toEqual([{ ...base, showCoordinates: true }]);
    expect(component.settings).toBe(base);
    expect(base.showCoordinates).toBe(false);
  });

  it.each([
    [INFINITO, 'infiniteMode'],
    [SONIDO, 'playSound'],
  ])('el interruptor %i activa %s', (indice, clave) => {
    component.settings = base;
    fixture.detectChanges();
    alternar(indice, true);
    expect(emitidos[0]).toEqual({ ...base, [clave]: true });
  });

  it('al apagar las piezas también apaga las piezas aleatorias', () => {
    component.settings = { ...base, showPieces: true, showRandomPieces: true };
    fixture.detectChanges();
    alternar(PIEZAS, false);
    expect(emitidos[0]).toEqual({ ...base, showPieces: false, showRandomPieces: false });
  });

  it('al activar piezas aleatorias activa también mostrar piezas', () => {
    component.settings = { ...base, showPieces: false };
    fixture.detectChanges();
    component.onSettingChange('showRandomPieces', true);
    expect(emitidos[0]).toEqual({ ...base, showPieces: true, showRandomPieces: true });
  });

  it('apagar las piezas aleatorias no toca mostrar piezas', () => {
    component.settings = { ...base, showPieces: true, showRandomPieces: true };
    component.onSettingChange('showRandomPieces', false);
    expect(emitidos[0]).toEqual({ ...base, showPieces: true, showRandomPieces: false });
  });

  it('cerrar el menú descarta el modal', () => {
    fixture.detectChanges();
    const modal = fixture.debugElement.children[0].injector.get(StubIonModal);
    fixture.nativeElement.querySelector('ion-button').click();
    expect(modal.dismiss).toHaveBeenCalled();
  });

  it('en pantallas anchas se considera escritorio y en móvil no', () => {
    const original = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    expect(component.isDesktop).toBe(true);
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    expect(component.isDesktop).toBe(false);
    Object.defineProperty(window, 'innerWidth', { value: original, configurable: true });
  });
});
