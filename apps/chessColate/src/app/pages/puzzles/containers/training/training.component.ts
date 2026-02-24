import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Transloco
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { IonRippleEffect, LoadingController, ModalController, IonIcon, AlertController } from '@ionic/angular/standalone';

// services
import { AppService } from '@services/app.service';
import { BlockService } from '@services/block.service';
import { ProfileService } from '@services/profile.service';
import { PlanFacadeService } from '@cpark/state';
import { PlansElosService } from '@services/plans-elos.service';
import { PlanStorageService } from '@services/plan-storage.service';
import { UidGeneratorService } from '@chesspark/common-utils';
import { addIcons } from 'ionicons';
import {
  timerOutline,
  chevronDownOutline,
  checkmarkCircleOutline,
  removeCircleOutline,
  ellipseOutline,
  timeOutline,
  closeOutline
} from 'ionicons/icons';

// models
import { Block, Plan, PlanTypes, Puzzle, UserPuzzle } from '@cpark/models';


import { BoardPuzzleComponent, BoardPuzzleSolutionComponent } from '@chesspark/board';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { BlockPresentationComponent } from '../../components/block-presentation/block-presentation.component';
import { SoundsService, SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

@Component({
  selector: 'app-training',
  imports: [CommonModule, BoardPuzzleComponent, SecondsToMinutesSecondsPipe, TranslocoPipe, IonIcon],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './training.component.html',
  styleUrl: './training.component.scss',
})
export class TrainingComponent implements OnInit, OnDestroy {
  private blockService = inject(BlockService);
  private planFacade = inject(PlanFacadeService);
  private plansElosService = inject(PlansElosService);
  private planStorageService = inject(PlanStorageService);
  private router = inject(Router);
  appService = inject(AppService);
  private profileService = inject(ProfileService);
  private translocoService = inject(TranslocoService);
  private uidGenerator = inject(UidGeneratorService);
  private soundsService = inject(SoundsService);

  // Subject para gestionar suscripciones
  private destroy$ = new Subject<void>();
  private isInitialized = false;
  private isProcessingBlock = false;
  private isLoadingPlan = false;

  showBlockTimer = false;

  currentIndexBlock = -1; // -1 para que al iniciar se seleccione el primer bloque sumando ++ y queda en 0
  plan!: Plan;

  puzzleToPlay!: Puzzle;
  timerUnsubscribe$ = new Subject<void>();

  timeLeftBlock = 0;
  timerUnsubscribeBlock$ = new Subject<void>();
  countPuzzlesPlayedBlock = 0;
  totalPuzzlesInBlock = 0;
  forceStopTimerInPuzzleBoard = false;


  isGoshHelperShow = false;
  isDropdownOpen = false;

  /** Color con el que juega el usuario en el puzzle actual (blancas o negras) */
  get playerColor(): 'white' | 'black' {
    const block = this.plan?.blocks?.[this.currentIndexBlock];
    const puzzle = this.puzzleToPlay;
    if (!block) return 'white';
    if (block.color === 'white') return 'white';
    if (block.color === 'black') return 'black';
    // random: el FEN indica el turno del oponente (quien acaba de mover); invertimos para obtener el color del jugador
    if (puzzle?.fen) {
      const parts = puzzle.fen.trim().split(/\s+/);
      const turn = parts[1]?.toLowerCase();
      return turn === 'b' ? 'white' : 'black';
    }
    return 'white';
  }

  constructor(
    private modalController: ModalController,
    private alertController: AlertController
  ) {
    addIcons({
      timerOutline,
      chevronDownOutline,
      checkmarkCircleOutline,
      removeCircleOutline,
      ellipseOutline,
      timeOutline,
      closeOutline
    });
  }

  ngOnInit() {
    // Prevenir múltiples inicializaciones
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Suscribirse al estado de carga del plan
    this.planFacade.getLoadingPlan$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoadingPlan = loading;
      });

    this.planFacade.getPlan$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((plan: Plan | null) => {
        if (!plan) {
          // Solo navegar a home si:
          // 1. No se está cargando un plan
          // 2. Y no tenemos un plan ya asignado (para evitar navegar cuando se limpia después de tener uno)
          if (!this.isLoadingPlan && !this.plan) {
            this.router.navigate(['/home']);
          }
          return;
        }

        // Si ya tenemos el mismo plan, no hacer nada
        if (this.plan && this.plan.uid === plan.uid) {
          return;
        }

        this.plan = { ...plan };
        console.log('Plan ', this.plan);

        // Guardar el máximo inicial si no está guardado (solo la primera vez que se carga el plan)
        if (!this.plan.isFinished && !this.plan.initialMaxElo && !this.isProcessingBlock) {
          this.saveInitialMaxElo();
        }

        // Solo procesar si el plan no está terminado y no se está procesando un bloque
        if (!this.plan.isFinished && !this.isProcessingBlock) {
          this.playNextBlock();
          return;
        }
      });
  }

  ngOnDestroy() {
    // Completar destroy$ para cancelar todas las suscripciones
    this.destroy$.next();
    this.destroy$.complete();

    // Limpiar recursos
    this.cleanupResources();
  }

  /**
   * Guarda el ELO máximo inicial del plan antes de empezar a jugar
   */
  private async saveInitialMaxElo() {
    if (!this.plan) return;

    if (this.plan.planType === 'custom' && this.plan.uidCustomPlan && this.profileService.getProfile?.uid) {
      const planElos = await this.plansElosService.getOnePlanElo(this.plan.uidCustomPlan);
      const initialMax = planElos?.maxTotal ?? planElos?.total ?? 1500;
      this.plan = { ...this.plan, initialMaxElo: initialMax };
      this.planFacade.updatePlan(this.plan);
    } else if (this.plan.planType !== 'custom') {
      const profile = this.profileService.getProfile;
      const elos = profile?.elos;
      if (elos) {
        const maxTotalKey = `${this.plan.planType}MaxTotal` as keyof typeof elos;
        const maxTotal = elos[maxTotalKey];
        const initialMax = (typeof maxTotal === 'number' ? maxTotal : undefined) ?? this.profileService.getEloTotalByPlanType(this.plan.planType);
        this.plan = { ...this.plan, initialMaxElo: initialMax };
        this.planFacade.updatePlan(this.plan);
      } else {
        const initialMax = this.profileService.getEloTotalByPlanType(this.plan.planType);
        this.plan = { ...this.plan, initialMaxElo: initialMax };
        this.planFacade.updatePlan(this.plan);
      }
    }
  }

  playNextBlock() {
    // Prevenir ejecuciones múltiples
    if (this.isProcessingBlock) {
      return;
    }

    this.isProcessingBlock = true;
    this.currentIndexBlock++;

    // se valida si se ha llegado al final del plan
    if (this.currentIndexBlock === this.plan.blocks.length) {
      this.isProcessingBlock = false;
      this.endPlan();
      return;
    }

    this.totalPuzzlesInBlock = this.plan.blocks[this.currentIndexBlock].puzzlesCount;

    this.countPuzzlesPlayedBlock = 0;
    this.showBlockTimer = false;
    this.pausePlanTimer();
    this.showBlockPresentation();
  }

  async showBlockPresentation() {

    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    this.totalPuzzlesInBlock = this.plan.blocks[this.currentIndexBlock].puzzlesCount;

    const currentBlock = this.plan.blocks[this.currentIndexBlock];
    const themeName = currentBlock.theme;
    const openingFamily = currentBlock.openingFamily;
    const blockDescription = currentBlock.description;
    const blockTitle = currentBlock.title;
    const blockColor = currentBlock.color;

    const themeOrOpeningName = themeName ?
      this.appService.getNameThemePuzzleByValue(themeName) :
      this.appService.getNameOpeningByValue(openingFamily || '');

    const whiteColorText = this.translocoService.translate('PUZZLES.colors.white');
    const blackColorText = this.translocoService.translate('PUZZLES.colors.black');
    const colorText = blockColor === 'white' ? whiteColorText :
      blockColor === 'black' ? blackColorText : null;

    const isDescriptionJustColor = blockDescription === whiteColorText || blockDescription === blackColorText;

    let title: string;
    if (blockTitle) {
      title = blockTitle;
    } else if (themeOrOpeningName && colorText) {
      const withPrefix = this.translocoService.translate('PUZZLES.with');
      title = `${themeOrOpeningName}${withPrefix}${colorText}`;
    } else {
      title = themeOrOpeningName;
    }

    let image = '/assets/images/puzzle-themes/opening.svg';
    if (themeName) {
      if (themeName.includes('mateIn')) {
        image = '/assets/images/puzzle-themes/mate.svg';
      } else {
        image = `/assets/images/puzzle-themes/${themeName}.svg`;
      }
    }

    const description = (blockDescription && !isDescriptionJustColor) ? blockDescription :
      (themeName ? this.appService.getDescriptionThemePuzzleByValue(themeName) :
        this.appService.getDescriptionOpeningByValue(openingFamily || ''));

    const modal = await this.modalController.create({
      component: BlockPresentationComponent,
      componentProps: {
        title,
        description,
        image,
      }
    });

    await modal.present();

    modal.onDidDismiss().then((data) => {
      this.isProcessingBlock = false;
      this.forceStopTimerInPuzzleBoard = false;
      this.selectPuzzleToPlay();
      if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
        this.showBlockTimer = true;
        this.initTimeToEndBlock(this.plan.blocks[this.currentIndexBlock].time);
      } else {
        this.showBlockTimer = false;
        this.stopBlockTimer();
      }
    });


  }


  selectPuzzleToPlay() {

    console.log('block index ', this.currentIndexBlock, ' count puzzles played', this.countPuzzlesPlayedBlock);
    // se valida si se ha llegado al final del plan
    if (this.currentIndexBlock === this.plan.blocks.length) {
      this.endPlan();
      return;
    }

    // se valida si el bloque es por cantidad de puzzles y si ya se jugaron todos
    if (this.plan.blocks[this.currentIndexBlock]?.puzzlesCount !== 0 &&
      this.countPuzzlesPlayedBlock === this.plan.blocks[this.currentIndexBlock]?.puzzlesCount) {
      this.playNextBlock();
      return;
    }

    const currentBlock = this.plan.blocks?.[this.currentIndexBlock];
    if (!currentBlock) {
      this.endPlan();
      return;
    }

    // calcular si queda menos de 10 puzzles por jugar, para cargar mas puzzles
    const puzzlesLeftToPlay = (currentBlock.puzzles?.length ?? 0) - this.countPuzzlesPlayedBlock;
    if (puzzlesLeftToPlay < 10) {
      this.blockService.getPuzzlesForBlock(currentBlock).then((puzzlesToAdd: Puzzle[]) => {
        this.plan.blocks[this.currentIndexBlock].puzzles = [...puzzlesToAdd];
      });
    }

    const puzzleSource = currentBlock.puzzles?.[this.countPuzzlesPlayedBlock];
    if (!puzzleSource) {
      console.warn('No hay puzzle disponible para el índice actual', {
        currentIndexBlock: this.currentIndexBlock,
        countPuzzlesPlayedBlock: this.countPuzzlesPlayedBlock,
      });
      return;
    }

    const puzzle = { ...puzzleSource };

    if (currentBlock.goshPuzzle && currentBlock.goshPuzzleTime) {
      puzzle.goshPuzzleTime = currentBlock.goshPuzzleTime;
    }
    if (currentBlock.puzzleTimes) {
      puzzle.times = currentBlock.puzzleTimes;
    }


    this.puzzleToPlay = puzzle;
    // Siempre verificar si el puzzle es a la ciegas para mostrar el mensaje
    this.isGoshHelperShow = !!(puzzle.goshPuzzleTime && puzzle.goshPuzzleTime > 0);
  }

  initTimeToEndBlock(timeBlock: number) {
    this.timeLeftBlock = timeBlock;
    this.timerUnsubscribeBlock$ = new Subject<void>();
    const countDown = interval(1000);
    countDown.pipe(
      takeUntil(this.timerUnsubscribeBlock$)
    ).subscribe(() => {
      if (this.timeLeftBlock > 0) {
        this.timeLeftBlock--;
      } else {
        // unsubscribe
        this.stopBlockTimer();
        this.playNextBlock();
      }
    });
  }



  pauseBlockTimer() {
    this.timerUnsubscribeBlock$.next();
  }

  resumeBlockTimer() {
    this.initTimeToEndBlock(this.timeLeftBlock);
  }

  stopBlockTimer() {
    this.timerUnsubscribeBlock$.next();
    this.timerUnsubscribeBlock$.complete();
  }

  pausePlanTimer() {
    this.timerUnsubscribe$.next();
  }


  stopPlanTimer() {
    this.stopBlockTimer();
    // this.showEndPlan = true;
    this.timerUnsubscribe$.next();
    this.timerUnsubscribe$.complete();
  }

  onPuzzleCompleted(puzzleCompleted: Puzzle, puzzleStatus: 'good' | 'bad' | 'timeOut') {
    const currentBlock = this.plan.blocks?.[this.currentIndexBlock];
    if (!currentBlock) {
      return;
    }

    this.countPuzzlesPlayedBlock++;

    const userPuzzle: UserPuzzle = {
      uid: this.uidGenerator.generateSimpleUid(),
      uidUser: this.profileService.getProfile?.uid ?? '',
      uidPuzzle: puzzleCompleted.uid,
      date: new Date().getTime(),
      resolved: puzzleStatus === 'good',
      failByTime: puzzleStatus === 'timeOut',
      resolvedTime: puzzleCompleted.timeUsed ?? 0,
      currentEloUser: this.profileService.getProfile?.elo ?? 0,
      eloPuzzle: puzzleCompleted.rating,
      themes: puzzleCompleted.themes,
      openingFamily: puzzleCompleted.openingFamily,
      openingVariation: puzzleCompleted.openingVariation,
      fenPuzzle: puzzleCompleted.fen,
      fenStartUserPuzzle: puzzleCompleted.fenStartUserPuzzle,
      firstMoveSquaresHighlight: puzzleCompleted.firstMoveSquaresHighlight,
      rawPuzzle: puzzleCompleted
    };

    // Crear una copia del bloque actual
    const existingPuzzlesPlayed = currentBlock.puzzlesPlayed ?? [];
    const updatedBlock = {
      ...currentBlock,
      puzzlesPlayed: [...existingPuzzlesPlayed, userPuzzle]
    };

    // Crear una nueva copia de todos los bloques
    const newBlocks = [...this.plan.blocks];
    // Reemplazar el bloque actual con la copia actualizada
    newBlocks[this.currentIndexBlock] = updatedBlock;

    // Ahora actualizar el plan con los nuevos bloques
    this.plan = {
      ...this.plan,
      blocks: newBlocks
    };


    console.log('Plan actualizado ', this.plan);



    if (this.plan.planType === 'custom' && this.plan?.uidCustomPlan && this.profileService.getProfile?.uid) {
      // Para planes custom: lógica en PlansElosService, que usa la fachada solo para dispatch
      this.plansElosService.calculatePlanElos(
        puzzleCompleted.rating,
        puzzleStatus === 'good' ? 1 : 0,
        this.plan.uidCustomPlan,
        this.profileService.getProfile.uid,
        puzzleCompleted.themes,
        puzzleCompleted.openingFamily,
      );
    } else if (this.plan.planType !== 'custom') {
      // Para planes por defecto, actualizar los elos del perfil
      this.profileService.calculateEloPuzzlePlan(
        puzzleCompleted.rating,
        puzzleStatus === 'good' ? 1 : 0,
        this.plan.planType,
        puzzleCompleted.themes,
        puzzleCompleted.openingFamily,
      );
    }



    switch (puzzleStatus) {
      case 'good':
        this.soundsService.playGood();
        this.selectPuzzleToPlay();
        break;
      case 'bad':
        this.soundsService.playError();

        break;
      case 'timeOut':
        this.soundsService.playLowTime();
        break;
    }

    if (puzzleStatus !== 'good' && this.plan.blocks[this.currentIndexBlock].showPuzzleSolution) {
      this.showSolution();
    } else {
      this.selectPuzzleToPlay();
    }

  }

  async showSolution() {

    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    // Calcular temas traducidos
    const themesTranslated = this.puzzleToPlay.themes.map(theme =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      componentProps: {
        puzzle: this.puzzleToPlay,
        themesTranslated
      }
    });

    await modal.present();

    modal.onDidDismiss().then((data) => {
      this.forceStopTimerInPuzzleBoard = false;
      // Asegurar que el mensaje de ajedrez a la ciegas se muestre si aplica
      this.selectPuzzleToPlay();
      if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
        this.resumeBlockTimer();
      }
    });

  }


  endPlan() {
    // this.showEndPlan = true;
    this.plan = { ...this.plan, isFinished: true };
    this.stopPlanTimer();
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.planType !== 'custom' && this.profileService.getProfile?.elos) {
      const eloKey = `${this.plan.planType}Total` as keyof NonNullable<typeof this.profileService.getProfile.elos>;
      const eloValue = this.profileService.getProfile.elos[eloKey];
      this.plan = { ...this.plan, eloTotal: typeof eloValue === 'number' ? eloValue : undefined };
    }

    if (this.profileService.getProfile?.uid) {
      this.plan = { ...this.plan, uidUser: this.profileService.getProfile?.uid };
      // console.log('Plan finalizado ', JSON.stringify(this.plan));
      // this.planService.requestSavePlanAction(this.plan);
    }

    console.log('Plan finalizado ', this.plan);

    // Actualizar el plan en Redux
    this.planFacade.updatePlan(this.plan);

    // Guardar el plan en localStorage
    this.planStorageService.savePlan(this.plan);

    // Incrementar contador de veces jugado para planes custom
    if (
      this.plan.planType === 'custom' &&
      this.plan.uidCustomPlan &&
      this.profileService.getProfile?.uid
    ) {
      this.plansElosService
        .incrementPlayCount(this.plan.uidCustomPlan, this.profileService.getProfile.uid)
        .catch((err) => console.error('Error incrementing play count', err));
    }

    // NO limpiar el plan aquí, ya que plan-played lo necesita
    // Solo detener timers y limpiar recursos del componente
    this.stopPlanTimer();
    this.stopBlockTimer();
    this.forceStopTimerInPuzzleBoard = true;
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
    this.isProcessingBlock = false;
    this.currentIndexBlock = -1;
    this.timeLeftBlock = 0;
    this.countPuzzlesPlayedBlock = 0;
    this.totalPuzzlesInBlock = 0;
    this.isInitialized = false;

    // Navegar a la pantalla de plan jugado
    this.router.navigate(['/puzzles/plan-played']);
  }

  private cleanupResources() {
    // Detener todos los timers
    this.stopPlanTimer();
    this.stopBlockTimer();

    // Limpiar flags
    this.forceStopTimerInPuzzleBoard = true;
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
    this.isProcessingBlock = false;

    // Resetear variables del componente
    this.currentIndexBlock = -1;
    this.timeLeftBlock = 0;
    this.countPuzzlesPlayedBlock = 0;
    this.totalPuzzlesInBlock = 0;

    // Resetear flag de inicialización para permitir reinicialización
    this.isInitialized = false;

    // Limpiar el estado del plan en Redux
    this.planFacade.clearPlan();
  }

  async onExitTraining() {
    const alert = await this.alertController.create({
      header: this.translocoService.translate('PUZZLES.exitTraining.title') || 'Salir del entrenamiento',
      message: this.translocoService.translate('PUZZLES.exitTraining.message') || '¿Estás seguro de que deseas salir del entrenamiento?',
      buttons: [
        {
          text: this.translocoService.translate('PUZZLES.exitTraining.cancel') || 'Cancelar',
          role: 'cancel'
        },
        {
          text: this.translocoService.translate('PUZZLES.exitTraining.confirm') || 'Salir',
          role: 'confirm',
          handler: () => {
            // Cuando se cancela, sí se debe limpiar el plan
            this.cleanupResources();
            this.router.navigate(['/home']);
          }
        }
      ]
    });

    await alert.present();
  }

  closeDropdown() {
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 200);
  }





  ionViewWillLeave() {
    // Asegurar limpieza completa al salir del componente
    this.forceStopTimerInPuzzleBoard = true;

    // Detener timers
    if (this.timerUnsubscribe$ && !this.timerUnsubscribe$.closed) {
      this.timerUnsubscribe$.next();
      this.timerUnsubscribe$.complete();
    }

    if (this.timerUnsubscribeBlock$ && !this.timerUnsubscribeBlock$.closed) {
      this.timerUnsubscribeBlock$.next();
      this.timerUnsubscribeBlock$.complete();
    }

    // Limpiar flags
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
  }

}
