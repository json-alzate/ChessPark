import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

import {
  IonContent,
  IonToolbar,
  IonFooter,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonReorderGroup,
  IonReorder,
  IonNote,
  ItemReorderCustomEvent,
  ModalController,
} from '@ionic/angular/standalone';

import { TranslocoPipe } from '@jsverse/transloco';

import { Plan, Block } from '@cpark/models';
import { UidGeneratorService, SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { CustomPlansService } from '@services/custom-plans.service';
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { PlanFacadeService } from '@cpark/state';

import { NavbarComponent } from '@shared/components/navbar/navbar.component';
import { BlockSettingsComponent } from '@pages/puzzles/components/block-settings/block-settings.component';

import { addIcons } from 'ionicons';
import { add, shuffle, trendingDown, infiniteOutline } from 'ionicons/icons';

@Component({
  selector: 'app-custom-plan-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    SecondsToMinutesSecondsPipe,
    IonContent,
    IonToolbar,
    IonFooter,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonReorderGroup,
    IonReorder,
    IonNote,
    NavbarComponent,
  ],
  templateUrl: './custom-plan-form.component.html',
  styleUrl: './custom-plan-form.component.scss',
})
export class CustomPlanFormComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private customPlansService = inject(CustomPlansService);
  private planService = inject(PlanService);
  private profileService = inject(ProfileService);
  private planFacade = inject(PlanFacadeService);
  private modalController = inject(ModalController);
  private uidGenerator = inject(UidGeneratorService);

  nameControl = new FormControl('', [Validators.required, Validators.maxLength(30)]);
  isPublicControl = new FormControl(false);
  blocks: Block[] = [];
  isEditMode = false;
  planUid: string | null = null;
  originalCreatedAt: number = 0;
  loading = true;
  saving = false;

  constructor() {
    addIcons({ add, shuffle, trendingDown, infiniteOutline });
  }

  ngOnInit(): void {
    const uid = this.route.snapshot.paramMap.get('uid');
    if (uid) {
      this.isEditMode = true;
      this.planUid = uid;
      this.loadPlan(uid);
    } else {
      this.loading = false;
    }
  }

  async loadPlan(uid: string): Promise<void> {
    try {
      const plan = await this.customPlansService.getById(uid);
      if (plan) {
        this.nameControl.setValue(plan.title ?? '');
        this.blocks = (plan.blocks ?? []).map((b) => ({
          ...b,
          puzzles: undefined,
          puzzlesPlayed: [],
        }));
        this.isPublicControl.setValue(plan.isPublic ?? false);
        this.originalCreatedAt = plan.createdAt ?? 0;
      }
    } finally {
      this.loading = false;
    }
  }

  async openBlockSettingsModal(): Promise<void> {
    if (this.blocks.length >= 5) return;
    const modal = await this.modalController.create({
      component: BlockSettingsComponent,
      initialBreakpoint: 0.8,
      breakpoints: [0, 0.25, 0.5, 0.75],
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.blocks.push(data);
    }
  }

  doReorder(event: ItemReorderCustomEvent): void {
    const item = this.blocks.splice(event.detail.from, 1)[0];
    this.blocks.splice(event.detail.to, 0, item);
    event.detail.complete();
  }

  private getEloToStart(): number {
    const totalBlockTime = this.blocks.reduce((sum, b) => sum + (b.time > 0 ? b.time : 0), 0);
    const profile = this.profileService.getProfile;
    if (!profile?.elos) return 1500;
    if (totalBlockTime <= 3000 && typeof profile.elos.plan5Total === 'number') return profile.elos.plan5Total;
    if (totalBlockTime > 3000 && totalBlockTime <= 6000 && typeof profile.elos.plan10Total === 'number') return profile.elos.plan10Total;
    if (totalBlockTime > 6000 && totalBlockTime <= 12000 && typeof profile.elos.plan20Total === 'number') return profile.elos.plan20Total;
    if (totalBlockTime > 12000 && typeof profile.elos.plan30Total === 'number') return profile.elos.plan30Total;
    return 1500;
  }

  private buildPlanToSave(): Plan {
    const uidUser = this.profileService.getProfile?.uid ?? '';
    const blocksToSave = this.blocks.map(({ puzzles, puzzlesPlayed, ...rest }) => ({ ...rest, puzzlesPlayed: [] }));
    if (this.isEditMode && this.planUid) {
      return {
        uid: this.planUid,
        uidCustomPlan: this.planUid,
        title: this.nameControl.value ?? '',
        uidUser,
        createdAt: this.originalCreatedAt,
        planType: 'custom',
        blocks: blocksToSave,
        isPublic: this.isPublicControl.value ?? false,
      };
    }
    const uid = this.uidGenerator.generateSimpleUid();
    return {
      uid,
      uidCustomPlan: uid,
      title: this.nameControl.value ?? '',
      uidUser,
      createdAt: Date.now(),
      planType: 'custom',
      blocks: blocksToSave,
      isPublic: this.isPublicControl.value ?? false,
    };
  }

  async saveAndPlay(): Promise<void> {
    if (this.nameControl.invalid || !this.nameControl.value) {
      this.nameControl.markAsTouched();
      return;
    }
    if (this.blocks.length === 0) return;
    this.saving = true;
    try {
      const plan = this.buildPlanToSave();
      if (this.isEditMode) {
        await this.customPlansService.update(plan);
      } else {
        await this.customPlansService.save(plan);
      }
      const eloToStart = this.getEloToStart();
      const planToPlay = await this.planService.makeCustomPlanForPlay(plan, eloToStart);
      this.planFacade.setPlan(planToPlay);
      this.router.navigate(['/puzzles/training']);
    } finally {
      this.saving = false;
    }
  }

  async save(): Promise<void> {
    if (this.nameControl.invalid || !this.nameControl.value) {
      this.nameControl.markAsTouched();
      return;
    }
    if (this.blocks.length === 0) return;
    this.saving = true;
    try {
      const plan = this.buildPlanToSave();
      if (this.isEditMode) {
        await this.customPlansService.update(plan);
      } else {
        await this.customPlansService.save(plan);
      }
      this.router.navigate(['/puzzles/custom-plans']);
    } finally {
      this.saving = false;
    }
  }

}
