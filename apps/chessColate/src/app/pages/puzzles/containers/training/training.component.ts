import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { interval, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Transloco
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import {
  IonRippleEffect,
  LoadingController,
  ModalController,
  IonIcon,
  AlertController,
} from '@ionic/angular/standalone';

// services
import { AppService } from '@services/app/app.service';
import { BlockService } from '@services/training/block.service';
import { InfinityPuzzlePoolService } from '@services/training/infinity-puzzle-pool.service';
import { ProfileService } from '@services/account/profile.service';
import { PlanFacadeService } from '@cpark/state';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { PlanStorageService } from '@services/plans/plan-storage.service';
import { PlanService } from '@services/plans/plan.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { routineMetaFromPlanType } from '@services/analytics/analytics-events.util';
import { TrainingReminderService } from '@services/training/training-reminder.service';
import { Reto333StorageService } from '@services/training/reto333-storage.service';
import { UserRecordsService } from '@services/progress/user-records.service';
import { UidGeneratorService } from '@chesspark/common-utils';
import { addIcons } from 'ionicons';
import {
  timerOutline,
  chevronDownOutline,
  checkmarkCircleOutline,
  removeCircleOutline,
  timeOutline,
  closeOutline,
  trophy,
  closeCircle,
  ellipseOutline
} from 'ionicons/icons';

// models
import { Block, Plan, Puzzle } from '@cpark/models';

import {
  BoardPuzzleComponent,
  BoardPuzzleSolutionComponent,
} from '@chesspark/board';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { BlockPresentationComponent } from '../../components/block-presentation/block-presentation.component';
import { resolvePlayerColor } from './player-color.util';
import {
  SoundsService,
  SecondsToMinutesSecondsPipe,
} from '@chesspark/common-utils';
import {
  initialEloForCustomPlan,
  initialEloForDefaultPlan,
  InitialPlanElo,
} from '@services/plans/plan-initial-elo.util';
import {
  RETO333_ELO_STEP,
  RETO333_START_ELO,
  summarizeReto333,
} from '@services/training/reto333.util';
import {
  addPuzzlePlayedToPlan,
  buildUserPuzzle,
  PuzzleResult,
} from '@services/training/user-puzzle.util';

/**
 * Orquestador de la pantalla de entrenamiento: decide qué mostrar y en qué
 * orden ocurre cada paso de la sesión.
 *
 * Reparto de responsabilidades:
 * - Dominio puro (sin Angular, testeable en aislamiento): cálculo del elo
 *   inicial por tipo de rutina (`plan-initial-elo.util`), resumen y constantes
 *   del Reto 333 (`reto333.util`), registro de cada puzzle jugado y
 *   actualización del bloque (`user-puzzle.util`), color del jugador desde el
 *   FEN (`player-color.util`).
 * - Persistencia: la marca del Reto 333 vive en `Reto333StorageService`, el plan
 *   en `PlanStorageService` y el estado en `PlanFacadeService`. Este componente
 *   no toca `localStorage`.
 * - Efectos de otros servicios: elo del perfil (`ProfileService`), elo de rutinas
 *   personalizadas (`PlansElosService`), recordatorios, analítica y sonidos.
 * - UI (aquí): cronómetros del bloque, presentaciones y soluciones en modal, y
 *   el modal final del Reto 333.
 */
@Component({
  selector: 'app-training',
  imports: [
    CommonModule,
    BoardPuzzleComponent,
    SecondsToMinutesSecondsPipe,
    TranslocoPipe,
    IonIcon,
  ],
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
  private route = inject(ActivatedRoute);
  /** Adónde volver al salir: la pantalla que empezó la sesión, o Inicio. */
  private readonly returnUrl = this.route.snapshot.queryParamMap.get('returnTo') ?? '/home';
  appService = inject(AppService);
  private profileService = inject(ProfileService);
  private translocoService = inject(TranslocoService);
  private uidGenerator = inject(UidGeneratorService);
  private soundsService = inject(SoundsService);
  private planService = inject(PlanService);
  private loadingController = inject(LoadingController);
  private infinityPoolService = inject(InfinityPuzzlePoolService);
  private analyticsService = inject(AnalyticsService);
  private trainingReminderService = inject(TrainingReminderService);
  private reto333Storage = inject(Reto333StorageService);
  private userRecordsService = inject(UserRecordsService);

  // Subject para gestionar suscripciones
  private destroy$ = new Subject<void>();
  private isInitialized = false;
  private isProcessingBlock = false;
  private isLoadingPlan = false;

  // Properties for Reto 333
  reto333StartTime: number | null = null;
  reto333EloLocal = RETO333_START_ELO;
  showReto333DaisyModal = false;
  reto333AlertData: any = null;

  showBlockTimer = false;

  currentIndexBlock = -1; // -1 para que al iniciar se seleccione el primer bloque sumando ++ y queda en 0
  plan!: Plan;

  puzzleToPlay!: Puzzle;
  timerUnsubscribe$ = new Subject<void>();

  timeLeftBlock = 0;
  /**
   * Suscripción viva del cronómetro del bloque. Es una sola referencia (y no un
   * Subject de cancelación) a propósito: al reemplazar el Subject, la
   * suscripción anterior quedaba corriendo y el tiempo del bloque bajaba al
   * doble de velocidad, saltándose bloques enteros.
   */
  private blockTimerSub: Subscription | null = null;
  /**
   * El bloque actual ya agotó su tiempo y falta hacer el cambio. Evita que un
   * tic tardío vuelva a pedir el siguiente bloque.
   */
  private blockTimeExpired = false;
  /**
   * Hay una solución en pantalla (modal o reproducción). Mientras la haya, el
   * fin de tiempo del bloque espera: primero se ve la solución del ejercicio
   * fallado y solo después se pasa al bloque siguiente.
   */
  private isSolutionOpen = false;
  countPuzzlesPlayedBlock = 0;
  totalPuzzlesInBlock = 0;
  forceStopTimerInPuzzleBoard = false;
  streamSolutionActive = false;

  isGoshHelperShow = false;
  isDropdownOpen = false;

  /** Color con el que juega el usuario en el puzzle actual (blancas o negras) */
  get playerColor(): 'white' | 'black' {
    return resolvePlayerColor(
      this.plan?.blocks?.[this.currentIndexBlock]?.color,
      this.puzzleToPlay?.fen
    );
  }

  /**
   * Puntos que sumó o restó cada puzzle ya resuelto en la sesión, en orden.
   * Alimenta las píldoras de progreso; se recorta a los más recientes para no
   * desbordar el panel.
   */
  eloChanges: number[] = [];
  private readonly MAX_ELO_CHANGES_SHOWN = 12;

  /** Elo del usuario en el plan actual, para mostrarlo mientras entrena. */
  get userElo(): number {
    return this.profileService.getEloTotalByPlanType(this.plan.planType);
  }

  /**
   * Sin sesión el elo no se guarda en ninguna parte: requestUpdateProfile no
   * hace nada sin perfil, así que mostrar progreso sería mentirle al invitado.
   */
  get canTrackElo(): boolean {
    return !!this.profileService.getProfile?.uid;
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
      closeOutline,
      trophy,
      closeCircle
    });
  }

  ngOnInit() {
    // Prevenir múltiples inicializaciones
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    // Suscribirse al estado de carga del plan
    this.planFacade
      .getLoadingPlan$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.isLoadingPlan = loading;
      });

    this.planFacade
      .getPlan$()
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

        // Guardar el máximo inicial si no está guardado (solo la primera vez que se carga el plan)
        if (
          !this.plan.isFinished &&
          !this.plan.initialMaxElo &&
          !this.isProcessingBlock
        ) {
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
   * Guarda el ELO máximo inicial del plan antes de empezar a jugar.
   * También guarda el ELO total real de arranque (initialTotalElo) para poder
   * mostrar al final cuántos puntos subió o bajó la rutina.
   */
  private async saveInitialMaxElo() {
    if (!this.plan) return;

    let initialElo: InitialPlanElo | null = null;

    if (
      this.plan.planType === 'custom' &&
      this.plan.uidCustomPlan &&
      this.profileService.getProfile?.uid
    ) {
      const planElos = await this.plansElosService.getOnePlanElo(
        this.plan.uidCustomPlan
      );
      initialElo = initialEloForCustomPlan(planElos);
    } else if (this.plan.planType !== 'custom') {
      const initialTotal = this.profileService.getEloTotalByPlanType(
        this.plan.planType
      );
      initialElo = initialEloForDefaultPlan(
        this.plan.planType,
        this.profileService.getProfile?.elos,
        initialTotal
      );
    }

    if (!initialElo) return;

    this.plan = { ...this.plan, ...initialElo };
    this.planFacade.updatePlan(this.plan);
  }

  playNextBlock() {
    // Prevenir ejecuciones múltiples
    if (this.isProcessingBlock) {
      return;
    }

    this.isProcessingBlock = true;
    // El bloque anterior queda cerrado: ningún contador suyo debe seguir vivo
    // ni volver a dispararse.
    this.stopBlockTimer();
    this.blockTimeExpired = false;
    this.currentIndexBlock++;

    // se valida si se ha llegado al final del plan
    if (this.currentIndexBlock === this.plan.blocks.length) {
      this.isProcessingBlock = false;
      this.endPlan();
      return;
    }

    this.totalPuzzlesInBlock =
      this.plan.blocks[this.currentIndexBlock].puzzlesCount;

    this.countPuzzlesPlayedBlock = 0;
    this.showBlockTimer = false;
    this.pausePlanTimer();

    if (this.plan.planType === 'infinity') {
      this.isProcessingBlock = false;
      this.forceStopTimerInPuzzleBoard = false;
      this.selectPuzzleToPlay();
      this.showBlockTimer = false;
      this.stopBlockTimer();
    } else {
      if (this.plan.planType === 'reto333' && !this.reto333StartTime) {
        this.reto333StartTime = Date.now();
      }
      this.showBlockPresentation();
    }
  }

  async showBlockPresentation() {
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    this.totalPuzzlesInBlock =
      this.plan.blocks[this.currentIndexBlock].puzzlesCount;

    const currentBlock = this.plan.blocks[this.currentIndexBlock];
    const themeName = currentBlock.theme;
    const openingFamily = currentBlock.openingFamily;
    const blockDescription = currentBlock.description;
    const blockTitle = currentBlock.title;
    const blockColor = currentBlock.color;

    const themeOrOpeningName = themeName
      ? this.appService.getNameThemePuzzleByValue(themeName)
      : this.appService.getNameOpeningByValue(openingFamily || '');

    const whiteColorText = this.translocoService.translate(
      'PUZZLES.colors.white'
    );
    const blackColorText = this.translocoService.translate(
      'PUZZLES.colors.black'
    );
    const colorText =
      blockColor === 'white'
        ? whiteColorText
        : blockColor === 'black'
        ? blackColorText
        : null;

    const isDescriptionJustColor =
      blockDescription === whiteColorText ||
      blockDescription === blackColorText;

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

    const description =
      blockDescription && !isDescriptionJustColor
        ? blockDescription
        : themeName
        ? this.appService.getDescriptionThemePuzzleByValue(themeName)
        : this.appService.getDescriptionOpeningByValue(openingFamily || '');

    const modal = await this.modalController.create({
      component: BlockPresentationComponent,
      componentProps: {
        title,
        description,
        image,
      },
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

  async selectPuzzleToPlay() {
    // se valida si se ha llegado al final del plan
    if (this.currentIndexBlock === this.plan.blocks.length) {
      this.endPlan();
      return;
    }

    // se valida si el bloque es por cantidad de puzzles y si ya se jugaron todos
    if (
      this.plan.blocks[this.currentIndexBlock]?.puzzlesCount !== 0 &&
      this.countPuzzlesPlayedBlock ===
        this.plan.blocks[this.currentIndexBlock]?.puzzlesCount
    ) {
      this.playNextBlock();
      return;
    }

    const currentBlock = this.plan.blocks?.[this.currentIndexBlock];
    if (!currentBlock) {
      this.endPlan();
      return;
    }

    // Para planes que no son infinity: precargar más puzzles cuando quedan menos de 10
    const puzzlesLeftToPlay =
      (currentBlock.puzzles?.length ?? 0) - this.countPuzzlesPlayedBlock;
    if (puzzlesLeftToPlay < 10 && this.plan.planType !== 'infinity') {
      if (this.plan.planType === 'reto333') {
        currentBlock.elo = this.reto333EloLocal;
      }
      this.blockService
        .getPuzzlesForBlock(currentBlock)
        .then((puzzlesToAdd: Puzzle[]) => {
          if (puzzlesToAdd.length > 0) {
            currentBlock.puzzles = [...puzzlesToAdd];
          }
        })
        .catch((error) => {
          console.error('Error cargando más puzzles:', error);
        });
    }

    // Para infinity: el siguiente puzzle se pide de a uno, en el momento que se
    // necesita. getNextPuzzle() ya resuelve sus propios respaldos (caché de
    // archivos o CDN) y nunca devuelve un lote: precargar uno haría que
    // puzzles[countPuzzlesPlayedBlock] quedara siempre definido y la sesión no
    // volviera a consultar el pool, encerrándose en un único tema.
    currentBlock.puzzles ??= [];
    let puzzleSource = currentBlock.puzzles[this.countPuzzlesPlayedBlock];
    if (!puzzleSource && this.plan.planType === 'infinity') {
      const nextPuzzle = await this.infinityPoolService.getNextPuzzle();
      if (nextPuzzle) {
        currentBlock.puzzles.push(nextPuzzle);
        puzzleSource = nextPuzzle;
      }
    }

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
    this.isGoshHelperShow = !!(
      puzzle.goshPuzzleTime && puzzle.goshPuzzleTime > 0
    );

    const startMeta = routineMetaFromPlanType(this.plan.planType);
    void this.analyticsService.logEvent('puzzle_started', {
      routine_kind: startMeta.kind,
      routine_minutes: startMeta.minutes,
      // El tema del bloque cuando lo hay (el resto de planes filtra por él, así
      // que describe al puzzle). Infinity no tiene tema de bloque: ahí se reporta
      // el del puzzle servido en vez de un tema inventado.
      theme: currentBlock.theme || puzzle.themes?.[0] || '',
      puzzle_elo: puzzle.rating ?? 0,
    });
  }

  initTimeToEndBlock(timeBlock: number) {
    // Apagar siempre lo anterior: es lo único que garantiza que nunca haya dos
    // cuentas atrás restando a la vez sobre el mismo tiempo.
    this.stopBlockTimer();

    this.timeLeftBlock = Math.max(timeBlock, 0);
    this.blockTimeExpired = false;

    if (this.timeLeftBlock === 0) {
      return;
    }

    this.blockTimerSub = interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.timeLeftBlock > 0) {
          this.timeLeftBlock--;
        } else {
          this.onBlockTimeUp();
        }
      });
  }

  /**
   * Se acabó el tiempo del bloque. No cambia de bloque a la fuerza: si el
   * usuario está viendo la solución de un ejercicio fallado, el cambio espera a
   * que la cierre. Así nunca se abren dos pantallas encima de la otra.
   */
  private onBlockTimeUp() {
    if (this.blockTimeExpired) {
      return;
    }
    this.blockTimeExpired = true;
    this.stopBlockTimer();
    // El bloque terminó: el tablero deja de contar el tiempo del ejercicio.
    this.forceStopTimerInPuzzleBoard = true;

    if (this.isSolutionOpen) {
      return;
    }

    this.playNextBlock();
  }

  pauseBlockTimer() {
    this.stopBlockTimer();
  }

  resumeBlockTimer() {
    // Sin tiempo restante no hay nada que reanudar: arrancar aquí creaba un
    // contador que expiraba al primer segundo y forzaba un cambio de bloque.
    if (this.timeLeftBlock <= 0) {
      return;
    }
    this.initTimeToEndBlock(this.timeLeftBlock);
  }

  stopBlockTimer() {
    this.blockTimerSub?.unsubscribe();
    this.blockTimerSub = null;
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

  onPuzzleCompleted(puzzleCompleted: Puzzle, puzzleStatus: PuzzleResult) {
    // El cambio de bloque ya está en marcha (se acabó su tiempo y se está
    // abriendo la presentación del siguiente): este resultado llegó tarde. Si
    // se registrara, iría a parar al bloque equivocado y además abriría una
    // solución encima de la presentación.
    if (this.isProcessingBlock) {
      return;
    }

    const currentBlock = this.plan.blocks?.[this.currentIndexBlock];
    if (!currentBlock) {
      return;
    }

    this.countPuzzlesPlayedBlock++;

    const userPuzzle = buildUserPuzzle({
      puzzle: puzzleCompleted,
      result: puzzleStatus,
      uid: this.uidGenerator.generateSimpleUid(),
      uidUser: this.profileService.getProfile?.uid ?? '',
      currentEloUser: this.profileService.getProfile?.elo ?? 0,
      date: new Date().getTime(),
    });

    const completedMeta = routineMetaFromPlanType(this.plan.planType);
    void this.analyticsService.logEvent('puzzle_completed', {
      result: puzzleStatus === 'timeOut' ? 'timeout' : puzzleStatus,
      puzzle_elo: puzzleCompleted.rating ?? 0,
      user_elo: this.profileService.getProfile?.elo ?? 0,
      resolved_time: puzzleCompleted.timeUsed ?? 0,
      first_theme: puzzleCompleted.themes?.[0] ?? '',
      routine_kind: completedMeta.kind,
      routine_minutes: completedMeta.minutes,
    });

    this.plan = addPuzzlePlayedToPlan(
      this.plan,
      this.currentIndexBlock,
      userPuzzle
    );

    if (
      this.plan.planType === 'custom' &&
      this.plan?.uidCustomPlan &&
      this.profileService.getProfile?.uid
    ) {
      // Para planes custom: lógica en PlansElosService, que usa la fachada solo para dispatch
      this.plansElosService.calculatePlanElos(
        puzzleCompleted.rating,
        puzzleStatus === 'good' ? 1 : 0,
        this.plan.uidCustomPlan,
        this.profileService.getProfile.uid,
        puzzleCompleted.themes,
        puzzleCompleted.openingFamily
      );
    } else if (!['custom', 'reto333'].includes(this.plan.planType)) {
      // Para planes por defecto, actualizar los elos del perfil
      const recordInfo = this.profileService.calculateEloPuzzlePlan(
        puzzleCompleted.rating,
        puzzleStatus === 'good' ? 1 : 0,
        this.plan.planType,
        puzzleCompleted.themes,
        puzzleCompleted.openingFamily
      );
      this.eloChanges = [...this.eloChanges, recordInfo.totalEloChange].slice(
        -this.MAX_ELO_CHANGES_SHOWN
      );
    }

    if (this.plan.planType === 'reto333' && puzzleStatus === 'good') {
      this.reto333EloLocal += RETO333_ELO_STEP;
      this.plan.blocks[this.currentIndexBlock].elo = this.reto333EloLocal;
    }

    switch (puzzleStatus) {
      case 'good':
        this.soundsService.playGood();
        break;
      case 'bad':
        this.soundsService.playError();
        break;
      case 'timeOut':
        this.soundsService.playLowTime();
        break;
    }

    if (puzzleStatus === 'good') {
      this.continueAfterPuzzle();
      return;
    }

    const block = this.plan.blocks[this.currentIndexBlock];
    if (block.showPuzzleSolution) {
      if (this.plan.planType === 'reto333') {
        this.showSolutionAndAlertReto333();
      } else {
        this.showSolution();
      }
    } else if (block.streamSolution) {
      this.activateStreamSolution();
    } else {
      if (this.plan.planType === 'reto333') {
        this.showReto333Alert();
      } else {
        this.continueAfterPuzzle();
      }
    }
  }

  /**
   * Qué hacer cuando el ejercicio ya se cerró (resuelto, fallado, o con su
   * solución vista). Es el único punto que decide entre seguir en el bloque o
   * cambiar de bloque, para que el fin de tiempo nunca se cuele por su cuenta.
   */
  private continueAfterPuzzle() {
    if (this.blockTimeExpired) {
      this.playNextBlock();
      return;
    }
    this.selectPuzzleToPlay();
  }

  async showSolutionAndAlertReto333() {
    this.isSolutionOpen = true;
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    const themesTranslated = this.puzzleToPlay.themes.map((theme) =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle: this.puzzleToPlay,
        themesTranslated,
      },
    });

    await modal.present();

    modal.onDidDismiss().then(() => {
      this.isSolutionOpen = false;
      this.forceStopTimerInPuzzleBoard = false;
      this.showReto333Alert();
    });
  }

  async showReto333Alert() {
    this.plan = { ...this.plan, isFinished: true };
    this.stopPlanTimer();
    this.stopBlockTimer();
    this.forceStopTimerInPuzzleBoard = true;

    if (this.profileService.getProfile?.uid) {
      this.plan = { ...this.plan, uidUser: this.profileService.getProfile.uid };
    }
    
    // Save state
    this.planFacade.updatePlan(this.plan);
    this.planStorageService.savePlan(this.plan);

    // Registrar la hora de la sesión y reprogramar el recordatorio
    this.trainingReminderService.onSessionCompleted(this.plan);

    const puzzlesPlayed = this.plan.blocks?.[0]?.puzzlesPlayed ?? [];
    const summary = summarizeReto333(
      puzzlesPlayed,
      this.reto333StartTime,
      Date.now()
    );

    // La marca queda en el dispositivo (lectura inmediata) y, si hay sesión,
    // sube al perfil para que se vea también desde otro dispositivo
    const record = this.reto333Storage.saveAttempt(
      { ...summary, maxElo: this.reto333EloLocal },
      this.profileService.getProfile?.uid
    );
    this.userRecordsService.push();

    this.reto333AlertData = {
      solvedCount: summary.score,
      timeString: summary.timeString,
      elo: this.reto333EloLocal,
      completed: summary.completed,
    };
    this.showReto333DaisyModal = true;

    void this.analyticsService.logEvent('reto333_finished', {
      solved_count: summary.score,
      time_seconds: summary.timeSeconds,
      elo: this.reto333EloLocal,
      completed: summary.completed,
      best_score: record.bestScore,
    });
  }

  closeReto333Modal() {
    this.showReto333DaisyModal = false;
    this.cleanupResources();
    this.router.navigate(['/home']);
  }

  async restartReto333() {
    this.showReto333DaisyModal = false;
    this.cleanupResources();
    
    const loader = await this.loadingController.create({
      message: this.translocoService.translate('RETO_333.loading'),
    });
    await loader.present();

    try {
      const blocks: Block[] = await this.blockService.generateBlocksForPlan('reto333');
      const puzzles = await this.blockService.getPuzzlesForBlock(blocks[0]);
      blocks[0].puzzles = puzzles;

      await this.planService.newPlan(blocks, 'reto333');
      await loader.dismiss();
    } catch (error) {
      await loader.dismiss();
      console.error('Error al reiniciar el reto 333:', error);
      this.router.navigate(['/home']);
    }
  }

  activateStreamSolution() {
    this.isSolutionOpen = true;
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }
    this.streamSolutionActive = true;
  }

  onStreamSolutionFinished() {
    this.isSolutionOpen = false;
    this.streamSolutionActive = false;

    // Si el bloque se quedó sin tiempo mientras se veía la solución, ahora toca
    // cambiar de bloque en vez de pedir otro ejercicio.
    if (this.blockTimeExpired) {
      this.playNextBlock();
      return;
    }

    this.forceStopTimerInPuzzleBoard = false;
    this.selectPuzzleToPlay();
    if (this.plan.blocks[this.currentIndexBlock]?.time !== -1) {
      this.resumeBlockTimer();
    }
  }

  async showSolution() {
    // Se marca antes de cualquier espera: mientras el modal se crea y aparece
    // el cronómetro del bloque puede vencer, y necesita saber que hay una
    // solución en curso para no abrir la presentación del bloque encima.
    this.isSolutionOpen = true;
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    // Calcular temas traducidos
    const themesTranslated = this.puzzleToPlay.themes.map((theme) =>
      this.appService.getNameThemePuzzleByValue(theme)
    );

    const modal = await this.modalController.create({
      component: BoardPuzzleSolutionComponent,
      cssClass: 'puzzle-solution-modal',
      componentProps: {
        puzzle: this.puzzleToPlay,
        themesTranslated,
      },
    });

    await modal.present();

    modal.onDidDismiss().then(() => {
      this.isSolutionOpen = false;

      // El tiempo del bloque se acabó mientras se veía la solución: primero la
      // solución, y ahora sí el cambio de bloque.
      if (this.blockTimeExpired) {
        this.playNextBlock();
        return;
      }

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
    if (
      this.plan.planType !== 'custom' &&
      this.profileService.getProfile?.elos
    ) {
      const eloKey = `${this.plan.planType}Total` as keyof NonNullable<
        typeof this.profileService.getProfile.elos
      >;
      const eloValue = this.profileService.getProfile.elos[eloKey];
      this.plan = {
        ...this.plan,
        eloTotal: typeof eloValue === 'number' ? eloValue : undefined,
      };
    }

    if (this.profileService.getProfile?.uid) {
      this.plan = {
        ...this.plan,
        uidUser: this.profileService.getProfile?.uid,
      };
      // this.planService.requestSavePlanAction(this.plan);
    }

    // Actualizar el plan en Redux
    this.planFacade.updatePlan(this.plan);

    // Guardar el plan en localStorage
    this.planStorageService.savePlan(this.plan);

    // Registrar la hora de la sesión y reprogramar el recordatorio
    this.trainingReminderService.onSessionCompleted(this.plan);

    // Incrementar contador de veces jugado para planes custom
    if (
      this.plan.planType === 'custom' &&
      this.plan.uidCustomPlan &&
      this.profileService.getProfile?.uid
    ) {
      this.plansElosService
        .incrementPlayCount(
          this.plan.uidCustomPlan,
          this.profileService.getProfile.uid
        )
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
    this.blockTimeExpired = false;
    this.isSolutionOpen = false;
    this.currentIndexBlock = -1;
    this.timeLeftBlock = 0;
    this.countPuzzlesPlayedBlock = 0;
    this.totalPuzzlesInBlock = 0;
    this.eloChanges = [];
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
    this.blockTimeExpired = false;
    this.isSolutionOpen = false;

    // Resetear variables del componente
    this.currentIndexBlock = -1;
    this.timeLeftBlock = 0;
    this.countPuzzlesPlayedBlock = 0;
    this.totalPuzzlesInBlock = 0;
    this.eloChanges = [];

    // Reto 333 cleanup
    this.reto333StartTime = null;
    this.reto333EloLocal = RETO333_START_ELO;
    this.showReto333DaisyModal = false;
    this.reto333AlertData = null;

    // Resetear flag de inicialización para permitir reinicialización
    this.isInitialized = false;

    // Limpiar el estado del plan en Redux
    this.planFacade.clearPlan();
  }

  async onExitTraining() {
    const alert = await this.alertController.create({
      header:
        this.translocoService.translate('PUZZLES.exitTraining.title') ||
        'Salir del entrenamiento',
      message:
        this.translocoService.translate('PUZZLES.exitTraining.message') ||
        '¿Estás seguro de que deseas salir del entrenamiento?',
      buttons: [
        {
          text:
            this.translocoService.translate('PUZZLES.exitTraining.cancel') ||
            'Cancelar',
          role: 'cancel',
        },
        {
          text:
            this.translocoService.translate('PUZZLES.exitTraining.confirm') ||
            'Salir',
          role: 'confirm',
          handler: () => {
            // Cuando se cancela, sí se debe limpiar el plan
            this.cleanupResources();
            void this.router.navigateByUrl(this.returnUrl);
          },
        },
      ],
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

    this.stopBlockTimer();

    // Limpiar flags
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
  }
}
