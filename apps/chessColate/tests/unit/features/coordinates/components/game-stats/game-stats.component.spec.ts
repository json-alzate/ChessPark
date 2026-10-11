import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameStatsComponent } from '@app/features/coordinates/components/game-stats/game-stats.component';
import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

describe('GameStatsComponent', () => {
  let fixture: ComponentFixture<GameStatsComponent>;
  let component: GameStatsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameStatsComponent, translocoTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(GameStatsComponent);
    component = fixture.componentInstance;
  });

  it('no pinta estadísticas si no se está jugando', () => {
    component.isPlaying = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stats')).toBeNull();
  });

  it('muestra aciertos, errores y precisión de la partida en curso', () => {
    component.isPlaying = true;
    component.currentGameStats = { correctAnswers: 7, incorrectAnswers: 2, accuracy: 77.777 };
    fixture.detectChanges();
    const valores = Array.from<Element>(fixture.nativeElement.querySelectorAll('.stat-value')).map(textoDe);
    expect(valores).toEqual(['7', '2', '77.8%']);
  });

  it('se actualiza cuando cambian las estadísticas', () => {
    component.isPlaying = true;
    fixture.detectChanges();
    component.currentGameStats = { correctAnswers: 1, incorrectAnswers: 0, accuracy: 100 };
    fixture.detectChanges();
    const valores = Array.from<Element>(fixture.nativeElement.querySelectorAll('.stat-value')).map(textoDe);
    expect(valores).toEqual(['1', '0', '100%']);
  });
});
