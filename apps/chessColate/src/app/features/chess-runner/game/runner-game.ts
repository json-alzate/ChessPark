import { CampaignEvent, CampaignStep, RunnerCampaign } from '../campaign/runner-campaign.model';
import { activeDayStreak, applyResult, currentStep, dayKey, depthOf, hasSeen, markSeen, startingRating, touchDay } from '../campaign/runner-campaign.util';
import { CATALOG_MAX_ELO, CATALOG_MIN_ELO, RunnerWorld, worldOfChapter } from '../campaign/runner-curriculum';
import { modifiersFor, RunnerModifiers } from '../config/runner-powers';
import { DOG_SKINS, isSkinId, skinById } from '../rendering/dog-skins';
import { RunnerRecordService } from '../services/runner-record.service';
import { RunnerSession, SessionRules } from './runner-session';

/** El ELO que se pide al catálogo, siempre dentro de lo que tiene. */
const clampElo = (elo: number): number => Math.min(Math.max(elo, CATALOG_MIN_ELO), CATALOG_MAX_ELO);

/**
 * Todo lo que el Chess Runner lleva de un jugador: la **campaña** (el capítulo, lo que domina de cada patrón, sus poderes), la
 * **partida** en curso (corazones, fallos, metros, galletas) y el **récord**. La pantalla solo decide qué se ve y cuándo;
 * aquí está qué cambia con cada ejercicio, cada poder ganado y cada carrera. Sin Angular: recibe el servicio que guarda.
 */
export class RunnerGame {
  campaign: RunnerCampaign;
  session: RunnerSession;
  mods: RunnerModifiers;
  /** El mejor récord guardado, en metros. */
  record: number;
  /** El ELO del perrito al empezar la partida: con él se cuenta lo ganado en ella. */
  ratingAtStart = 0;

  constructor(private readonly store: RunnerRecordService) {
    this.campaign = store.loadCampaign();
    this.mods = modifiersFor(this.campaign.powers);
    this.session = new RunnerSession(this.rules());
    this.record = store.best();
  }

  /** Las reglas de la partida con los poderes que lleva el perrito. */
  private rules(): SessionRules {
    return {
      maxHearts: this.mods.maxHearts,
      cookiesPerHeart: this.mods.cookiesPerHeart,
      solveHeal: this.mods.solveHeal,
    };
  }

  // ------------------------------------------------------------------ al entrar y al empezar

  /**
   * Al abrir la pantalla: se lee de nuevo lo guardado (es lo que manda) y empieza una partida. La primera vez, el perrito
   * parte de un ELO algo por debajo del del usuario.
   */
  enter(userElo: number): void {
    this.campaign = this.store.loadCampaign();
    if (this.campaign.rating <= 0) {
      const rating = startingRating(userElo);
      this.campaign = { ...this.campaign, rating, peakRating: rating };
      this.store.saveCampaign(this.campaign);
    }
    this.newMatch();
  }

  /** Una partida nueva: corazones, fallos y distancia a cero. La campaña y el récord, no. */
  newMatch(): void {
    this.mods = modifiersFor(this.campaign.powers);
    this.session = new RunnerSession(this.rules());
    this.record = this.store.best();
    this.ratingAtStart = this.campaign.rating;
  }

  // ----------------------------------------------------------------------------- la campaña

  /** Qué toca jugar ahora. */
  get step(): CampaignStep {
    return currentStep(this.campaign);
  }

  /** El nivel de la carrera: los capítulos vencidos, de todas las rondas, más uno. Con él suben la velocidad y el ritmo. */
  get level(): number {
    return depthOf(this.campaign) + 1;
  }

  /** El ELO del perrito. */
  get rating(): number {
    return this.campaign.rating;
  }

  /** Lo que ha subido (o bajado) el ELO en esta partida. */
  get ratingGain(): number {
    return this.campaign.rating - this.ratingAtStart;
  }

  /** El ELO que se pide al catálogo para el ejercicio de este paso. */
  get targetRating(): number {
    return clampElo(this.campaign.rating + this.step.eloOffset);
  }

  get world(): RunnerWorld {
    return worldOfChapter(this.campaign.chapter);
  }

  /** Qué tocaría (y con qué ELO) tras un resultado hipotético: sirve para descargar por adelantado el ejercicio siguiente. */
  after(solved: boolean, puzzleRating?: number): { step: CampaignStep; elo: number } {
    const { campaign } = applyResult(this.campaign, solved, puzzleRating);
    const step = currentStep(campaign);
    return { step, elo: clampElo(campaign.rating + step.eloOffset) };
  }

  hasSeen(key: string): boolean {
    return hasSeen(this.campaign, key);
  }

