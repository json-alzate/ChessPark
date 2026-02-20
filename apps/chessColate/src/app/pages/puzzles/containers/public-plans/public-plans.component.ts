import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { map, takeUntil, filter, take, switchMap } from 'rxjs/operators';
import { Subject, from, combineLatest } from 'rxjs';

import {
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonIcon,
    LoadingController,
} from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { PublicPlan, PublicPlanFilter, PlanInteraction } from '@cpark/models';

import { PublicPlansService } from '@services/public-plans.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { FirestoreService } from '@services/firestore.service';
import {
    PublicPlansFacadeService,
    getProfile,
    AppState,
} from '@cpark/state';
import { PlanFacadeService } from '@cpark/state';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { PublicPlanItemComponent } from '@pages/puzzles/components/public-plan-item/public-plan-item.component';

import { addIcons } from 'ionicons';
import { heartOutline, heart, playOutline, bookmarkOutline, bookmark, homeOutline } from 'ionicons/icons';

@Component({
    selector: 'app-public-plans',
    standalone: true,
    imports: [
        CommonModule,
        TranslocoPipe,
        IonContent,
        IonInfiniteScroll,
        IonInfiniteScrollContent,
        IonIcon,
        NavbarComponent,
        PublicPlanItemComponent,
    ],
    templateUrl: './public-plans.component.html',
    styleUrl: './public-plans.component.scss',
})
export class PublicPlansComponent implements OnInit, OnDestroy {
    private publicPlansFacade = inject(PublicPlansFacadeService);
    private publicPlansService = inject(PublicPlansService);
    private planService = inject(PlanService);
    private profileService = inject(ProfileService);
    private planFacade = inject(PlanFacadeService);
    private firestoreService = inject(FirestoreService);
    private router = inject(Router);
    private loadingController = inject(LoadingController);
    private store = inject(Store<AppState>);
    private destroy$ = new Subject<void>();

    // Observables
    publicPlans$ = this.publicPlansFacade.getPublicPlans$();
    loading$ = this.publicPlansFacade.getPublicPlansLoading$();
    loadingMore$ = this.publicPlansFacade.getPublicPlansLoadingMore$();
    hasMore$ = this.publicPlansFacade.getPublicPlansHasMore$();
    filter$ = this.publicPlansFacade.getPublicPlansFilter$();
    userInteractions$ = this.publicPlansFacade.getUserInteractions$();
    userLikedPlanUids$ = this.publicPlansFacade.getUserLikedPlans$();
    userPlayedPlanUids$ = this.publicPlansFacade.getUserPlayedPlans$();
    userSavedPlanUids$ = this.publicPlansFacade.getUserSavedPlans$();
    loadingInteractions$ = this.publicPlansFacade.getLoadingInteractions$();
    profile$ = this.store.select(getProfile);

    // Estado local
    activeTab: 'public' | 'interactions' = 'public';
    activeInteractionTab: 'liked' | 'played' | 'saved' = 'liked';

    // Planes enriquecidos con interacciones
    enrichedPublicPlans: PublicPlan[] = [];
    enrichedLikedPlans: PublicPlan[] = [];
    enrichedPlayedPlans: PublicPlan[] = [];
    enrichedSavedPlans: PublicPlan[] = [];

    constructor() {
        addIcons({ heartOutline, heart, playOutline, bookmarkOutline, bookmark, homeOutline });
    }

    ngOnInit(): void {
        // Enriquecer planes públicos con interacciones
        combineLatest([this.publicPlans$, this.userInteractions$])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([plans, interactions]: [PublicPlan[], PlanInteraction[]]) => {
                this.enrichedPublicPlans = this.publicPlansService.enrichPlansWithInteractions(
                    plans,
                    interactions
                );
            });

