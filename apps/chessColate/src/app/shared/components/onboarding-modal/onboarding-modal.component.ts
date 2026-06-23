import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent,
  IonIcon,
  IonButton,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  arrowForward,
  arrowBack,
  flashOutline,
  peopleOutline,
  trophyOutline,
  schoolOutline,
} from 'ionicons/icons';

/** Clave de localStorage que marca el onboarding como visto (solo invitados/local). */
export const ONBOARDING_SEEN_KEY = 'chessColate_onboarding_seen';

interface OnboardingSlide {
  icon: string;
  titleKey: string;
  descKey: string;
}

@Component({
  selector: 'app-onboarding-modal',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonContent, IonIcon, IonButton],
  templateUrl: './onboarding-modal.component.html',
  styleUrls: ['./onboarding-modal.component.scss'],
})
export class OnboardingModalComponent {
  private modalController = inject(ModalController);

  readonly slides: OnboardingSlide[] = [
    {
      icon: 'school-outline',
      titleKey: 'ONBOARDING.slides.welcome.title',
      descKey: 'ONBOARDING.slides.welcome.description',
    },
    {
      icon: 'flash-outline',
      titleKey: 'ONBOARDING.slides.training.title',
      descKey: 'ONBOARDING.slides.training.description',
    },
    {
      icon: 'people-outline',
      titleKey: 'ONBOARDING.slides.community.title',
      descKey: 'ONBOARDING.slides.community.description',
    },
    {
      icon: 'trophy-outline',
      titleKey: 'ONBOARDING.slides.challenges.title',
      descKey: 'ONBOARDING.slides.challenges.description',
    },
  ];

  currentSlide = 0;

  constructor() {
    addIcons({
      closeOutline,
      arrowForward,
      arrowBack,
      flashOutline,
      peopleOutline,
      trophyOutline,
      schoolOutline,
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
  }

  prev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  goTo(index: number): void {
    this.currentSlide = index;
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
