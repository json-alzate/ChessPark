import { ChangeDetectorRef, Component, inject, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ViewWillEnter, ViewWillLeave } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { arrowBackOutline, pause, play, playSkipForward, refreshOutline } from 'ionicons/icons';

import { PackLabMapComponent } from '../../components/pack-lab-map/pack-lab-map.component';
import { PackSpriteComponent } from '../../components/pack-sprite/pack-sprite.component';
import { PackCharacter, RunnerBackdropSprite } from '../../models/pack.model';
import { PackAssets, PackAssetsService } from '../../services/pack-assets.service';
import {
  LAB_JUMP_HEIGHT,
  LAB_JUMP_MS,
  LabImage,
  labImages,
  LabPose,
  poseAt,
  racePose,
  rulerTicks,
  stepMs,
} from '../../utils/pack-lab.util';

/** Un personaje listo para pintar: su tira, su cuadro y cuánto se levanta (px de pantalla). */
export interface LabFigure {
  character: PackCharacter;
  pose: LabPose;
  src: string;
  frames: number;
  lift: number;
}

/** Velocidades de reproducción y zooms (enteros, siempre). */
export const LAB_SPEEDS = [0.25, 0.5, 1, 2] as const;
export const LAB_ZOOMS = [1, 2, 3, 4] as const;
/** Alto del suelo del runner (la tira `scene-floor`) y dónde apoyan los pies dentro de él (como en `scenery.ts`). */
const FLOOR_H = 20;
const FEET_IN_FLOOR = 8;
/** Lo que avanza el suelo en la carrerita (px lógicos por segundo) y cada cuánto saltan solos. */
const RACE_SPEED = 90;
const AUTO_JUMP_EVERY_MS = 2200;
/** Cada cuánto se repinta como mucho (ms): las tiras van a 12 fps como mucho. */
const RENDER_EVERY_MS = 33;

/**
 * Laboratorio de la manada (`/chess-runner/laboratorio`, sin enlace en ningún menú): una pantalla de prueba para revisar los
 * assets de la manada (`pack.json`) y del mapa (`map.json`). No tiene listas fijas: pinta los personajes, animaciones y zonas
 * que traigan los manifiestos, y lo que aún no exista lo muestra como un estado vacío. No guarda nada.
 */
