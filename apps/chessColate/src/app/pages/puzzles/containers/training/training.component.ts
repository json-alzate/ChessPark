import { Component, CUSTOM_ELEMENTS_SCHEMA, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Transloco
import { TranslocoPipe } from '@jsverse/transloco';

import { IonRippleEffect, LoadingController, ModalController, IonIcon } from '@ionic/angular/standalone';

// services
import { AppService } from '@services/app.service';
import { BlockService } from '@services/block.service';
import { ProfileService } from '@services/profile.service';
import { PlanFacadeService } from '@cpark/state';
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
export class TrainingComponent implements OnInit {
  private blockService = inject(BlockService);
  private planFacade = inject(PlanFacadeService);
  private router = inject(Router);
  appService = inject(AppService);
  private profileService = inject(ProfileService);
  private uidGenerator = inject(UidGeneratorService);
  private soundsService = inject(SoundsService);
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

  constructor(private modalController: ModalController) {
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

    this.planFacade.getPlan$().subscribe((plan: Plan | null) => {
      if (!plan) {
        this.router.navigate(['/home']);
        return;
      }
      this.plan = { ...plan };
      console.log('Plan ', this.plan);
      if (!this.plan.isFinished) {
        this.playNextBlock();
        return;
      }
    });
  }


  playNextBlock() {
    this.currentIndexBlock++;

    // se valida si se ha llegado al final del plan
    if (this.currentIndexBlock === this.plan.blocks.length) {
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

    const themeName = this.plan.blocks[this.currentIndexBlock].theme;
    const openingFamily = this.plan.blocks[this.currentIndexBlock].openingFamily;
    const blockDescription = this.plan.blocks[this.currentIndexBlock].description;
    const themeOrOpeningName = themeName ?
      this.appService.getNameThemePuzzleByValue(themeName) :
      this.appService.getNameOpeningByValue(openingFamily || '');

    const title = this.plan.blocks[this.currentIndexBlock].title ?
      this.plan.blocks[this.currentIndexBlock].title :
      themeOrOpeningName;

    let image = 'assets/images/puzzle-themes/opening.svg';
    if (themeName) {
      // si el tema es mateIn1, mateIn2, mateIn3, mateIn4, mateIn5, mateIn6, mateIn7, mateIn8, etc se debe mostrar el tema mate
      if (themeName.includes('mateIn')) {
        image = 'assets/images/puzzle-themes/mate.svg';
      } else {
        image = `assets/images/puzzle-themes/${themeName}.svg`;
      }
    }

    const description = blockDescription ? blockDescription :
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
      this.selectPuzzleToPlay();
      if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
        this.showBlockTimer = true;
        this.initTimeToEndBlock(this.plan.blocks[this.currentIndexBlock].time);
      } else {
        this.showBlockTimer = false;
        this.stopBlockTimer();
      }
      this.forceStopTimerInPuzzleBoard = false;
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

    if (currentBlock.goshPuzzleTime) {
      puzzle.goshPuzzleTime = currentBlock.goshPuzzleTime;
    }
    if (currentBlock.puzzleTimes) {
      puzzle.times = currentBlock.puzzleTimes;
    }


    this.puzzleToPlay = puzzle;
    if (puzzle.goshPuzzleTime && !this.isGoshHelperShow) {
      this.isGoshHelperShow = true;
    } else {
      this.isGoshHelperShow = false;
    }
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
    const currentBlock = {
      ...this.plan.blocks[this.currentIndexBlock],
      puzzlesPlayed: [...this.plan.blocks[this.currentIndexBlock].puzzlesPlayed, userPuzzle]
    };

    // Crear una nueva copia de todos los bloques
    const newBlocks = [...this.plan.blocks];
    // Reemplazar el bloque actual con la copia actualizada
    newBlocks[this.currentIndexBlock] = currentBlock;

    // Ahora actualizar el plan con los nuevos bloques
    this.plan = {
      ...this.plan,
      blocks: newBlocks
    };


    console.log('Plan actualizado ', this.plan);



    if (this.plan.planType === 'custom') {

      // this.plansElosService.calculatePlanElos(
      //   puzzleCompleted.rating,
      //   puzzleStatus === 'good' ? 1 : 0,
      //   this.plan?.uidCustomPlan,
      //   this.profileService.getProfile?.uid,
      //   puzzleCompleted.themes,
      //   puzzleCompleted.openingFamily,
      // );



      
    } else {
      // se actualizan los elo's del usuario
      // this.profileService.calculateEloPuzzlePlan(
      //   puzzleCompleted.rating,
      //   puzzleStatus === 'good' ? 1 : 0,
      //   this.plan.planType,
      //   puzzleCompleted.themes,
      //   puzzleCompleted.openingFamily,
      // );
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
    
    // Navegar a la pantalla de plan jugado
    this.router.navigate(['/puzzles/plan-played']);
    // TODO: Track end plan
  }

  onExitTraining() {
    this.stopPlanTimer();
    this.forceStopTimerInPuzzleBoard = true;
    this.router.navigate(['/home']);
  }

  closeDropdown() {
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 200);
  }




  ionViewWillLeave() {
    this.forceStopTimerInPuzzleBoard = true;
    this.timerUnsubscribe$.next();
    this.timerUnsubscribe$.complete();
    this.timerUnsubscribeBlock$.next();
    this.timerUnsubscribeBlock$.complete();
  }

}