        // Cargar planes de interacciones cuando cambian los UIDs
        combineLatest([this.userLikedPlanUids$, this.userInteractions$])
            .pipe(
                switchMap(([planUids, interactions]: [string[], PlanInteraction[]]) => {
                    if (planUids.length === 0) {
                        return from([{ plans: [] as PublicPlan[], interactions }]);
                    }
                    return from(
                        Promise.all(
                            planUids.map((uid: string) => this.firestoreService.getPublicPlan(uid))
                        )
                    ).pipe(
                        map((plans) => ({
                            plans: plans.filter((p): p is PublicPlan => p !== null),
                            interactions,
                        }))
                    );
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(({ plans, interactions }: { plans: PublicPlan[]; interactions: PlanInteraction[] }) => {
                this.enrichedLikedPlans = this.publicPlansService.enrichPlansWithInteractions(
                    plans,
                    interactions
                );
            });

        combineLatest([this.userPlayedPlanUids$, this.userInteractions$])
            .pipe(
                switchMap(([planUids, interactions]: [string[], PlanInteraction[]]) => {
                    if (planUids.length === 0) {
                        return from([{ plans: [] as PublicPlan[], interactions }]);
                    }
                    return from(
                        Promise.all(
                            planUids.map((uid: string) => this.firestoreService.getPublicPlan(uid))
                        )
                    ).pipe(
                        map((plans) => ({
                            plans: plans.filter((p): p is PublicPlan => p !== null),
                            interactions,
                        }))
                    );
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(({ plans, interactions }: { plans: PublicPlan[]; interactions: PlanInteraction[] }) => {
                this.enrichedPlayedPlans = this.publicPlansService.enrichPlansWithInteractions(
                    plans,
                    interactions
                );
            });

        combineLatest([this.userSavedPlanUids$, this.userInteractions$])
            .pipe(
                switchMap(([planUids, interactions]: [string[], PlanInteraction[]]) => {
                    if (planUids.length === 0) {
                        return from([{ plans: [] as PublicPlan[], interactions }]);
                    }
                    return from(
                        Promise.all(
                            planUids.map((uid: string) => this.firestoreService.getPublicPlan(uid))
                        )
                    ).pipe(
                        map((plans) => ({
                            plans: plans.filter((p): p is PublicPlan => p !== null),
                            interactions,
                        }))
                    );
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(({ plans, interactions }: { plans: PublicPlan[]; interactions: PlanInteraction[] }) => {
                this.enrichedSavedPlans = this.publicPlansService.enrichPlansWithInteractions(
                    plans,
                    interactions
                );
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    setFilter(filter: PublicPlanFilter): void {
        this.publicPlansFacade.setFilter(filter);
        // Recargar planes con el nuevo filtro
        this.publicPlansFacade.loadPublicPlans(filter, 20);
    }

    onInfiniteScroll(event: any): void {
        this.hasMore$
            .pipe(take(1), takeUntil(this.destroy$))
            .subscribe((hasMore) => {
                if (hasMore) {
                    this.publicPlansFacade.loadMorePublicPlans();
                    // Esperar a que termine la carga
                    this.loadingMore$
                        .pipe(
                            filter((loading) => !loading),
                            take(1),
                            takeUntil(this.destroy$)
                        )
                        .subscribe(() => {
                            event.target.complete();
                        });
                } else {
                    event.target.complete();
                }
            });
    }

    async onPlayPlan(plan: PublicPlan): Promise<void> {
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
            const planToPlay = await this.publicPlansService.preparePlanForPlay(
                plan,
                eloToStart,
                (loaded, total) => {
                    loader.message = `Cargando puzzles... ${loaded}/${total}`;
                }
            );
            await loader.dismiss();
            // Marcar como jugado
            if (profile?.uid) {
                this.publicPlansFacade.markPlanAsPlayed(profile.uid, plan.uid);
            }
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

    onToggleLike(plan: PublicPlan, liked: boolean): void {
        const profile = this.profileService.getProfile;
        if (!profile?.uid) return;
        this.publicPlansFacade.togglePlanLike(profile.uid, plan.uid, liked);
    }

    onToggleSaved(plan: PublicPlan, saved: boolean): void {
        const profile = this.profileService.getProfile;
        if (!profile?.uid) return;
        this.publicPlansFacade.togglePlanSaved(profile.uid, plan.uid, saved);
    }

    getCurrentInteractionPlans(): PublicPlan[] {
        switch (this.activeInteractionTab) {
            case 'liked':
                return this.enrichedLikedPlans;
            case 'played':
                return this.enrichedPlayedPlans;
            case 'saved':
                return this.enrichedSavedPlans;
            default:
                return [];
        }
    }

    goToHome(): void {
        this.router.navigate(['/home']);
    }
}
