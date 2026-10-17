import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { provideTranslocoTesting } from '@tests/support/transloco-testing';

import { RunnerLessonComponent } from '@features/chess-runner/components/runner-lesson/runner-lesson.component';
import { RunnerLessonModalComponent } from '@features/chess-runner/components/runner-lesson-modal/runner-lesson-modal.component';
import { LESSONS, RunnerLesson } from '@features/chess-runner/lessons/runner-lessons.data';

// La librería del tablero arrastra cm-chessboard, que Jest no carga: el servicio de piezas solo usa su tabla
jest.mock('@chesspark/board', () => ({
  CHESSBOARD_ASSETS_URL: 'assets/cm-chessboard/assets/',
  PIECES_FILES: { cburnett: 'pieces/standard.svg' },
  getChessboardAppearance: () => ({ pieces: 'cburnett', board: 'default' }),
}));

/** La lección, sin canvas: mismas entradas y salidas que la real. */
@Component({ selector: 'app-runner-lesson', standalone: true, template: '<div data-testid="leccion-falsa"></div>' })
class LeccionFalsa {
  @Input() lesson: RunnerLesson | null = null;
  @Output() finished = new EventEmitter<void>();
  @Output() failed = new EventEmitter<void>();
}

describe('RunnerLessonModalComponent', () => {
  let fixture: ComponentFixture<RunnerLessonModalComponent>;
  const modalController = { dismiss: jest.fn().mockResolvedValue(true) };

  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [RunnerLessonModalComponent],
      providers: [
        provideTranslocoTesting({ CHESS_RUNNER: { lessonClose: 'Cerrar la lección' } }),
        { provide: ModalController, useValue: modalController },
      ],
    })
      .overrideComponent(RunnerLessonModalComponent, { remove: { imports: [RunnerLessonComponent] }, add: { imports: [LeccionFalsa] } })
      .compileComponents();
    fixture = TestBed.createComponent(RunnerLessonModalComponent);
    fixture.componentInstance.lesson = LESSONS['fork'];
    fixture.componentInstance.title = 'Horquilla';
    fixture.detectChanges();
  });

  it('enseña el nombre del patrón y la lección', () => {
    expect(el('lesson-modal-title')!.textContent).toContain('Horquilla');
    expect(el('leccion-falsa')).not.toBeNull();
  });

  it('la equis cierra la ventana, y tiene nombre para quien no la ve', () => {
    const boton = el('lesson-modal-close') as HTMLButtonElement;

    expect(boton.getAttribute('aria-label')).toBe('Cerrar la lección');
    boton.click();

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
  });

  it('si la lección no puede dibujarse, la ventana se cierra sola', () => {
    const leccion = fixture.debugElement.children[0].query((d) => d.componentInstance instanceof LeccionFalsa).componentInstance as LeccionFalsa;

    leccion.failed.emit();

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
  });
});
