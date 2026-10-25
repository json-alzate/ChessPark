import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslocoPipe } from '@jsverse/transloco';
import { addIcons } from 'ionicons';
import { lockClosed } from 'ionicons/icons';

import { MAP_NODE_STATES, MapNodeState, MapPoint, MapSprite, MapZone, PackMap } from '../../models/pack.model';
import {
  fitScale,
  frameAt,
  markerAt,
  nodeSpriteName,
  paperStopSprite,
  paperVariants,
  pathDots,
  stopZoneId,
  trailCookie,
} from '../../utils/pack-lab.util';
import { PackSpriteComponent } from '../pack-sprite/pack-sprite.component';

/** Lo que se pinta de un punto: su sprite (o `null`, y entonces un círculo de respaldo) y su cuadro. */
interface ShownNode {
  point: MapPoint;
  sprite: MapSprite | null;
  frame: number;
}

/** Velocidad de los nodos que laten (`open`, `current`) y de la huella del papel. */
const PULSE_FPS = 2;

/**
 * El mapa del Laboratorio de la manada: una zona con sus puntos, sus animaciones de ambiente y el estado de los puntos; y el
 * mapa de papel con el rastro de galletas. Todo sale de `map.json` (ya normalizado): sin zonas, sin papel o sin un sprite,
 * muestra un estado vacío o un respaldo en vez de romperse. El reloj (`clock`, ms) y el zoom entero los da la página; si a ese
 * zoom el mapa no cabe a lo ancho (220 px lógicos ×2 = 440 en un móvil de 393), baja al mayor entero que quepa.
 */
