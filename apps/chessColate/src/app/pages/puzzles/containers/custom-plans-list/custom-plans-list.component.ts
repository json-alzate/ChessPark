import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, filter, pairwise, takeUntil, startWith, take } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { IonContent, IonFab, IonFabButton, IonIcon, LoadingController, ModalController } from '@ionic/angular/standalone';

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { Plan, Block } from '@cpark/models';

import { CustomPlansService } from '@services/custom-plans.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';
import { PlanFacadeService, PlansElosFacadeService, CustomPlansFacadeService, getProfile, getIsInitialized, AppState, getCountAllCustomPlans } from '@cpark/state';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { LoginComponent } from '@shared/components/login/login.component';

import { addIcons } from 'ionicons';
import { add, playOutline, createOutline, shuffle, trendingDown, infiniteOutline, arrowBackOutline, homeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-custom-plans-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoPipe,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    NavbarComponent,
    SecondsToMinutesSecondsPipe,
  ],
  templateUrl: './custom-plans-list.component.html',
  styleUrl: './custom-plans-list.component.scss',
})
export class CustomPlansListComponent implements OnInit, OnDestroy {
  private customPlansService = inject(CustomPlansService);
  private customPlansFacade = inject(CustomPlansFacadeService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private appService = inject(AppService);
  private translocoService = inject(TranslocoService);
  private planFacade = inject(PlanFacadeService);
  private plansElosFacade = inject(PlansElosFacadeService);
  private router = inject(Router);
  private loadingController = inject(LoadingController);
  private store = inject(Store<AppState>);
  private modalController = inject(ModalController);
  private destroy$ = new Subject<void>();

  plans$ = this.customPlansService.getMyPlans$();
  customPlansLoading$ = this.customPlansFacade.getCustomPlansLoading$();
  
  /** true mientras la auth aún no ha emitido (no mostrar login hasta estar seguros) */
  authLoading$ = this.store.select(getIsInitialized).pipe(map((init) => !init));
  profile$ = this.store.select(getProfile);

  getPlanEloForPlan(planUid: string) {
    return this.plansElosFacade.getPlanElo$(planUid);
  }

  constructor() {
    addIcons({ add, playOutline, createOutline, shuffle, trendingDown, infiniteOutline, arrowBackOutline, homeOutline });
  }

  ngOnInit(): void {
    // Detectar cuando el usuario se autentica y cargar planes automáticamente
    this.store.select(getProfile)
      .pipe(
        startWith(null), // Empezar con null para que pairwise siempre tenga un valor anterior
        pairwise(), // Obtener el valor anterior y el actual
        filter(([prev, current]) => !prev?.uid && !!current?.uid), // Solo cuando cambia de no autenticado a autenticado
        takeUntil(this.destroy$)
      )
      .subscribe(([, profile]) => {
        if (profile?.uid) {
          // Cargar planes y elos cuando el usuario se autentica
          this.plansElosFacade.requestLoadPlansElos(profile.uid);
          
          // Verificar si hay planes cargados, si no, cargarlos
          this.store.select(getCountAllCustomPlans)
            .pipe(
              take(1), // Solo tomar el valor actual una vez
              takeUntil(this.destroy$)
            )
            .subscribe((count) => {
              if (count === 0) {
                this.customPlansFacade.loadCustomPlans(profile.uid);
              }
            });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goToCreate(): void {
    this.router.navigate(['/puzzles/custom-plans/create']);
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goToEdit(plan: Plan): void {
    this.router.navigate(['/puzzles/custom-plans/edit', plan.uid]);
  }

  async play(plan: Plan): Promise<void> {
    const totalBlockTime = plan.blocks.reduce(
      (sum, b) => sum + (b.time > 0 ? b.time : 0),
      0
    );
    const profile = this.profileService.getProfile;
    let eloToStart = 1500;
    if (profile?.elos) {
      if (totalBlockTime <= 3000 && typeof profile.elos.plan5Total === 'number')
        eloToStart = profile.elos.plan5Total;
      else if (
        totalBlockTime > 3000 &&
        totalBlockTime <= 6000 &&
        typeof profile.elos.plan10Total === 'number'
      )
        eloToStart = profile.elos.plan10Total;
      else if (
        totalBlockTime > 6000 &&
        totalBlockTime <= 12000 &&
        typeof profile.elos.plan20Total === 'number'
      )
        eloToStart = profile.elos.plan20Total;
      else if (
        totalBlockTime > 12000 &&
        typeof profile.elos.plan30Total === 'number'
      )
        eloToStart = profile.elos.plan30Total;
    }

    const loader = await this.loadingController.create({
      message: 'Cargando puzzles...',
    });
    await loader.present();

    try {
      const planToPlay = await this.planService.makeCustomPlanForPlay(
        plan,
        eloToStart,
        (loaded, total) => {
          loader.message = `Cargando puzzles... ${loaded}/${total}`;
        }
      );
      await loader.dismiss();
      // Limpiar el plan anterior antes de establecer uno nuevo
      this.planFacade.clearPlan();
      this.planFacade.setPlan(planToPlay);
      this.router.navigate(['/puzzles/training']);
    } catch (error) {
      await loader.dismiss();
      console.error('Error al cargar el plan:', error);
      throw error;
    }
  }

  formatDate(createdAt: number): string {
    if (!createdAt) return '';
    return new Date(createdAt).toLocaleDateString();
  }

  async openLoginModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: LoginComponent,
      componentProps: { segmentEmailPassword: 'login' },
    });
    await modal.present();
    await modal.onDidDismiss();
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
