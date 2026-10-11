jest.mock('@chesspark/board', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScoreboardComponent } from '@app/pages/coordinates/components/scoreboard/scoreboard.component';
import { appearanceDouble, textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const puntajes = [
  { score: 30, date: 3, timeAgo: 'hace 1 h', color: 'w' as const },
  { score: 45, date: 2, timeAgo: 'hace 2 h', color: 'b' as const },
  { score: 12, date: 1, timeAgo: 'hace 3 h', color: 'w' as const },
];

describe('ScoreboardComponent', () => {
  let fixture: ComponentFixture<ScoreboardComponent>;
  let component: ScoreboardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScoreboardComponent, translocoTesting()],
      providers: [appearanceDouble()],
    }).compileComponents();
    fixture = TestBed.createComponent(ScoreboardComponent);
    component = fixture.componentInstance;
  });

  describe('getBestScoreByColor', () => {
    it('devuelve el máximo de cada color', () => {
      component.bestScores = puntajes;
      expect(component.getBestScoreByColor('w')).toBe(30);
      expect(component.getBestScoreByColor('b')).toBe(45);
    });

    it('devuelve 0 si no hay partidas de ese color', () => {
      component.bestScores = [puntajes[0]];
      expect(component.getBestScoreByColor('b')).toBe(0);
    });
  });

  it('sin puntajes muestra el estado vacío', () => {
    fixture.detectChanges();
    const texto = textoDe(fixture.nativeElement);
    expect(texto).toContain('COORDINATES.stats.noScores');
    expect(fixture.nativeElement.querySelectorAll('.list-row')).toHaveLength(0);
  });

  it('lista cada puntaje con su posición, rey y antigüedad, y oculta el estado vacío', () => {
    component.bestScores = puntajes;
    component.userStats = { ...component.userStats, totalGames: 3 };
    fixture.detectChanges();
    const filas: Element[] = Array.from(fixture.nativeElement.querySelectorAll('.list-row'));
    expect(filas).toHaveLength(3);
    expect(textoDe(filas[0])).toContain('01');
    expect(textoDe(filas[0])).toContain('30 COORDINATES.game.points');
    expect(textoDe(filas[0])).toContain('hace 1 h');
    expect(filas[1].querySelector('img')?.getAttribute('src')).toContain('-bk.svg');
    expect(textoDe(fixture.nativeElement)).not.toContain('COORDINATES.stats.noScores');
  });

  it('muestra los mejores puntajes por color y el total de partidas', () => {
    component.bestScores = puntajes;
    component.userStats = { ...component.userStats, totalGames: 9 };
    fixture.detectChanges();
    const valores = Array.from<Element>(fixture.nativeElement.querySelectorAll('.stat-value')).map(textoDe);
    expect(valores).toEqual(['30', '45', '9']);
  });
});