@Component({
  selector: 'app-pack-lab-map',
  standalone: true,
  imports: [IonIcon, TranslocoPipe, PackSpriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- Mapa por zonas -->
    <section class="space-y-3" data-testid="lab-zones">
      <h3 class="text-xl font-semibold mb-2">{{ 'PACK_LAB.map.title' | transloco }}</h3>

      @if (!map.zones.length) {
      <div class="rounded-box border border-dashed border-base-content/20 bg-base-100 p-6 text-center" data-testid="lab-zones-empty">
        <p class="font-semibold">{{ 'PACK_LAB.map.empty' | transloco }}</p>
        <p class="text-sm text-base-content/60">{{ 'PACK_LAB.map.emptyHint' | transloco }}</p>
      </div>
      } @else {
      <div class="flex flex-wrap gap-1" role="group" [attr.aria-label]="'PACK_LAB.map.chooseZone' | transloco">
        @for (z of map.zones; track z.id) {
        <button type="button" class="btn btn-sm" data-testid="lab-zone"
          [class.btn-primary]="z.id === zone?.id" [class.btn-ghost]="z.id !== zone?.id"
          [attr.aria-pressed]="z.id === zone?.id" (click)="selectZone(z.id)">
          {{ z.id }}@if (!isOpen(z.id)) {<ion-icon name="lock-closed" aria-hidden="true"></ion-icon>}
        </button>
        }
      </div>

      @if (zone; as z) {
      <p class="text-sm text-base-content/70" data-testid="lab-zone-info">
        <span class="font-semibold">{{ z.name || ('PACK_LAB.map.zone' | transloco: { n: z.id }) }}</span>
        @if (z.boss) { · {{ 'PACK_LAB.map.boss' | transloco: { boss: z.boss } }} }
        · {{ 'PACK_LAB.map.info' | transloco: { points: z.points.length, ambient: z.ambient.length, darkness: z.darkness } }}
      </p>

      <div class="space-y-2">
        <h6 class="text-sm text-base-content/70">{{ 'PACK_LAB.map.nodeState' | transloco }}</h6>
        <div class="flex flex-wrap gap-1" role="group" [attr.aria-label]="'PACK_LAB.map.nodeState' | transloco">
          @for (s of states; track s) {
          <button type="button" class="btn btn-sm" data-testid="lab-node-state"
            [class.btn-primary]="s === nodeState" [class.btn-ghost]="s !== nodeState" [attr.aria-pressed]="s === nodeState"
            (click)="nodeState = s">
            {{ 'PACK_LAB.map.states.' + s | transloco }}
          </button>
          }
        </div>
        <div class="flex flex-wrap gap-4">
          <label class="label cursor-pointer gap-2">
            <input type="checkbox" class="toggle toggle-sm toggle-primary" [checked]="ambientOn"
              (change)="ambientOn = !ambientOn" data-testid="lab-ambient-toggle" />
            <span class="text-sm">{{ 'PACK_LAB.map.ambient' | transloco }} ({{ z.ambient.length }})</span>
          </label>
          <label class="label cursor-pointer gap-2">
            <input type="checkbox" class="toggle toggle-sm toggle-primary" [checked]="isOpen(z.id)"
              (change)="toggleZone(z.id)" data-testid="lab-zone-open" />
            <span class="text-sm">{{ 'PACK_LAB.map.open' | transloco }}</span>
          </label>
        </div>
      </div>

      <div class="overflow-x-auto rounded-box border border-base-content/10 bg-base-100">
        <div class="relative mx-auto" data-testid="lab-zone-stage"
          [style.width.px]="map.logical.zoneW * scale" [style.height.px]="map.logical.zoneH * scale"
          [style.filter]="isOpen(z.id) ? null : 'grayscale(1) brightness(0.55)'">
          @if (sceneOf(z); as scene) {
          <app-pack-sprite class="absolute left-0 top-0" [src]="url(scene.file)" [frameW]="scene.frameW" [frameH]="scene.frameH"
            [frames]="scene.frames" [zoom]="scale" data-testid="lab-zone-scene" />
          } @else {
          <div class="absolute inset-0 flex items-center justify-center bg-base-200/60 text-sm text-base-content/60">
            {{ 'PACK_LAB.map.noScene' | transloco }}
          </div>
          }
          @if (ambientOn) {
          @for (fx of z.ambient; track $index) {
          <app-pack-sprite class="absolute" data-testid="lab-ambient" [style.left.px]="fx.x * scale" [style.top.px]="fx.y * scale"
            [src]="url(fx.file)" [frameW]="fx.frameW" [frameH]="fx.frameH" [frames]="fx.frames"
            [frame]="frame(fx.fps, fx.frames)" [zoom]="scale" />
          }
          }
          @if (pathDot; as dot) {
          @for (d of dots; track $index) {
          <app-pack-sprite class="absolute" [style.left.px]="(d.x - dot.frameW / 2) * scale" [style.top.px]="(d.y - dot.frameH / 2) * scale"
            [src]="url(dot.file)" [frameW]="dot.frameW" [frameH]="dot.frameH" [frames]="dot.frames"
            [frame]="dotFrame" [zoom]="scale" />
          }
          }
          @for (n of nodes; track $index) {
          @if (n.sprite; as s) {
          <app-pack-sprite class="absolute" data-testid="lab-node" [attr.data-kind]="n.point.kind"
            [style.left.px]="(n.point.x - s.frameW / 2) * scale" [style.top.px]="(n.point.y - s.frameH / 2) * scale"
            [src]="url(s.file)" [frameW]="s.frameW" [frameH]="s.frameH" [frames]="s.frames" [frame]="n.frame" [zoom]="scale" />
          } @else {
          <div class="absolute flex items-center justify-center rounded-full border-2 border-base-content/60 bg-base-100/80 text-xs font-bold"
            data-testid="lab-node-fallback" [attr.data-kind]="n.point.kind"
            [style.left.px]="(n.point.x - 10) * scale" [style.top.px]="(n.point.y - 10) * scale"
            [style.width.px]="20 * scale" [style.height.px]="20 * scale">
            {{ n.point.kind.charAt(0).toUpperCase() }}{{ n.point.order }}
          </div>
          }
          }
        </div>
      </div>
      }
      }
    </section>

    <!-- Mapa de papel -->
    <section class="mt-6 space-y-3" data-testid="lab-paper">
      <h3 class="text-xl font-semibold mb-2">{{ 'PACK_LAB.paper.title' | transloco }}</h3>

      @if (!variants.length && !map.paper.trail.length && !map.paper.stops.length) {
      <div class="rounded-box border border-dashed border-base-content/20 bg-base-100 p-6 text-center" data-testid="lab-paper-empty">
        <p class="font-semibold">{{ 'PACK_LAB.paper.empty' | transloco }}</p>
        <p class="text-sm text-base-content/60">{{ 'PACK_LAB.map.emptyHint' | transloco }}</p>
      </div>
      } @else {
      @if (variants.length > 1) {
      <div class="join">
        @for (v of variants; track v) {
        <button type="button" class="btn btn-sm join-item" data-testid="lab-variant" [class.btn-primary]="v === variant"
          [attr.aria-pressed]="v === variant" (click)="variant = v">{{ v.replace('paper-map', '').replace('-', '') || '—' }}</button>
        }
      </div>
      }
      <label class="block space-y-1">
        <span class="text-sm text-base-content/70">
          {{ 'PACK_LAB.paper.progress' | transloco: { n: progress, total: map.paper.trail.length } }}
        </span>
        <input type="range" class="range range-primary range-sm" min="0" [max]="map.paper.trail.length" step="1"
          [value]="progress" (input)="setProgress($any($event.target).value)" [disabled]="!map.paper.trail.length"
          data-testid="lab-progress" />
      </label>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-soft btn-info" (click)="setAllZones(true)" data-testid="lab-open-all">{{ 'PACK_LAB.paper.openAll' | transloco }}</button>
        <button type="button" class="btn btn-sm btn-soft btn-info" (click)="setAllZones(false)" data-testid="lab-close-all">{{ 'PACK_LAB.paper.closeAll' | transloco }}</button>
      </div>
      @if (map.paper.stops.length) {
      <p class="text-sm text-base-content/60">{{ 'PACK_LAB.paper.stopHint' | transloco }}</p>
      }
      @if (map.paper.trail.length && map.sprites['cookie-gold']) {
      <p class="text-sm text-base-content/60" data-testid="lab-gold-hint">{{ 'PACK_LAB.paper.goldHint' | transloco }}</p>
      }

      <div class="overflow-x-auto rounded-box border border-base-content/10 bg-base-100">
        <div class="relative mx-auto" data-testid="lab-paper-stage"
          [style.width.px]="map.logical.paperW * scale" [style.height.px]="map.logical.paperH * scale">
          @if (paper; as p) {
          <app-pack-sprite class="absolute left-0 top-0" [src]="url(p.file)" [frameW]="p.frameW" [frameH]="p.frameH"
            [frames]="p.frames" [zoom]="scale" />
          } @else {
          <div class="absolute inset-0 bg-base-200/60"></div>
          }
          @for (c of cookies; track $index) {
          @if (c.sprite; as s) {
          <app-pack-sprite class="absolute" data-testid="lab-cookie" [attr.data-cookie]="c.name"
            [style.left.px]="(c.x - s.frameW / 2) * scale" [style.top.px]="(c.y - s.frameH / 2) * scale"
            [src]="url(s.file)" [frameW]="s.frameW" [frameH]="s.frameH" [frames]="s.frames" [zoom]="scale" />
          } @else {
          <div class="absolute rounded-sm" data-testid="lab-cookie" [attr.data-cookie]="c.filled ? 'filled' : 'empty'"
            [class]="c.filled ? 'bg-warning' : 'bg-base-content/20'"
            [style.left.px]="(c.x - 4) * scale" [style.top.px]="(c.y - 4) * scale" [style.width.px]="8 * scale" [style.height.px]="8 * scale"></div>
          }
          }
          @for (stop of map.paper.stops; track $index) {
          <button type="button" class="absolute p-0" data-testid="lab-stop" [attr.data-open]="isOpen(zoneIdOfStop($index))"
            [attr.aria-label]="('PACK_LAB.paper.stop' | transloco: { boss: stop.boss })"
            [style.left.px]="(stop.x - 10) * scale" [style.top.px]="(stop.y - 10) * scale"
            [style.width.px]="20 * scale" [style.height.px]="20 * scale" (click)="toggleZone(zoneIdOfStop($index))">
            @if (stopSprite(stop.boss, isOpen(zoneIdOfStop($index))); as s) {
            <app-pack-sprite [src]="url(s.file)" [frameW]="s.frameW" [frameH]="s.frameH" [frames]="s.frames" [zoom]="scale" />
            } @else {
            <span class="flex h-full w-full items-center justify-center rounded-full border-2 border-base-content/50 bg-base-100 text-xs font-bold">
              {{ isOpen(zoneIdOfStop($index)) ? stop.boss.charAt(0).toUpperCase() : '?' }}
            </span>
            }
          </button>
          }
          @if (marker; as m) {
          @if (markerSprite; as s) {
          <app-pack-sprite class="pointer-events-none absolute" data-testid="lab-marker"
            [style.left.px]="(m.x - s.frameW / 2) * scale" [style.top.px]="(m.y - s.frameH / 2) * scale"
            [src]="url(s.file)" [frameW]="s.frameW" [frameH]="s.frameH" [frames]="s.frames"
            [frame]="frame(pulseFps, s.frames)" [zoom]="scale" />
          } @else {
          <div class="pointer-events-none absolute rounded-full bg-primary" data-testid="lab-marker"
            [style.left.px]="(m.x - 5) * scale" [style.top.px]="(m.y - 5) * scale" [style.width.px]="10 * scale" [style.height.px]="10 * scale"></div>
          }
          }
        </div>
      </div>
      }
    </section>
  `,
})
export class PackLabMapComponent implements OnChanges, OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private resizeObserver: ResizeObserver | null = null;
  /** Fotograma pendiente de `requestAnimationFrame` con la próxima medida (`null` = ninguno). */
  private frameId: number | null = null;
  /** Ancho útil dentro del recuadro con borde (px CSS); 0 = aún sin medir, y entonces se usa el zoom pedido. */
  availableW = 0;

  @Input({ required: true }) map!: PackMap;
  /** Reloj en ms (lo lleva la página; sigue aunque se pausen los personajes). */
  @Input() clock = 0;
  @Input() zoom = 1;
  /** Cómo se forma la URL de un archivo de la carpeta del mapa (con versión al recargar). */
  @Input() urlOf: (file: string) => string = (file) => file;

  readonly states = MAP_NODE_STATES;
  readonly pulseFps = PULSE_FPS;

  zoneId: string | null = null;
  nodeState: MapNodeState = 'open';
  ambientOn = true;
  progress = 0;
  variant: string | null = null;
  /** Zonas cerradas (por defecto, todas abiertas). */
  private closed = new Set<string>();

  constructor() {
    addIcons({ lockClosed });
  }

  /** Reajusta zona, variante y progreso solo cuando llega otro mapa (no en cada tic de `clock`). */
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['map'] || !this.map) return;
    if (!this.map.zones.some((z) => z.id === this.zoneId)) this.zoneId = this.map.zones[0]?.id ?? null;
    if (!this.variant || !(this.variant in this.map.sprites)) this.variant = this.variants[0] ?? null;
    this.progress = Math.min(this.progress, this.map.paper.trail.length);
  }

  ngOnInit(): void {
    this.measure();
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frameId !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /**
   * Aplaza la medida un fotograma: si se repinta dentro del callback del `ResizeObserver`, el alto del host observado cambia en
   * ese mismo ciclo y el navegador lanza «ResizeObserver loop completed with undelivered notifications». Varias medidas seguidas
   * se juntan en un fotograma; sin `requestAnimationFrame` (jsdom, SSR) se mide al momento.
   */
  private scheduleMeasure(): void {
    if (typeof requestAnimationFrame === 'undefined') {
      this.measure();
      return;
    }
    if (this.frameId !== null) return;
    this.frameId = this.ngZone.runOutsideAngular(() =>
      requestAnimationFrame(() => {
        this.frameId = null;
        this.measure();
      }),
    );
  }

  /**
   * Mide el ancho del componente menos el borde de 1 px a cada lado de los recuadros del mapa (`floor` del ancho real, que puede
   * ser fraccionario: `clientWidth` lo redondea y podía sobrar medio píxel). Solo entra en la zona de Angular si cambió.
   */
  private measure(): void {
    const width = Math.max(0, Math.floor(this.host.nativeElement.getBoundingClientRect?.().width || 0) - 2);
    if (width === this.availableW) return;
    this.ngZone.run(() => {
      this.availableW = width;
      this.cdr.markForCheck();
    });
  }

  /** Zoom entero del mapa: el de la página, o menos si no cabe a lo ancho (zona y papel comparten escala). */
  get scale(): number {
    const logicalW = this.map ? Math.max(this.map.logical.zoneW, this.map.logical.paperW) : 0;
    return fitScale(this.zoom, logicalW, this.availableW);
  }

  get zone(): MapZone | null {
    return this.map?.zones.find((z) => z.id === this.zoneId) ?? null;
  }

  get variants(): string[] {
    return this.map ? paperVariants(this.map.sprites) : [];
  }

  get paper(): MapSprite | null {
    return (this.variant && this.map.sprites[this.variant]) || null;
  }

  url(file: string): string {
    return this.urlOf(file);
  }

  frame(fps: number, frames: number): number {
    return frameAt(this.clock, fps, frames);
  }

  selectZone(id: string): void {
    this.zoneId = id;
  }

  isOpen(id: string): boolean {
    return !this.closed.has(id);
  }

  toggleZone(id: string): void {
    if (this.closed.has(id)) this.closed.delete(id);
    else this.closed.add(id);
    this.closed = new Set(this.closed);
  }

  setAllZones(open: boolean): void {
    const ids = new Set([...this.map.zones.map((z) => z.id), ...this.map.paper.stops.map((_, i) => this.zoneIdOfStop(i))]);
    this.closed = open ? new Set() : ids;
  }

  setProgress(value: string | number): void {
    const n = Math.round(Number(value));
    this.progress = Math.max(0, Math.min(this.map.paper.trail.length, Number.isFinite(n) ? n : 0));
  }

  sceneOf(zone: MapZone): MapSprite | null {
    return (zone.scene && this.map.sprites[zone.scene]) || null;
  }

  /** La zona de cada parada del papel: la de su mismo jefe y, si no hay, la del mismo orden (ver `stopZoneId`). */
  zoneIdOfStop(index: number): string {
    return stopZoneId(this.map.paper.stops, index, this.map.zones);
  }

  get nodes(): ShownNode[] {
    const zone = this.zone;
    if (!zone) return [];
    const state: MapNodeState = this.isOpen(zone.id) ? this.nodeState : 'locked';
    return zone.points.map((point) => {
      const name = nodeSpriteName(point.kind, state, this.map.sprites);
      const sprite = name ? this.map.sprites[name] : null;
      const pulses = state === 'open' || state === 'current';
      return { point, sprite, frame: sprite && pulses ? this.frame(PULSE_FPS, sprite.frames) : 0 };
    });
  }

  get pathDot(): MapSprite | null {
    return this.map.sprites['map-path-dot'] ?? null;
  }

  get dots() {
    return this.zone ? pathDots(this.zone.points) : [];
  }

  /** El camino se ve recorrido cuando los puntos están hechos. */
  get dotFrame(): number {
    return this.nodeState.startsWith('done') && this.zone && this.isOpen(this.zone.id) ? 1 : 0;
  }

  get cookies() {
    const { trail } = this.map.paper;
    return trail.map((t, i) => {
      const name = trailCookie(i, this.progress, trail, this.map.sprites);
      return { x: t.x, y: t.y, name, filled: i < this.progress, sprite: name ? this.map.sprites[name] : null };
    });
  }

  get marker() {
    return markerAt(this.progress, this.map.paper.trail, this.map.paper.stops, { w: this.map.logical.paperW, h: this.map.logical.paperH });
  }

  get markerSprite(): MapSprite | null {
    return this.map.sprites['paper-marker'] ?? null;
  }

  stopSprite(boss: string, open: boolean): MapSprite | null {
    const name = paperStopSprite(boss, open, this.map.sprites);
    return name ? this.map.sprites[name] : null;
  }
}
