import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';

import { BoardPuzzleSolutionComponent } from './board-puzzle-solution.component';
import { SoundsService, SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';
import { Puzzle } from '@cpark/models';

describe('BoardPuzzleSolutionComponent', () => {
  let component: BoardPuzzleSolutionComponent;
  let fixture: ComponentFixture<BoardPuzzleSolutionComponent>;
  let modalController: jasmine.SpyObj<ModalController>;
  let soundsService: jasmine.SpyObj<SoundsService>;

  beforeEach(async () => {
    modalController = jasmine.createSpyObj('ModalController', ['dismiss']);
    soundsService = jasmine.createSpyObj('SoundsService', ['determineChessMoveType', 'playError']);

    await TestBed.configureTestingModule({
      imports: [
        BoardPuzzleSolutionComponent,
        TranslocoPipe,
        SecondsToMinutesSecondsPipe
      ],
      providers: [
        { provide: ModalController, useValue: modalController },
        { provide: SoundsService, useValue: soundsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BoardPuzzleSolutionComponent);
    component = fixture.componentInstance;
    
    // Mock puzzle data
    component.puzzle = {
      uid: 'test-puzzle',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: 'e2e4 e7e5',
      rating: 1500,
      ratingDeviation: 50,
      popularity: 100,
      randomNumberQuery: 1,
      nbPlays: 10,
      themes: ['opening'],
      gameUrl: '',
      openingFamily: '',
      openingVariation: ''
    };
    component.themesTranslated = ['Opening'];
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

