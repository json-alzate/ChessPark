import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Subject } from 'rxjs';
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
import { PlanFacadeService } from '@chesspark/state';
import { PlansElosService } from '@services/plans/plans-elos.service';
import { PlanStorageService } from '@services/plans/plan-storage.service';
import { PlanService } from '@services/plans/plan.service';
import { AnalyticsService } from '@services/analytics/analytics.service';
import { TrainingReminderService } from '@services/training/training-reminder.service';
import { Reto333StorageService } from '@services/training/reto333-storage.service';
import {
  TrainingSessionNextStep,
  TrainingSessionService,
} from '@services/training/training-session.service';
import { TrainingTimerService } from '@services/training/training-timer.service';
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
import { Block, Plan, Puzzle } from '@chesspark/models';

import {
  BoardPuzzleComponent,
  BoardPuzzleSolutionComponent,
} from '@chesspark/board';
import { NavbarComponent } from '@shared/components/navbar/navbar.component';

import { BlockPresentationComponent } from '../../components/block-presentation/block-presentation.component';
import {
  BlockPresentationSources,
  buildBlockPresentation,
} from '@services/training/block-presentation.util';
import { resolvePlayerColor } from '@services/training/player-color.util';
import {
  puzzleCompletedPayload,
  puzzleStartedPayload,
  reto333FinishedPayload,
} from '@services/training/training-analytics.util';
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
  buildUserPuzzle,
  PuzzleResult,
} from '@services/training/user-puzzle.util';

