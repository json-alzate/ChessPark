import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavController, ModalController, AlertController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';

import { Meta } from '@angular/platform-browser';



import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TranslateService } from '@ngx-translate/core';

/**
 * Funcionalidad: que al mostrar la solución lo haga que cada jugada deje flechas,  después
 * las piezas se disuelvan y queden las flechas en un efecto de fade out dramático
 * para que se evidencie el patron con las flechas
 * */

// models
import { Puzzle } from '@models/puzzle.model';
import { UserPuzzle } from '@models/user-puzzles.model';
import { Plan, PlanTypes } from '@models/plan.model';

// Services
import { PlanService } from '@services/plan.service';
import { ProfileService } from '@services/profile.service';
import { AppService } from '@services/app.service';
import { SoundsService } from '@services/sounds.service';
import { BlockService } from '@services/block.service';

// utils
import { createUid } from '@utils/create-uid';

// components
import { BlockPresentationComponent } from '@pages/puzzles/components/block-presentation/block-presentation.component';
import { PuzzleSolutionComponent } from '@pages/puzzles/components/puzzle-solution/puzzle-solution.component';
import { PlanChartComponent } from '@pages/puzzles/components/plan-chart/plan-chart.component';
import { PlansElosService } from '@services/plans-elos.service';

@Component({
  selector: 'app-training',
  templateUrl: './training.component.html',
  styleUrls: ['./training.component.scss'],
})
export class TrainingComponent implements OnInit {

  //ui
  showBlockTimer = false;

  currentIndexBlock = -1; // -1 para que al iniciar se seleccione el primer bloque sumando ++ y queda en 0
  plan: Plan;

  puzzleToPlay: Puzzle;
  timerUnsubscribe$ = new Subject<void>();

  timeLeftBlock = 0;
  timerUnsubscribeBlock$ = new Subject<void>();
  countPuzzlesPlayedBlock = 0;
  totalPuzzlesInBlock = 0;
  forceStopTimerInPuzzleBoard = false;


  currentLanguage = this.translateService.currentLang;

  isGoshHelperShow = false;

  constructor(
    private planService: PlanService,
    private blockService: BlockService,
    private navController: NavController,
    private profileService: ProfileService,
    private modalController: ModalController,
    public appService: AppService,
    private soundsService: SoundsService,
    private translateService: TranslateService,
    private plansElosService: PlansElosService,
    private alertController: AlertController,
    private meta: Meta) {
    this.checkGoshHelper();
  }

  async checkGoshHelper() {
    const { value } = await Preferences.get({ key: 'showGoshPuzzleHelper' });
    this.isGoshHelperShow = value === 'true';
  }

  ngOnInit() {
    this.meta.addTags([
      { name: 'robots', content: 'noindex' }
    ]);
    this.planService.getPlan().then((plan: Plan) => {
      if (!plan) {
        this.navController.navigateRoot('/puzzles/training-menu');
        return;
      }
      this.plan = { ...plan };
      console.log('Plan ', this.plan);
      this.playNextBlock();
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
      this.appService.getNameOpeningByValue(openingFamily);

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
        this.appService.getDescriptionOpeningByValue(openingFamily));

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

    // calcular si queda menos de 10 puzzles por jugar, para cargar mas puzzles
    const puzzlesLeftToPlay = this.plan.blocks[this.currentIndexBlock]?.puzzles?.length - this.countPuzzlesPlayedBlock;
    if (puzzlesLeftToPlay < 10) {
      this.blockService.getPuzzlesForBlock(this.plan.blocks[this.currentIndexBlock]).then((puzzlesToAdd: Puzzle[]) => {
        this.plan.blocks[this.currentIndexBlock].puzzles = [...puzzlesToAdd];
      });
    }

    const puzzle = { ...this.plan.blocks[this.currentIndexBlock].puzzles[this.countPuzzlesPlayedBlock] };


    if (this.plan.blocks[this.currentIndexBlock].goshPuzzleTime) {
      puzzle.goshPuzzleTime = this.plan.blocks[this.currentIndexBlock].goshPuzzleTime;
    }
    if (this.plan.blocks[this.currentIndexBlock].puzzleTimes) {
      puzzle.times = this.plan.blocks[this.currentIndexBlock].puzzleTimes;
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
      uid: createUid(),
      uidUser: this.profileService.getProfile?.uid,
      uidPuzzle: puzzleCompleted.uid,
      date: new Date().getTime(),
      resolved: puzzleStatus === 'good',
      failByTime: puzzleStatus === 'timeOut',
      resolvedTime: puzzleCompleted.timeUsed,
      currentEloUser: this.profileService.getProfile?.elo || 0,
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

      this.plansElosService.calculatePlanElos(
        puzzleCompleted.rating,
        puzzleStatus === 'good' ? 1 : 0,
        this.plan?.uidCustomPlan,
        this.profileService.getProfile?.uid,
        puzzleCompleted.themes,
        puzzleCompleted.openingFamily,
      );

    } else {
      // se actualizan los elo's del usuario
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

    const modal = await this.modalController.create({
      component: PuzzleSolutionComponent,
      componentProps: {
        puzzle: this.puzzleToPlay
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

    this.stopPlanTimer();
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.planType !== 'custom') {
      this.plan = { ...this.plan, eloTotal: this.profileService.getProfile?.elos[this.plan.planType + 'Total'] };
    }

    if (this.profileService.getProfile?.uid) {
      this.plan = { ...this.plan, uidUser: this.profileService.getProfile?.uid };
      // console.log('Plan finalizado ', JSON.stringify(this.plan));
      this.planService.requestSavePlanAction(this.plan);
    }

    console.log('Plan finalizado ', this.plan);

    this.planService.setPlanAction(this.plan);
    this.navController.navigateRoot('/puzzles/plan-played');
    // TODO: Track end plan
  }




  ionViewWillLeave() {
    this.forceStopTimerInPuzzleBoard = true;
    this.timerUnsubscribe$.next();
    this.timerUnsubscribe$.complete();
    this.timerUnsubscribeBlock$.next();
    this.timerUnsubscribeBlock$.complete();
  }

  // TODO: Esto debe estar en otro componente
  async showChart(planType: PlanTypes) {

    const modal = await this.modalController.create({
      component: PlanChartComponent,
      componentProps: {
        planType,
        isModal: true
      }
    });

    await modal.present();

  }
}
