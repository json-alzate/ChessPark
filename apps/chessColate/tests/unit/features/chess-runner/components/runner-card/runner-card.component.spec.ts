import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { CHAPTERS } from '@features/chess-runner/campaign/runner-curriculum';
import { RunnerCard, RunnerCardComponent } from '@features/chess-runner/components/runner-card/runner-card.component';

describe('RunnerCardComponent', () => {
  let fixture: ComponentFixture<RunnerCardComponent>;
  let tarjeta: RunnerCardComponent;
  let seguir = 0;
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;

  function pintar(card: RunnerCard) {
    fixture = TestBed.createComponent(RunnerCardComponent);
    tarjeta = fixture.componentInstance;
    tarjeta.card = card;
    tarjeta.chapterCount = CHAPTERS.length;
    tarjeta.names = CHAPTERS.map((c) => `Tema ${c.theme}`);
    tarjeta.next.subscribe(() => seguir++);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    seguir = 0;
    // jsdom no dibuja: el icono del poder y los del camino salen vacíos
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [RunnerCardComponent],
      providers: [provideTranslocoTesting({ CHESS_RUNNER: { map: { label: 'Camino' } } })],
    }).compileComponents();
  });

  afterEach(() => jest.restoreAllMocks());

  it('con un poder, enseña su icono, su nombre y lo que hace, y no el camino', () => {
    pintar({ kind: 'power', power: 'shield' });

    expect(el('power-icon')).not.toBeNull();
    expect(el('power-name')!.textContent).toContain('powers.shield.name');
    expect(el('power-desc')!.textContent).toContain('powers.shield.desc');
    expect(el('journey-title')).toBeNull();
  });

  it('con el camino, enseña el título y los veinte guardianes, y no un poder', () => {
    pintar({ kind: 'journey' });

    expect(el('journey-title')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid=map-node]')).toHaveLength(CHAPTERS.length);
    expect(el('power-name')).toBeNull();
  });

  it('«Seguir» avisa una vez por pulsación', () => {
    pintar({ kind: 'power', power: 'crown' });

    (el('card-continue') as HTMLButtonElement).click();
    (el('card-continue') as HTMLButtonElement).click();

    expect(seguir).toBe(2);
  });
});