  /** Apunta que se ha visto algo (la historia, una lección, un aviso) y lo guarda. */
  see(...keys: string[]): void {
    for (const key of keys) {
      this.campaign = markSeen(this.campaign, key);
    }
    this.store.saveCampaign(this.campaign);
  }

  // ------------------------------------------------------------------- cada ejercicio

  /**
   * Un ejercicio resuelto (de ELO `puzzleRating`): cura, avanza el bloque, sube el ELO y, si cierra un capítulo, gana su
   * poder. Devuelve lo que ocurrió.
   */
  recordSolved(puzzleRating?: number): CampaignEvent[] {
    this.session.recordSolved();
    const events = this.advance(true, puzzleRating);
    // Resolver un ejercicio cuenta como jugar hoy
    const today = touchDay(this.campaign, this.today());
    if (today.changed) {
      this.campaign = today.campaign;
      this.store.saveCampaign(this.campaign);
    }
    return events;
  }

  /** El día de hoy (se puede cambiar en las pruebas). */
  today: () => string = () => dayKey();

  /** Días seguidos jugando que siguen vivos hoy. */
  get dayStreak(): number {
    return activeDayStreak(this.campaign, this.today());
  }

  /** Un ejercicio fallado (o sin tiempo): cuenta un fallo y baja el ELO. Devuelve lo que ocurrió. */
  recordFailed(puzzleRating?: number): CampaignEvent[] {
    this.session.recordFailed();
    return this.advance(false, puzzleRating);
  }

  private advance(solved: boolean, puzzleRating?: number): CampaignEvent[] {
    const { campaign, events } = applyResult(this.campaign, solved, puzzleRating);
    this.campaign = campaign;
    this.store.saveCampaign(campaign);
    if (events.some((event) => event.kind === 'chapterComplete')) {
      this.gainPower();
    }
    return events;
  }

  /** Un poder nuevo cambia las reglas de la partida en curso; un corazón de más llega ya lleno. */
  private gainPower(): void {
    const before = this.mods.maxHearts;
    this.mods = modifiersFor(this.campaign.powers);
    this.session.rules = this.rules();
    if (this.mods.maxHearts > before) {
      this.session.hearts += this.mods.maxHearts - before;
    }
  }

  // ------------------------------------------------------------------ distancia y récord

  /** Lo corrido en una carrera pasa a la cuenta de la partida (y puede ser récord). */
  bank(meters: number): void {
    this.session.meters += meters;
    this.saveRecord(this.session.meters);
  }

  /** Guarda `meters` si supera el récord. Devuelve `true` si lo es. */
  saveRecord(meters: number): boolean {
    const isNew = this.store.save(meters);
    this.record = this.store.best();
    return isNew;
  }

  // ------------------------------------------------------------------------ galletas y pelajes

  /** Las galletas que se tienen guardadas. */
  get wallet(): number {
    return this.campaign.cookies;
  }

  /** El pelaje que lleva el perrito. */
  get skin(): string {
    return this.campaign.skin;
  }

  /** Guarda las galletas que se acaban de coger. */
  earn(count: number): void {
    if (count <= 0) {
      return;
    }
    this.campaign = { ...this.campaign, cookies: this.campaign.cookies + count };
    this.store.saveCampaign(this.campaign);
  }

  /** ¿Se puede comprar este pelaje? Existe, no se tiene y alcanzan las galletas. */
  canBuy(id: string): boolean {
    return isSkinId(id) && !this.campaign.skins.includes(id) && this.campaign.cookies >= skinById(id).price;
  }

  /** Compra un pelaje y se lo pone. Devuelve `false` si no se pudo. */
  buy(id: string): boolean {
    if (!this.canBuy(id)) {
      return false;
    }
    this.campaign = {
      ...this.campaign,
      cookies: this.campaign.cookies - skinById(id).price,
      skins: [...this.campaign.skins, id],
      skin: id,
    };
    this.store.saveCampaign(this.campaign);
    return true;
  }

  /** Se pone un pelaje que ya se tiene. Devuelve `false` si no lo tiene. */
  select(id: string): boolean {
    if (!isSkinId(id) || !this.campaign.skins.includes(id)) {
      return false;
    }
    this.campaign = { ...this.campaign, skin: id };
    this.store.saveCampaign(this.campaign);
    return true;
  }

  /** Los pelajes con su estado: puesto, desbloqueado, o por comprar (con si alcanzan las galletas). */
  get wardrobe(): { id: string; price: number; swatch: string; state: 'worn' | 'owned' | 'affordable' | 'locked' }[] {
    return DOG_SKINS.map((skin) => ({
      id: skin.id,
      price: skin.price,
      swatch: skin.swatch,
      state: this.campaign.skin === skin.id ? 'worn' : this.campaign.skins.includes(skin.id) ? 'owned' : this.campaign.cookies >= skin.price ? 'affordable' : 'locked',
    }));
  }
}
