import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  arrowForward,
  arrowBack,
  trendingUpOutline,
  listOutline,
  flameOutline,
} from 'ionicons/icons';
import { BoardPuzzleComponent } from '@chesspark/board';
import { Puzzle } from '@cpark/models';

/** Clave de localStorage que marca el onboarding como visto (solo invitados/local). */
export const ONBOARDING_SEEN_KEY = 'chessColate_onboarding_seen';

/**
 * Mate en 2 real (Lichess vía CDN de la app, tema `mateIn2`), quemado aquí para
 * el momento interactivo del onboarding. El usuario juega de blancas y ejecuta
 * una pequeña combinación: sacrifica la torre (Txf8+), el rey captura (Kxf8) y
 * remata con Dd8#. Las flechas de pista guían cada jugada del usuario.
 */
const ONBOARDING_MATE_PUZZLE: Puzzle = {
  uid: 'onboarding-mate-1',
  fen: '4Rrk1/3Q1ppp/8/8/8/6P1/q4r1P/6K1 b - - 1 30',
  moves: 'f2h2 e8f8 g8f8 d7d8',
  rating: 1100,
  ratingDeviation: 0,
  popularity: 0,
  randomNumberQuery: 0,
  nbPlays: 0,
  themes: ['mateIn2'],
  gameUrl: '',
  openingFamily: '',
  openingVariation: '',
};

interface OnboardingSlide {
  icon: string;
  titleKey: string;
  descKey: string;
  /** Slide con el mate en 1 jugable. */
  interactive?: boolean;
}

@Component({
  selector: 'app-onboarding-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonIcon,
    BoardPuzzleComponent,
  ],
  templateUrl: './onboarding-modal.component.html',
  styleUrls: ['./onboarding-modal.component.scss'],
})
export class OnboardingModalComponent {
  private modalController = inject(ModalController);

  readonly slides: OnboardingSlide[] = [
    {
      icon: 'trending-up-outline',
      titleKey: 'ONBOARDING.slides.tactics.title',
      descKey: 'ONBOARDING.slides.tactics.description',
    },
    {
      icon: 'list-outline',
      titleKey: 'ONBOARDING.slides.easy.title',
      descKey: 'ONBOARDING.slides.easy.description',
    },
    {
      icon: '',
      titleKey: 'ONBOARDING.slides.solve.title',
      descKey: 'ONBOARDING.slides.solve.description',
      interactive: true,
    },
    {
      icon: 'flame-outline',
      titleKey: 'ONBOARDING.slides.habit.title',
      descKey: 'ONBOARDING.slides.habit.description',
    },
  ];

  currentSlide = 0;

  /** Puzzle del slide interactivo. Se carga perezosamente al llegar a ese slide. */
  matePuzzle?: Puzzle;

  /** El usuario ya dio mate en el slide interactivo. */
  puzzleSolved = false;

  constructor() {
    addIcons({
      closeOutline,
      arrowForward,
      arrowBack,
      trendingUpOutline,
      listOutline,
      flameOutline,
    });
  }

  get isLastSlide(): boolean {
    return this.currentSlide === this.slides.length - 1;
  }

  next(): void {
    if (this.isLastSlide) {
      this.complete();
      return;
    }
    this.currentSlide++;
    this.loadPuzzleIfNeeded();
  }

  prev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  goTo(index: number): void {
    this.currentSlide = index;
    this.loadPuzzleIfNeeded();
  }

  /** Marca el mate como resuelto (feedback de celebración). */
  onPuzzleSolved(): void {
    this.puzzleSolved = true;
  }

  /** Si el usuario falla, reinicia el mate para que pueda volver a intentarlo. */
  onPuzzleFailed(): void {
    if (this.puzzleSolved) {
      return;
    }
    setTimeout(() => {
      this.matePuzzle = { ...ONBOARDING_MATE_PUZZLE };
    }, 700);
  }

  /** Carga el tablero solo cuando el usuario llega al slide interactivo. */
  private loadPuzzleIfNeeded(): void {
    if (!this.matePuzzle && this.slides[this.currentSlide]?.interactive) {
      this.matePuzzle = { ...ONBOARDING_MATE_PUZZLE };
    }
  }

  /** Marca el onboarding como visto y cierra. */
  complete(): void {
    try {
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    } catch {
      // localStorage no disponible: se ignora
    }
    this.modalController.dismiss();
  }
}