/**
 * Orquestador de la pantalla de entrenamiento: decide qué mostrar y en qué
 * orden ocurre cada paso de la sesión.
 *
 * Reparto de responsabilidades:
 * - Flujo de sesión (`TrainingSessionService`, propio de esta pantalla): plan
 *   en curso, bloque actual, contadores del bloque y la decisión de si tras un
 *   ejercicio toca otro, el bloque siguiente o el fin del plan. Este componente
 *   ejecuta esa decisión y le da el único dato que no es suyo: si venció el
 *   tiempo del bloque.
 * - Cronómetro del bloque (`TrainingTimerService`, propio de esta pantalla):
 *   cuenta atrás en segundos y aviso de vencimiento. Aquí se decide qué hacer
 *   al vencer (esperar a que se cierre una solución o cambiar de bloque) y se
 *   gobierna el reloj del tablero con `forceStopTimerInPuzzleBoard`.
 * - Derivaciones puras de esta pantalla (en `services/training/`, sin Angular):
 *   textos e imagen con los que se presenta un bloque
 *   (`block-presentation.util`), parámetros de cada evento de analítica
 *   (`training-analytics.util`) y color del jugador desde el FEN
 *   (`player-color.util`).
 * - Dominio puro compartido (`services/`): elo inicial por tipo de rutina
 *   (`plan-initial-elo.util`), resumen y constantes del Reto 333
 *   (`reto333.util`) y registro de cada puzzle jugado (`user-puzzle.util`).
 * - Persistencia: la marca del Reto 333 vive en `Reto333StorageService`, el plan
 *   en `PlanStorageService` y el estado en `PlanFacadeService`. Este componente
 *   no toca `localStorage`.
 * - Efectos de otros servicios: elo del perfil (`ProfileService`), elo de rutinas
 *   personalizadas (`PlansElosService`), recordatorios, analítica y sonidos.
 *
 * Lo que conserva el componente es la coreografía: el orden de los efectos
 * tras cada resultado (registro, analítica, elo, sonido y decisión), cuándo se
 * abre cada modal (presentación del bloque, solución, resumen del Reto 333),
 * el acoplamiento con el tablero (`puzzleToPlay`, `forceStopTimerInPuzzleBoard`,
 * `streamSolutionActive`), la persistencia al cerrar la rutina y la navegación.
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
  // La sesión y el cronómetro se proveen aquí y no en root: cada pantalla
  // arranca con una sesión limpia y un reloj propio que mueren con ella, y dos
  // instancias de la pantalla (posible con `returnTo` bajo el outlet de Ionic)
  // no comparten índice, contadores ni cuenta atrás.
  providers: [TrainingSessionService, TrainingTimerService],
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
  /** Flujo de la sesión: plan, bloque actual, contadores y decisión tras cada ejercicio. */
  private session = inject(TrainingSessionService);
  /** Cuenta atrás del bloque: segundos restantes y aviso de vencimiento. */
  private blockTimer = inject(TrainingTimerService);

  /**
   * Catálogos y traductor con los que se deriva la presentación de un bloque.
   * La derivación es pura y no conoce `AppService` ni Transloco; este
   * adaptador es lo único que los une. Va después de las inyecciones porque
   * las usa al construirse.
   */
  private readonly presentationSources: BlockPresentationSources = {
    themeName: (theme) => this.appService.getNameThemePuzzleByValue(theme),
    themeDescription: (theme) =>
      this.appService.getDescriptionThemePuzzleByValue(theme),
    openingName: (opening) => this.appService.getNameOpeningByValue(opening),
    openingDescription: (opening) =>
      this.appService.getDescriptionOpeningByValue(opening),
    translate: (key) => this.translocoService.translate(key),
  };

  // Subject para gestionar suscripciones
  private destroy$ = new Subject<void>();
  private isInitialized = false;
  private isLoadingPlan = false;

  // Properties for Reto 333
  reto333StartTime: number | null = null;
  reto333EloLocal = RETO333_START_ELO;
  showReto333DaisyModal = false;
  reto333AlertData: any = null;

  showBlockTimer = false;

  /**
   * Estado de la sesión que la plantilla pinta y que la persistencia completa
   * (elo inicial, usuario, terminado) con copias nuevas del plan. Vive en
   * `TrainingSessionService`; aquí solo se delega. Los setters existen para
   * montar un estado concreto (pruebas); el flujo normal avanza por las
   * transiciones de la sesión.
   *
   * `plan` se tipa como `Plan` aunque sea `null` hasta que llega el primero:
   * la plantilla y `ngOnInit` ya contemplan ese hueco con `plan?.`.
   */
  get plan(): Plan {
    return this.session.plan as Plan;
  }

  set plan(plan: Plan) {
    this.session.plan = plan;
  }

  get currentIndexBlock(): number {
    return this.session.currentIndexBlock;
  }

  set currentIndexBlock(index: number) {
    this.session.currentIndexBlock = index;
  }

  get countPuzzlesPlayedBlock(): number {
    return this.session.countPuzzlesPlayedBlock;
  }

  set countPuzzlesPlayedBlock(count: number) {
    this.session.countPuzzlesPlayedBlock = count;
  }

  get totalPuzzlesInBlock(): number {
    return this.session.totalPuzzlesInBlock;
  }

  set totalPuzzlesInBlock(total: number) {
    this.session.totalPuzzlesInBlock = total;
  }

  /**
   * Hay un cambio de bloque a medias (presentación abierta). Mientras dure, un
   * resultado del tablero pertenece al bloque anterior y se descarta, y no se
   * arranca otro plan ni otro cambio encima.
   */
  private get isProcessingBlock(): boolean {
    return this.session.isChangingBlock;
  }

  puzzleToPlay!: Puzzle;

  /**
   * Segundos que quedan del bloque, tal y como los pinta la plantilla. Viven
   * en `TrainingTimerService`; aquí solo se delega. El setter existe para
   * montar un estado concreto (pruebas) y para dejarlos a cero al cerrar la
   * sesión; el flujo normal los mueve el reloj.
   */
  get timeLeftBlock(): number {
    return this.blockTimer.timeLeft;
  }

  set timeLeftBlock(seconds: number) {
    this.blockTimer.timeLeft = seconds;
  }

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
  forceStopTimerInPuzzleBoard = false;
  streamSolutionActive = false;

  isGoshHelperShow = false;
  isDropdownOpen = false;
  private closeDropdownTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Color con el que juega el usuario en el puzzle actual (blancas o negras) */
  get playerColor(): 'white' | 'black' {
    return resolvePlayerColor(
      this.session.currentBlock?.color,
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

    // El reloj solo avisa; qué hacer al vencer (esperar a que se cierre una
    // solución o cambiar de bloque) se decide aquí. Se escucha desde el
    // constructor y no desde ngOnInit porque el cronómetro puede arrancar sin
    // pasar por el arranque del store (reanudaciones, pruebas).
    this.blockTimer.timeUp$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onBlockTimeUp());
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

        // Plan nuevo: la sesión queda antes del primer bloque. Es una copia
        // para que las reasignaciones de cierre no toquen el objeto del store.
        this.session.start({ ...plan });

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

    // El bloque anterior queda cerrado: ningún contador suyo debe seguir vivo
    // ni volver a dispararse.
    this.stopBlockTimer();
    this.blockTimeExpired = false;

    // La sesión avanza de bloque (cuota y contador del nuevo) o avisa de que
    // ya no quedan bloques.
    if (this.session.advanceToNextBlock() === 'plan-finished') {
      this.endPlan();
      return;
    }

    this.showBlockTimer = false;

    if (this.plan.planType === 'infinity') {
      // Sin presentación: el bloque está listo en el acto.
      this.session.blockReady();
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
    const currentBlock = this.plan.blocks[this.currentIndexBlock];

    this.forceStopTimerInPuzzleBoard = true;
    if (currentBlock.time !== -1) {
      this.pauseBlockTimer();
    }

    this.totalPuzzlesInBlock = currentBlock.puzzlesCount;

    const modal = await this.modalController.create({
      component: BlockPresentationComponent,
      componentProps: buildBlockPresentation(
        currentBlock,
        this.presentationSources
      ),
    });

    await modal.present();

    modal.onDidDismiss().then(() => {
      // Con la presentación cerrada la sesión vuelve a aceptar resultados;
      // el tablero se libera antes de recibir el puzzle nuevo.
      this.session.blockReady();
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
    // Aquí también llegan los cierres de solución y de presentación, que no
    // pasan por continueAfterPuzzle: se vuelve a comprobar que quede bloque y
    // que su cuota no esté completa antes de servir nada.
    const currentBlock = this.session.currentBlock;
    if (!currentBlock) {
      this.endPlan();
      return;
    }
    if (this.session.isBlockQuotaReached) {
      this.playNextBlock();
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

    void this.analyticsService.logEvent(
      'puzzle_started',
      puzzleStartedPayload({
        planType: this.plan.planType,
        blockTheme: currentBlock.theme,
        puzzle,
      })
    );
  }

  /**
   * Arranca la cuenta atrás del bloque desde `timeBlock` segundos. El reloj
   * apaga antes cualquier cuenta atrás anterior, que es lo único que garantiza
   * que nunca haya dos restando a la vez sobre el mismo tiempo; el bloque
   * nuevo empieza sin vencimiento pendiente.
   */
  initTimeToEndBlock(timeBlock: number) {
    this.blockTimeExpired = false;
    this.blockTimer.start(timeBlock);
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
    // El reloj ya se apaga solo al vencer; se apaga también aquí para que un
    // vencimiento forzado desde fuera del reloj deje el mismo estado.
    this.stopBlockTimer();
    // El bloque terminó: el tablero deja de contar el tiempo del ejercicio.
    this.forceStopTimerInPuzzleBoard = true;

    if (this.isSolutionOpen) {
      return;
    }

    this.playNextBlock();
  }

  /** Congela el tiempo del bloque mientras hay una presentación o una solución en pantalla. */
  pauseBlockTimer() {
    this.blockTimer.pause();
  }

  /** Sigue desde el tiempo congelado; sin tiempo restante no arranca nada. */
  resumeBlockTimer() {
    this.blockTimer.resume();
  }

  /** Apaga el reloj del bloque conservando el tiempo restante. */
  stopBlockTimer() {
    this.blockTimer.stop();
  }

  onPuzzleCompleted(puzzleCompleted: Puzzle, puzzleStatus: PuzzleResult) {
    // El cambio de bloque ya está en marcha (se acabó su tiempo y se está
    // abriendo la presentación del siguiente): este resultado llegó tarde. Si
    // se registrara, iría a parar al bloque equivocado y además abriría una
    // solución encima de la presentación.
    if (this.isProcessingBlock) {
      return;
    }

    if (!this.session.currentBlock) {
      return;
    }

    const userPuzzle = buildUserPuzzle({
      puzzle: puzzleCompleted,
      result: puzzleStatus,
      uid: this.uidGenerator.generateSimpleUid(),
      uidUser: this.profileService.getProfile?.uid ?? '',
      currentEloUser: this.profileService.getProfile?.elo ?? 0,
      date: new Date().getTime(),
    });

    void this.analyticsService.logEvent(
      'puzzle_completed',
      puzzleCompletedPayload({
        planType: this.plan.planType,
        puzzle: puzzleCompleted,
        result: puzzleStatus,
        userElo: this.profileService.getProfile?.elo,
      })
    );

    // El registro va después de la analítica a propósito: el evento describe
    // el estado previo (plan sin este ejercicio, elo sin recalcular).
    this.session.registerPuzzleResult(userPuzzle);

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
   * solución vista). La sesión decide entre otro ejercicio, el bloque
   * siguiente o el fin del plan; aquí solo se le aporta si el tiempo del
   * bloque venció, para que el fin de tiempo nunca se cuele por su cuenta.
   */
  private continueAfterPuzzle() {
    this.follow(this.session.nextStepAfterPuzzle(this.blockTimeExpired));
  }

  /** Ejecuta la decisión de la sesión con el efecto que le corresponde. */
  private follow(step: TrainingSessionNextStep) {
    switch (step) {
      case 'plan-finished':
        this.endPlan();
        break;
      case 'next-block':
        this.playNextBlock();
        break;
      case 'next-puzzle':
        this.selectPuzzleToPlay();
        break;
    }
  }

  /**
   * Abre la solución del puzzle en curso y la devuelve ya presentada, para que
   * quien llama decida qué pasa al cerrarse. Los temas van traducidos porque
   * el modal del tablero vive en una librería sin acceso al catálogo.
   */
  private async openSolutionModal() {
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
    return modal;
  }

  async showSolutionAndAlertReto333() {
    this.isSolutionOpen = true;
    this.forceStopTimerInPuzzleBoard = true;
    if (this.plan.blocks[this.currentIndexBlock].time !== -1) {
      this.pauseBlockTimer();
    }

    const modal = await this.openSolutionModal();

    modal.onDidDismiss().then(() => {
      this.isSolutionOpen = false;
      this.forceStopTimerInPuzzleBoard = false;
      this.showReto333Alert();
    });
  }

  async showReto333Alert() {
    this.plan = { ...this.plan, isFinished: true };
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

    void this.analyticsService.logEvent(
      'reto333_finished',
      reto333FinishedPayload({
        summary,
        elo: this.reto333EloLocal,
        bestScore: record.bestScore,
      })
    );
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

    const modal = await this.openSolutionModal();

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
    this.plan = { ...this.plan, isFinished: true };
    this.stopBlockTimer();
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
    this.stopBlockTimer();
    this.forceStopTimerInPuzzleBoard = true;
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
    this.blockTimeExpired = false;
    this.isSolutionOpen = false;
    this.timeLeftBlock = 0;
    this.eloChanges = [];
    this.isInitialized = false;
    // La sesión vuelve a antes del primer bloque conservando el plan, que
    // plan-played sigue leyendo.
    this.session.reset();

    // Navegar a la pantalla de plan jugado
    this.router.navigate(['/puzzles/plan-played']);
  }

  private cleanupResources() {
    // Detener el cronómetro del bloque
    this.stopBlockTimer();

    // Cancelar el cierre diferido del dropdown, si lo hay
    if (this.closeDropdownTimeout) {
      clearTimeout(this.closeDropdownTimeout);
      this.closeDropdownTimeout = null;
    }

    // Limpiar flags
    this.forceStopTimerInPuzzleBoard = true;
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
    this.blockTimeExpired = false;
    this.isSolutionOpen = false;

    // Resetear variables del componente y la posición de la sesión (el plan
    // se conserva: así un null posterior del store no manda a inicio)
    this.session.reset();
    this.timeLeftBlock = 0;
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

  /**
   * Cierra el dropdown con una pequeña espera para que el clic que lo cierra
   * no se propague al elemento de debajo. El handle se guarda para poder
   * cancelarlo en cleanupResources: si la pantalla se destruye dentro de esos
   * 200 ms, el timeout no debe tocar un componente ya destruido.
   */
  closeDropdown() {
    if (this.closeDropdownTimeout) clearTimeout(this.closeDropdownTimeout);
    this.closeDropdownTimeout = setTimeout(() => {
      this.closeDropdownTimeout = null;
      this.isDropdownOpen = false;
    }, 200);
  }

  ionViewWillLeave() {
    // Asegurar limpieza completa al salir del componente
    this.forceStopTimerInPuzzleBoard = true;

    // Detener el cronómetro del bloque (el tiempo restante se conserva)
    this.stopBlockTimer();

    // Limpiar flags
    this.showBlockTimer = false;
    this.isGoshHelperShow = false;
    this.isDropdownOpen = false;
  }
}
