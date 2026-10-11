jest.mock('@chesspark/board', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KingAvatarComponent } from '@app/pages/coordinates/components/king-avatar/king-avatar.component';
import { appearanceDouble, textoDe, translocoTesting } from '@tests/support/analisis-juegos';

describe('KingAvatarComponent', () => {
  let fixture: ComponentFixture<KingAvatarComponent>;
  let component: KingAvatarComponent;

  const img = (): HTMLImageElement => fixture.nativeElement.querySelector('img');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KingAvatarComponent, translocoTesting()],
      providers: [appearanceDouble()],
    }).compileComponents();
    fixture = TestBed.createComponent(KingAvatarComponent);
    component = fixture.componentInstance;
  });

  it('muestra el rey blanco o negro según el color', () => {
    component.currentColorInBoard = 'white';
    fixture.detectChanges();
    expect(img().getAttribute('src')).toBe('assets/images/pieces/cburnett-wk.svg');
    expect(img().alt).toBe('Rey Blanco');

    component.currentColorInBoard = 'black';
    fixture.detectChanges();
    expect(img().getAttribute('src')).toBe('assets/images/pieces/cburnett-bk.svg');
    expect(img().alt).toBe('Rey Negro');
  });

  it.each([
    ['sm', 'w-14 h-14'],
    ['md', 'w-20 h-20'],
    ['lg', 'w-28 h-28'],
  ] as const)('el tamaño %s usa las clases %s', (size, clases) => {
    component.size = size;
    expect(component.getSizeClasses()).toBe(clases);
  });

  it('el anillo cambia según el tamaño', () => {
    component.size = 'sm';
    const pequeño = component.getRingSize();
    component.size = 'lg';
    expect(component.getRingSize()).not.toBe(pequeño);
  });

  it('sin etiqueta no muestra el texto de "jugando con"', () => {
    fixture.detectChanges();
    expect(textoDe(fixture.nativeElement)).not.toContain('COORDINATES.game.playingWith');
  });

  it('con etiqueta indica con qué color se juega', () => {
    component.showLabel = true;
    component.currentColorInBoard = 'black';
    fixture.detectChanges();
    const texto = textoDe(fixture.nativeElement);
    expect(texto).toContain('COORDINATES.game.playingWith');
    expect(texto).toContain('COORDINATES.game.blacks');
  });

  it('con récord muestra los puntos del mejor puntaje', () => {
    component.showLabel = true;
    component.showRecord = true;
    component.bestScore = 25;
    fixture.detectChanges();
    const texto = textoDe(fixture.nativeElement);
    expect(texto).toContain('COORDINATES.game.currentRecord');
    expect(texto).toContain('25 COORDINATES.game.points');
  });

  it('con récord pero sin mejor puntaje invita a fijar el primero', () => {
    component.showLabel = true;
    component.showRecord = true;
    component.bestScore = 0;
    fixture.detectChanges();
    const texto = textoDe(fixture.nativeElement);
    expect(texto).toContain('COORDINATES.game.firstTime');
    expect(texto).not.toContain('COORDINATES.game.currentRecord');
  });
});
