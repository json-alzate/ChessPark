jest.mock('@chesspark/board', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoardOrientationControlsComponent } from '@app/features/coordinates/components/board-orientation-controls/board-orientation-controls.component';
import { appearanceDouble, translocoTesting } from '@tests/support/analisis-juegos';

describe('BoardOrientationControlsComponent', () => {
  let fixture: ComponentFixture<BoardOrientationControlsComponent>;
  let component: BoardOrientationControlsComponent;

  const botones = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardOrientationControlsComponent, translocoTesting()],
      providers: [appearanceDouble()],
    }).compileComponents();
    fixture = TestBed.createComponent(BoardOrientationControlsComponent);
    component = fixture.componentInstance;
  });

  it('muestra tres opciones (blancas, aleatorio, negras) cuando no se está jugando', () => {
    fixture.detectChanges();
    expect(botones()).toHaveLength(3);
    const imgs = fixture.nativeElement.querySelectorAll('img');
    expect(imgs[0].getAttribute('src')).toContain('-wk.svg');
    expect(imgs[1].getAttribute('src')).toContain('-bk.svg');
  });

  it('no muestra nada mientras hay una partida en curso', () => {
    component.isPlaying = true;
    fixture.detectChanges();
    expect(botones()).toHaveLength(0);
  });

  it('marca como activa solo la orientación elegida', () => {
    component.boardOrientation = 'black';
    fixture.detectChanges();
    const [blancas, aleatorio, negras] = botones();
    expect(negras.classList).toContain('btn-neutral');
    expect(blancas.classList).toContain('btn-ghost');
    expect(aleatorio.classList).toContain('btn-ghost');
  });

  it('emite la orientación del botón que se pulsa', () => {
    const emitidas: string[] = [];
    component.orientationChange.subscribe((o) => emitidas.push(o));
    fixture.detectChanges();
    const [blancas, aleatorio, negras] = botones();
    blancas.click();
    aleatorio.click();
    negras.click();
    expect(emitidas).toEqual(['white', 'random', 'black']);
  });
});
