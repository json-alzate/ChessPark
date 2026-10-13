// El servicio real arrastra la librería del tablero (cm-chessboard), que Jest no
// sabe cargar; la pipe solo necesita su señal `pieces`, que se reemplaza abajo.
jest.mock('@core/app/appearance.service', () => ({ AppearanceService: class AppearanceService {} }));

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AppearanceService } from '@core/app/appearance.service';
import { KingColor, KingImagePipe } from '@shared/pipes/king-image.pipe';

describe('KingImagePipe', () => {
  const pieces = signal('cburnett');
  let pipe: KingImagePipe;

  beforeEach(() => {
    pieces.set('cburnett');
    TestBed.configureTestingModule({
      providers: [{ provide: AppearanceService, useValue: { pieces } }],
    });
    pipe = TestBed.runInInjectionContext(() => new KingImagePipe());
  });

  it.each<[KingColor, string]>([
    ['white', 'assets/images/pieces/cburnett-wk.svg'],
    ['w', 'assets/images/pieces/cburnett-wk.svg'],
    ['black', 'assets/images/pieces/cburnett-bk.svg'],
    ['b', 'assets/images/pieces/cburnett-bk.svg'],
  ])('el rey "%s" apunta a %s', (color, path) => {
    expect(pipe.transform(color)).toBe(path);
  });

  it('usa el set de piezas que eligió el usuario', () => {
    pieces.set('staunty');

    expect(pipe.transform('white')).toBe('assets/images/pieces/staunty-wk.svg');
    expect(pipe.transform('b')).toBe('assets/images/pieces/staunty-bk.svg');
  });

  it('es impura: en una plantilla el rey cambia de estilo aunque el color de entrada no cambie', () => {
    @Component({ standalone: true, imports: [KingImagePipe], template: `<img [src]="color | kingImage" />` })
    class HostComponent {
      color: KingColor = 'white';
    }
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('assets/images/pieces/cburnett-wk.svg');

    pieces.set('fantasy');
    fixture.detectChanges();

    expect(img.getAttribute('src')).toBe('assets/images/pieces/fantasy-wk.svg');
  });
});
