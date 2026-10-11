jest.mock('@chesspark/board', () => ({}));

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameResultsModalComponent } from '@app/pages/coordinates/components/game-results-modal/game-results-modal.component';
import {
  appearanceDouble,
  conModalFalso,
  StubIonModal,
  textoDe,
  translocoTesting,
} from '@tests/support/analisis-juegos';

describe('GameResultsModalComponent', () => {
  let fixture: ComponentFixture<GameResultsModalComponent>;
  let component: GameResultsModalComponent;

  const texto = () => textoDe(fixture.nativeElement);

  beforeEach(async () => {
    conModalFalso(GameResultsModalComponent);
    await TestBed.configureTestingModule({
      imports: [GameResultsModalComponent, translocoTesting()],
      providers: [appearanceDouble()],
    }).compileComponents();
    fixture = TestBed.createComponent(GameResultsModalComponent);
    component = fixture.componentInstance;
  });

  it('muestra el puntaje final y los conteos de aciertos, errores y precisión', () => {
    component.score = 38;
    component.squaresGood = ['a1', 'b2', 'c3'];
    component.squaresBad = ['d4'];
    component.currentGameStats = { correctAnswers: 3, incorrectAnswers: 1, accuracy: 74.6 };
    fixture.detectChanges();
    expect(textoDe(fixture.nativeElement.querySelector('.text-6xl'))).toBe('38');
    expect(textoDe(fixture.nativeElement.querySelector('.text-success'))).toBe('3');
    expect(textoDe(fixture.nativeElement.querySelector('.text-error'))).toBe('1');
    expect(texto()).toContain('75%');
  });

  it('con récord nuevo felicita y marca NEW', () => {
    component.isNewRecord = true;
    component.score = 50;
    component.currentColorInBoard = 'black';
    fixture.detectChanges();
    expect(texto()).toContain('NEW');
    expect(texto()).toContain('COORDINATES.results.congratulations');
    expect(texto()).toContain('COORDINATES.results.newRecordShort COORDINATES.game.blacks: 50!');
  });

  it('con récord igualado lo indica y no marca NEW', () => {
    component.isTiedRecord = true;
    component.score = 40;
    fixture.detectChanges();
    expect(texto()).not.toContain('NEW');
    expect(texto()).toContain('COORDINATES.results.recordTied');
    expect(texto()).toContain('COORDINATES.results.tiedRecordWith COORDINATES.game.whites: 40!');
  });

  it('sin récord anima y recuerda el mejor puntaje del color', () => {
    component.bestScoreByColor = 61;
    fixture.detectChanges();
    expect(texto()).toContain('COORDINATES.results.goodGame');
    expect(texto()).toContain('COORDINATES.results.bestScoreWith COORDINATES.game.whites COORDINATES.results.is 61.');
    expect(texto()).not.toContain('NEW');
  });

  it('muestra el rey del color con el que se jugó', () => {
    component.currentColorInBoard = 'black';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toContain('-bk.svg');
  });

  it('el botón de continuar emite closeModal', () => {
    const cerrar = jest.fn();
    component.closeModal.subscribe(cerrar);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('present() presenta el modal y dismiss() lo cierra con "confirm"', () => {
    fixture.detectChanges();
    const modal = fixture.debugElement.children[0].injector.get(StubIonModal);
    component.present();
    expect(modal.present).toHaveBeenCalled();
    component.dismiss();
    expect(modal.dismiss).toHaveBeenCalledWith(null, 'confirm');
  });
});
