import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PackSpriteComponent } from '@features/chess-runner/components/pack-sprite/pack-sprite.component';

describe('PackSpriteComponent', () => {
  let fixture: ComponentFixture<PackSpriteComponent>;

  function pintar(entradas: Partial<PackSpriteComponent>): HTMLElement {
    fixture = TestBed.createComponent(PackSpriteComponent);
    Object.assign(fixture.componentInstance, { src: 'assets/images/pack/pack-choco-run.png', frameW: 54, frameH: 43, ...entradas });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PackSpriteComponent] }).compileComponents();
  });

  it('mide la celda por el zoom y no suaviza los píxeles', () => {
    const el = pintar({ frames: 4, zoom: 3 });

    expect(el.style.width).toBe('162px');
    expect(el.style.height).toBe('129px');
    expect(el.style.imageRendering).toBe('pixelated');
    expect(el.style.backgroundImage).toContain('pack-choco-run.png');
  });

  it('muestra el cuadro pedido desplazando la tira', () => {
    const el = pintar({ frames: 4, frame: 2, zoom: 2 });

    expect(el.style.backgroundSize).toBe('432px 86px');
    expect(el.style.backgroundPosition).toBe('-216px 0px');
    expect(el.getAttribute('data-frame')).toBe('2');
  });

  it('el cuadro da la vuelta y el zoom siempre es entero', () => {
    const el = pintar({ frames: 4, frame: 5, zoom: 1.6 });

    expect(el.getAttribute('data-frame')).toBe('1');
    expect(el.style.width).toBe('108px');
  });
});
