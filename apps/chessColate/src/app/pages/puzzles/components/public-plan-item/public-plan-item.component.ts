import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { IonIcon } from '@ionic/angular/standalone';
import { PublicPlan, Block } from '@cpark/models';
import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';
import { addIcons } from 'ionicons';
import { heartOutline, heart, playOutline, bookmarkOutline, bookmark, shuffle, trendingDown, infiniteOutline } from 'ionicons/icons';

@Component({
  selector: 'app-public-plan-item',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, IonIcon, SecondsToMinutesSecondsPipe],
  templateUrl: './public-plan-item.component.html',
  styleUrl: './public-plan-item.component.scss',
})
export class PublicPlanItemComponent {
  @Input() plan!: PublicPlan;
  @Output() play = new EventEmitter<PublicPlan>();
  @Output() toggleLike = new EventEmitter<{ plan: PublicPlan; liked: boolean }>();
  @Output() toggleSaved = new EventEmitter<{ plan: PublicPlan; saved: boolean }>();

  private profileService = inject(ProfileService);
  private appService = inject(AppService);
  private translocoService = inject(TranslocoService);

  constructor() {
    addIcons({ heartOutline, heart, playOutline, bookmarkOutline, bookmark, shuffle, trendingDown, infiniteOutline });
  }

  get currentUserUid(): string | undefined {
    return this.profileService.getProfile?.uid;
  }

  get canLike(): boolean {
    // El creador no puede dar me gusta a su propio plan
    return this.plan.uidUser !== this.currentUserUid;
  }

  get isLiked(): boolean {
    return this.plan.userInteraction?.liked ?? false;
  }

  get isSaved(): boolean {
    return this.plan.userInteraction?.saved ?? false;
  }

  onPlay(): void {
    this.play.emit(this.plan);
  }

  onToggleLike(): void {
    if (!this.canLike) return;
    this.toggleLike.emit({ plan: this.plan, liked: !this.isLiked });
  }

  onToggleSaved(): void {
    this.toggleSaved.emit({ plan: this.plan, saved: !this.isSaved });
  }

  getThemeName(theme: string): string {
    if (theme === 'all') {
      return this.translocoService.translate('NEW_BLOCK.theme.random') || 'Aleatorio';
    }
    if (theme === 'weakness') {
      return this.translocoService.translate('NEW_BLOCK.theme.weakness') || 'Debilidad';
    }
    return this.appService.getNameThemePuzzleByValue(theme) || theme;
  }

  getThemeIcon(theme: string): { type: 'icon' | 'image'; value: string } | null {
    if (theme === 'all') {
      return { type: 'icon', value: 'shuffle' };
    }
    if (theme === 'weakness') {
      return { type: 'icon', value: 'trending-down' };
    }
    const themeData = this.appService.getThemePuzzleByValue(theme);
    if (themeData?.img) {
      return { type: 'image', value: `/assets/images/puzzle-themes/${themeData.img}` };
    }
    return null;
  }

  getBlockConfig(block: Block): 
    | { type: 'time'; time: number }
    | { type: 'puzzles'; puzzles: number }
    | { type: 'both'; time: number; puzzles: number }
    | { type: 'infinite' } {
    const hasTime = block.time > 0;
    const hasPuzzles = block.puzzlesCount > 0;

    if (hasTime && hasPuzzles) {
      return { type: 'both', time: block.time, puzzles: block.puzzlesCount };
    }
    if (hasTime) {
      return { type: 'time', time: block.time };
    }
    if (hasPuzzles) {
      return { type: 'puzzles', puzzles: block.puzzlesCount };
    }
    return { type: 'infinite' };
  }
}
