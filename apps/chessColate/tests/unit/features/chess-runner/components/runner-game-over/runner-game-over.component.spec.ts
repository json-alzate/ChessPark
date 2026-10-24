import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { newCampaign } from '@features/chess-runner/campaign/runner-campaign.util';
import { CHAPTERS } from '@features/chess-runner/campaign/runner-curriculum';
import {
  RunnerGameOver,
  RunnerGameOverComponent,
  RunnerWardrobeItem,
} from '@features/chess-runner/components/runner-game-over/runner-game-over.component';

const FIN: RunnerGameOver = { reason: 'hits', meters: 321, record: 500, newRecord: false, chapter: 4, round: 1, rating: 1050, ratingGain: 30, solved: 7, cookies: 88 };
const ARMARIO: RunnerWardrobeItem[] = [
  { id: 'choco', price: 0, swatch: '#8c5a43', state: 'worn' },
  { id: 'golden', price: 300, swatch: '#d9a441', state: 'affordable' },
  { id: 'snow', price: 700, swatch: '#e8e8f0', state: 'locked' },
  { id: 'night', price: 1200, swatch: '#3b3b4f', state: 'owned' },
];

describe('RunnerGameOverComponent', () => {
  let fixture: ComponentFixture<RunnerGameOverComponent>;
  let pantalla: RunnerGameOverComponent;
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const todos = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid=${id}]`)) as HTMLElement[];
  const salidas = { again: 0, exit: 0, buy: [] as string[], wear: [] as string[] };

  function pintar(cambios: Partial<RunnerGameOverComponent> = {}) {
    fixture = TestBed.createComponent(RunnerGameOverComponent);
    pantalla = fixture.componentInstance;
    Object.assign(pantalla, {
      over: FIN,
      campaign: { ...newCampaign(), powers: ['nose', 'spring'] },
      names: CHAPTERS.map((c) => c.theme),
      chapterCount: CHAPTERS.length,
      wardrobe: ARMARIO,
      wallet: 450,
      nextPattern: 'Clavada',
      ...cambios,
    });
    pantalla.again.subscribe(() => salidas.again++);
    pantalla.exit.subscribe(() => salidas.exit++);
    pantalla.buy.subscribe((id) => salidas.buy.push(id));
    pantalla.wear.subscribe((id) => salidas.wear.push(id));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    salidas.again = 0;
    salidas.exit = 0;
    salidas.buy = [];
    salidas.wear = [];
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await TestBed.configureTestingModule({
      imports: [RunnerGameOverComponent],
      providers: [provideTranslocoTesting({ CHESS_RUNNER: { map: { label: 'Camino' } } })],
    }).compileComponents();
  });

  afterEach(() => jest.restoreAllMocks());

  it('enseña el motivo, la distancia, y el récord que sigue vigente si no se superó', () => {
    pintar();

    expect(el('game-over-reason')!.textContent).toContain('gameOver.hits');
    expect(el('game-over-meters')!.textContent).toContain('meters');
    expect(el('game-over-record')).not.toBeNull();
    expect(el('new-record')).toBeNull();
  });

  it('con un récord nuevo lo anuncia en vez de enseñar el anterior', () => {
    pintar({ over: { ...FIN, newRecord: true, record: 321 } });

    expect(el('new-record')).not.toBeNull();
    expect(el('game-over-record')).toBeNull();
  });

  it('cuenta el capítulo, el ELO con lo ganado, los resueltos y las galletas', () => {
    pintar();

    expect(el('game-over-level')!.textContent).toBe('4');
    expect(el('game-over-rating')!.textContent).toBe('1050');
    expect(el('game-over-rating-gain')!.textContent!.trim()).toBe('+30');
    expect(el('game-over-solved')!.textContent).toBe('7');
    expect(el('game-over-cookies')!.textContent).toBe('88');
    expect(el('game-over-round')).toBeNull();
  });

  it('si el ELO bajó lo enseña en rojo con su signo, y si no cambió no enseña nada', () => {
    pintar({ over: { ...FIN, ratingGain: -12 } });
    expect(el('game-over-rating-gain')!.textContent!.trim()).toBe('-12');
    expect(el('game-over-rating-gain')!.className).toContain('text-error');

    pintar({ over: { ...FIN, ratingGain: 0 } });
    expect(el('game-over-rating-gain')).toBeNull();
  });

  it('desde la segunda ronda dice en cuál', () => {
    pintar({ over: { ...FIN, round: 3 } });

    expect(el('game-over-round')).not.toBeNull();
  });

  it('el camino enseña un nodo por capítulo, y los poderes ganados con su nombre y lo que hacen', () => {
    pintar();

    expect(todos('map-node')).toHaveLength(CHAPTERS.length);
    expect(todos('power-item')).toHaveLength(2);
    expect(todos('power-item')[0].textContent).toContain('powers.nose.name');
    expect(todos('power-item')[0].textContent).toContain('powers.nose.desc');
  });

  it('sin poderes no hay lista de poderes', () => {
    pintar({ campaign: newCampaign() });

    expect(el('powers-list')).toBeNull();
  });

  it('dice dónde se sigue al volver a jugar', () => {
    pintar();

    expect(el('game-over-next')!.textContent).toContain('Clavada');
  });

  it('los botones avisan: jugar otra vez y volver al inicio', () => {
    pintar();

    (el('play-again') as HTMLButtonElement).click();
    (el('game-over-exit') as HTMLButtonElement).click();

    expect(salidas.again).toBe(1);
    expect(salidas.exit).toBe(1);
  });

  it('el armario: la cartera, cada pelaje en su estado, y tocar uno compra o se pone según lo que sea', () => {
    pintar();

    expect(el('wallet')!.textContent).toContain('450');
    expect(todos('skin').map((t) => t.getAttribute('data-state'))).toEqual(['worn', 'affordable', 'locked', 'owned']);
    expect(todos('skin').map((t) => (t as HTMLButtonElement).disabled)).toEqual([true, false, true, false]);

    (todos('skin')[1] as HTMLButtonElement).click();
    (todos('skin')[3] as HTMLButtonElement).click();

    expect(salidas.buy).toEqual(['golden']);
    expect(salidas.wear).toEqual(['night']);
  });

  it('las vistas previas del perrito salen cuando están cargadas', () => {
    pintar({ previews: new Map([['golden', 'data:perro-dorado']]) });

    const imagenes = Array.from(fixture.nativeElement.querySelectorAll('[data-testid=skin] img')) as HTMLImageElement[];
    expect(imagenes).toHaveLength(1);
    expect(imagenes[0].getAttribute('src')).toBe('data:perro-dorado');
  });

  it('al entrar (panel «lobby») no enseña metros ni récord nuevo y el botón dice «Jugar»', () => {
    pintar({ over: { ...FIN, reason: 'lobby', meters: 0, ratingGain: 0 } });

    expect(el('game-over-title')!.textContent).toContain('CHESS_RUNNER.title');
    expect(el('game-over-meters')).toBeNull();
    expect(el('game-over-record')).not.toBeNull();
    expect(el('play-again')!.textContent).toContain('gameOver.play');
  });

  it('al salir a mitad (quit) sí enseña lo corrido y el botón dice «Jugar otra vez»', () => {
    pintar({ over: { ...FIN, reason: 'quit' } });

    expect(el('game-over-meters')).not.toBeNull();
    expect(el('game-over-reason')!.textContent).toContain('gameOver.quit');
    expect(el('play-again')!.textContent).toContain('gameOver.again');
  });
});