@Component({
  selector: 'app-pack-lab',
  standalone: true,
  imports: [IonContent, IonIcon, TranslocoPipe, PackSpriteComponent, PackLabMapComponent],
  templateUrl: './pack-lab.page.html',
  styleUrls: ['./pack-lab.page.scss'],
})
export class PackLabPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  private readonly assetsService = inject(PackAssetsService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly speeds = LAB_SPEEDS;
  readonly zooms = LAB_ZOOMS;
  readonly jumpHeight = LAB_JUMP_HEIGHT;

  loading = true;
  assets: PackAssets | null = null;
  selected = new Set<string>();
  anim = 'run';
  paused = false;
  speed = 1;
  zoom = 2;
  /** `none`, `runner` o `zone:<id>`. */
  background = 'runner';
  autoJump = false;
  /** PNG de los manifiestos que no cargan (`carpeta/archivo`), para avisar «falta X». */
  broken = new Set<string>();
  /** Alto visible medido del primer cuadro de `run` de cada personaje (por `id`); el que no se pudo medir no está. */
  visible = new Map<string, number>();
  /** Para descartar la comprobación de imágenes de una carga anterior si se recarga antes de que termine. */
  private loadToken = 0;

  /** Relojes: el de las animaciones (se pausa y cambia de velocidad), el de la carrerita y el del mapa (siempre corre). */
  animMs = 0;
  raceMs = 0;
  mapMs = 0;
  /** `raceMs` en el que empezó el último salto de la carrerita. */
  private jumpAt: number | null = null;

  private frameRequest: number | null = null;
  private lastTime: number | null = null;
  private lastRender = 0;

  constructor() {
    addIcons({ arrowBackOutline, pause, play, playSkipForward, refreshOutline });
  }

  ngOnInit(): void {
    void this.reload(false);
  }

  ionViewWillEnter(): void {
    this.start();
  }

  ionViewWillLeave(): void {
    this.stop();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  /** Vuelve a leer los manifiestos (con `fresh`, saltándose la caché: los exportadores los reescriben mientras se revisan). */
  async reload(fresh = true): Promise<void> {
    this.loading = true;
    const token = ++this.loadToken;
    const assets = await this.assetsService.load({ fresh });
    const ids = assets.characters.map((c) => c.id);
    // La primera vez (o si estaban todos) se eligen todos, también los que acaban de llegar; si no, se respeta la elección
    const kept = [...this.selected].filter((id) => ids.includes(id));
    this.selected = new Set(!this.assets || this.allSelected || !kept.length ? ids : kept);
    if (this.background.startsWith('zone:') && !this.zoneBackgrounds(assets).some((z) => `zone:${z.id}` === this.background)) {
      this.background = 'runner';
    }
    this.assets = assets;
    this.loading = false;
    this.cdr.markForCheck();
    void this.checkImages(assets, token);
    void this.measureVisible(assets, token);
  }

  /** Mide el alto visible del primer cuadro de `run` de cada personaje (sin frenar la pantalla; en jsdom no hay canvas). */
  private async measureVisible(assets: PackAssets, token: number): Promise<void> {
    const heights = await Promise.all(
      assets.characters.map((c) => {
        const run = c.animations['run'];
        return run ? this.assetsService.visibleHeight(this.packUrl(run.file), c.cellW, c.cellH) : Promise.resolve(null);
      }),
    );
    if (token !== this.loadToken) return;
    const visible = new Map<string, number>();
    assets.characters.forEach((c, i) => {
      const height = heights[i];
      if (height !== null) visible.set(c.id, height);
    });
    this.visible = visible;
    this.cdr.markForCheck();
  }

  /** Comprueba que carguen todos los PNG de los manifiestos y guarda los que no (sin frenar la pantalla). */
  private async checkImages(assets: PackAssets, token: number): Promise<void> {
    const images = labImages(assets);
    const urls = images.map((image) => this.imageUrl(image));
    const failed = new Set(await this.assetsService.brokenImages(urls));
    if (token !== this.loadToken) return;
    this.broken = new Set(images.filter((_, i) => failed.has(urls[i])).map((image) => `${image.folder}/${image.file}`));
    this.cdr.markForCheck();
  }

  /** Los archivos que no cargan, para el aviso general. */
  get brokenFiles(): string[] {
    return [...this.broken].map((key) => key.slice(key.indexOf('/') + 1));
  }

  /** Los archivos de un personaje (tiras y retrato) que no cargan. */
  brokenOf(character: PackCharacter): string[] {
    const files = [character.portrait, ...character.animationNames.map((name) => character.animations[name]?.file)];
    return files.filter((file): file is string => !!file && this.broken.has(`pack/${file}`));
  }

  back(): void {
    void this.router.navigate(['/chess-runner']);
  }

  // --- Personajes -------------------------------------------------------------------------------------------------------

  get characters(): PackCharacter[] {
    return this.assets?.characters ?? [];
  }

  get chosen(): PackCharacter[] {
    return this.characters.filter((c) => this.selected.has(c.id));
  }

  get allSelected(): boolean {
    return this.characters.length > 0 && this.chosen.length === this.characters.length;
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected = next;
  }

  /** «Todos»: los elige a todos; si ya estaban todos, los quita. */
  selectAll(): void {
    this.selected = this.allSelected ? new Set() : new Set(this.characters.map((c) => c.id));
  }

  portraitUrl(character: PackCharacter): string | null {
    return character.portrait ? this.packUrl(character.portrait) : null;
  }

  /**
   * Alto de celda = `cellH − 1`, el de la tabla de docs/personajes/ASSETS_SPEC.md: lo más alto que llega un cuadro con los
   * pies en el suelo o el lienzo entero del salto, sin el píxel de holgura. No es el alto de pie (no viene en `pack.json`).
   */
  cellHeight(character: PackCharacter): number {
    return character.cellH - 1;
  }

  /** Alto visible del primer cuadro de `run` medido en el PNG (filas con algo opaco), o `null` si aún no se pudo medir. */
  visibleHeight(character: PackCharacter): number | null {
    return this.visible.get(character.id) ?? null;
  }

  // --- Reproducción -----------------------------------------------------------------------------------------------------

  /** Las animaciones que tiene alguno de los elegidos (o de todos si no hay ninguno), y el Recorrido al final. */
  get animOptions(): string[] {
    const pool = this.chosen.length ? this.chosen : this.characters;
    const names: string[] = [];
    for (const c of pool) for (const name of c.animationNames) if (!names.includes(name)) names.push(name);
    return names.length ? [...names, 'tour'] : [];
  }

  setAnim(anim: string): void {
    this.anim = anim;
    this.animMs = 0;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  /** Paso a paso: pausa y avanza justo al siguiente cuadro de la animación elegida. */
  step(): void {
    this.paused = true;
    const reference = this.chosen[0] ?? this.characters[0];
    const ms = reference ? stepMs(this.anim, reference.animations, this.animMs) : 100;
    const next = (Math.floor(this.animMs / ms + 1e-6) + 1) * ms + 0.01;
    this.raceMs += next - this.animMs;
    this.animMs = next;
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(1, Math.min(4, Math.round(zoom)));
  }

  /** Lo que se pinta de cada elegido en la animación actual. */
  get figures(): LabFigure[] {
    return this.chosen.map((c) => this.figure(c, poseAt(this.anim, c.animations, this.animMs)));
  }

  /** La carrerita: todos corren y saltan a la vez. */
  get racers(): LabFigure[] {
    const jumpMs = this.jumpAt === null ? null : this.raceMs - this.jumpAt;
    return this.chosen.map((c) => this.figure(c, racePose(c.animations, this.raceMs, jumpMs)));
  }

  jump(): void {
    const jumping = this.jumpAt !== null && this.raceMs - this.jumpAt < LAB_JUMP_MS;
    if (!jumping) this.jumpAt = this.raceMs;
  }

  toggleAutoJump(): void {
    this.autoJump = !this.autoJump;
  }

  private figure(character: PackCharacter, pose: LabPose): LabFigure {
    const strip = pose.anim ? character.animations[pose.anim] : null;
    return {
      character,
      pose,
      src: strip ? this.packUrl(strip.file) : '',
      frames: strip?.frames ?? 1,
      lift: pose.lift * this.zoom,
    };
  }

  // --- Escenario --------------------------------------------------------------------------------------------------------

  /** Alto del personaje más alto de los elegidos (px lógicos). */
  get tallest(): number {
    return this.chosen.reduce((max, c) => Math.max(max, c.cellH), 0);
  }

  get ticks(): number[] {
    // A 1× las marcas de 10 px quedan demasiado juntas para leer su número: se marca cada 20
    const step = this.zoom > 1 ? 10 : 20;
    return rulerTicks(Math.ceil(Math.max(this.tallest, step) / step) * step, step);
  }

  /** Dónde apoyan los pies, desde abajo del escenario (px de pantalla). */
  get feetY(): number {
    return (FLOOR_H - FEET_IN_FLOOR) * this.zoom;
  }

  /** Alto del escenario: el más alto, lo que sube un salto, el suelo y un poco de aire. */
  get stageHeight(): number {
    return (Math.max(this.tallest, 20) + LAB_JUMP_HEIGHT + FLOOR_H - FEET_IN_FLOOR + 10) * this.zoom;
  }

  /** Ancho de una fila de elegidos: margen izquierdo (px), sus celdas y `gap` px lógicos entre ellos, con aire a la derecha. */
  rowWidth(left: number, gap: number): number {
    const cells = this.chosen.reduce((sum, c) => sum + c.cellW * this.zoom, 0);
    return left + cells + Math.max(0, this.chosen.length - 1) * gap * this.zoom + 24;
  }

  zoneBackgrounds(assets: PackAssets | null = this.assets): Array<{ id: string; file: string; frameW: number; frameH: number }> {
    if (!assets) return [];
    return assets.map.zones.flatMap((z) => {
      const scene = z.scene ? assets.map.sprites[z.scene] : undefined;
      return scene ? [{ id: z.id, file: scene.file, frameW: scene.frameW, frameH: scene.frameH }] : [];
    });
  }

  setBackground(background: string): void {
    this.background = background;
  }

  /** El fondo CSS del escenario; en la carrerita (`scroll`) el suelo y las colinas avanzan con el reloj. */
  backgroundStyle(scroll: boolean): string | null {
    const z = this.zoom;
    if (this.background === 'runner' && this.assets) {
      const { backdrop } = this.assets;
      const run = scroll ? this.raceMs / 1000 * RACE_SPEED : 0;
      const layers: string[] = [];
      const layer = (sprite: RunnerBackdropSprite | undefined, css: (s: RunnerBackdropSprite, url: string) => string) => {
        if (sprite) layers.push(css(sprite, this.runnerUrl(sprite.file)));
      };
      layer(backdrop['scene-floor'], (s, url) =>
        `url("${url}") ${-Math.round(run % s.frameW) * z}px 100% / ${s.frameW * z}px ${s.frameH * z}px repeat-x`);
      layer(backdrop['scene-hills'], (s, url) =>
        `url("${url}") ${-Math.round((run * 0.25) % s.frameW) * z}px calc(100% - ${(FLOOR_H - 6) * z}px) / ${s.frameW * z}px ${s.frameH * z}px repeat-x`);
      layer(backdrop['scene-sky'], (s, url) => `url("${url}") 0 0 / ${s.frameW * z}px 100% repeat-x`);
      return layers.length ? layers.join(', ') : null;
    }
    if (this.background.startsWith('zone:')) {
      const scene = this.zoneBackgrounds().find((s) => `zone:${s.id}` === this.background);
      if (scene) {
        return `url("${this.mapUrl(scene.file)}") center 100% / ${scene.frameW * z}px ${scene.frameH * z}px repeat-x`;
      }
    }
    return null;
  }

  // --- Reloj ------------------------------------------------------------------------------------------------------------

  /** Avanza los relojes `dt` ms (lo llama el bucle de `requestAnimationFrame`; las pruebas lo llaman a mano). */
  advance(dt: number): void {
    const delta = Math.max(0, Math.min(dt, 250));
    this.mapMs += delta;
    if (this.paused) return;
    this.animMs += delta * this.speed;
    this.raceMs += delta * this.speed;
    if (this.autoJump && (this.jumpAt === null || this.raceMs - this.jumpAt >= AUTO_JUMP_EVERY_MS)) {
      this.jumpAt = this.raceMs;
    }
  }

  private start(): void {
    if (this.frameRequest !== null || typeof requestAnimationFrame !== 'function') return;
    this.lastTime = null;
    this.zone.runOutsideAngular(() => {
      const loop = (time: number) => {
        if (this.lastTime !== null) this.advance(time - this.lastTime);
        this.lastTime = time;
        if (time - this.lastRender >= RENDER_EVERY_MS) {
          this.lastRender = time;
          this.cdr.detectChanges();
        }
        this.frameRequest = requestAnimationFrame(loop);
      };
      this.frameRequest = requestAnimationFrame(loop);
    });
  }

  private stop(): void {
    if (this.frameRequest !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameRequest);
    this.frameRequest = null;
  }

  // --- URLs -------------------------------------------------------------------------------------------------------------

  private get version(): string {
    return this.assets?.version ?? '';
  }

  packUrl(file: string): string {
    return PackAssetsService.url(PackAssetsService.PACK_BASE, file, this.version);
  }

  readonly mapUrl = (file: string): string => PackAssetsService.url(PackAssetsService.MAP_BASE, file, this.version);

  private runnerUrl(file: string): string {
    return PackAssetsService.url(PackAssetsService.RUNNER_BASE, file, this.version);
  }

  private imageUrl(image: LabImage): string {
    const base = { pack: PackAssetsService.PACK_BASE, map: PackAssetsService.MAP_BASE, runner: PackAssetsService.RUNNER_BASE };
    return PackAssetsService.url(base[image.folder], image.file, this.version);
  }
}
