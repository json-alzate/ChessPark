import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
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
  flameOutline,
} from 'ionicons/icons';
import { BoardPuzzleComponent } from '@chesspark/board';
import { Puzzle } from '@cpark/models';

/** Clave de localStorage que marca el onboarding como visto (solo invitados/local). */
export const ONBOARDING_SEEN_KEY = 'chessColate_onboarding_seen';

/**
 * Mate en 2 real (Lichess vía CDN de la app, temas `mateIn2`/`sacrifice`),
 * quemado aquí para el momento interactivo del onboarding. El usuario juega de
 * blancas y ejecuta una combinación con sacrificio de dama: Dxd8+ (la dama baja
 * toda la columna), el alfil la captura (Axd8) y remata con la torre Te8#. Las
 * dos jugadas del usuario son deslizamientos de columna completa, así las
 * flechas de pista se ven grandes y claras.
 */
const ONBOARDING_MATE_PUZZLE: Puzzle = {
  uid: 'onboarding-mate-2',
  fen: '3rk2r/ppN1bppp/5p2/8/8/8/PqP2PPP/R2QR1K1 b k - 2 17',
  moves: 'e8f8 d1d8 e7d8 e1e8',
  rating: 1400,
  ratingDeviation: 0,
  popularity: 0,
  randomNumberQuery: 0,
  nbPlays: 0,
  themes: ['mateIn2', 'sacrifice'],
  gameUrl: '',
  openingFamily: '',
  openingVariation: '',
};

interface OnboardingSlide {
  icon: string;
  titleKey: string;
  descKey: string;
  /** Si se define, se muestra esta imagen (p. ej. el logo) en vez del ícono. */
  image?: string;
  /** Slide con el mate en 2 jugable. */
  interactive?: boolean;
}

/** Instancia de Swiper expuesta por el custom element `<swiper-container>`. */
interface SwiperInstance {
  activeIndex: number;
  slideTo: (index: number, speed?: number) => void;
  slideNext: (speed?: number) => void;
  slidePrev: (speed?: number) => void;
}
interface SwiperEl extends HTMLElement {
  swiper?: SwiperInstance;
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
      icon: '',
      image: 'assets/images/home_icon.png',
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

  @ViewChild('swiperRef') swiperRef?: ElementRef<SwiperEl>;

  constructor() {
    addIcons({
      closeOutline,
      arrowForward,
      arrowBack,
      trendingUpOutline,
      flameOutline,
    });
  }

  private get swiper(): SwiperInstance | undefined {
    return this.swiperRef?.nativeElement?.swiper;
  }

  get isLastSlide(): boolean {
    return this.currentSlide === this.slides.length - 1;
  }

  /** Mantiene sincronizados dots, botones y carga del puzzle con Swiper. */
  onSlideChange(event: Event): void {
    const [swiper] = (event as CustomEvent).detail;
    this.currentSlide = swiper.activeIndex;
    this.loadPuzzleIfNeeded();
  }

  next(): void {
    if (this.isLastSlide) {
      this.complete();
      return;
    }
    this.swiper?.slideNext();
  }

  prev(): void {
    this.swiper?.slidePrev();
  }

  goTo(index: number): void {
    this.swiper?.slideTo(index);
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
