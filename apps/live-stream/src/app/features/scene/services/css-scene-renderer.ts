import { RendererOptions, SceneRenderer } from './scene-renderer';
import { SCENE_ASSETS_URL, SceneManifest } from './scene-manifest';
import { Actor, CLOUDS, cloudX, sceneAt } from '@features/scene/utils/scene-timeline.util';

const ACTOR_NAMES = ['dog', 'cat', 'hand', 'bone', 'heart', 'hole'] as const;
type ActorName = (typeof ACTOR_NAMES)[number];

interface SpriteNode {
  frame: HTMLElement;
  w: number;
  h: number;
  /** Última transformación escrita, para no tocar el DOM si no cambió. */
  last: string;
}

/**
 * Escena con DOM: cada sprite es una tira dentro de una ventana con `overflow: hidden`,
 * y el cambio de cuadros es una animación CSS `steps()` sobre `transform`, que corre en
 * el compositor sin pasar por JavaScript. JavaScript solo mueve a los actores, y solo
 * cuando su posición cambió.
 */
export class CssSceneRenderer implements SceneRenderer {
  private raf = 0;
  private root?: HTMLElement;
  private style?: HTMLStyleElement;
  private nightLayer?: HTMLElement;
  private lastNight = -1;
  private readonly nodes = new Map<string, SpriteNode>();
  private readonly actorSprites = new Map<ActorName, string[]>();
  private current = new Map<ActorName, string>();

  async mount(host: HTMLElement, manifest: SceneManifest, options: RendererOptions): Promise<void> {
    const { w, h } = manifest.logical;
    const root = document.createElement('div');
    root.className = 'css-scene';
    root.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;overflow:hidden;image-rendering:pixelated;`;
    this.root = root;

    this.style = document.createElement('style');
    this.style.textContent = this.buildCss(manifest);
    document.head.appendChild(this.style);

    root.appendChild(this.image(manifest.backgrounds.day, w, h));
    const night = this.image(manifest.backgrounds.night, w, h);
    night.style.opacity = '0';
    this.nightLayer = night;
    root.appendChild(night);

    for (const [i, def] of CLOUDS.entries()) {
      const sprite = manifest.sprites[def.sprite];
      const cloud = this.spriteNode(def.sprite, sprite.frameW, sprite.frameH, manifest);
      cloud.frame.classList.add('cloud');
      cloud.frame.style.top = `${def.y - sprite.frameH}px`;
      const span = w + sprite.frameW * 2;
      // Una animación CSS lineal e infinita: sin JavaScript por cuadro.
      const start = cloudX(def, Date.now(), w, sprite.frameW) + sprite.frameW;
      const duration = span / def.speed;
      cloud.frame.style.animation = `cloud-${i} ${duration}s linear infinite`;
      cloud.frame.style.animationDelay = `${-((start / span) * duration)}s`;
      this.style.textContent += `@keyframes cloud-${i}{from{transform:translate3d(${-sprite.frameW}px,0,0)}to{transform:translate3d(${w + sprite.frameW}px,0,0)}}`;
      root.appendChild(cloud.frame);
    }

    for (const name of ACTOR_NAMES) {
      this.actorSprites.set(name, []);
    }
    for (const [name, def] of Object.entries(manifest.sprites)) {
      const actor = name.split('-')[0] as ActorName;
      if (!ACTOR_NAMES.includes(actor)) {
        continue;
      }
      const node = this.spriteNode(name, def.frameW, def.frameH, manifest);
      node.frame.style.display = 'none';
      root.appendChild(node.frame);
      this.actorSprites.get(actor)?.push(name);
    }

    host.appendChild(root);
    this.loop(options);
  }

  private buildCss(manifest: SceneManifest): string {
    let css = '.sp{position:absolute;left:0;top:0;overflow:hidden;will-change:transform;contain:strict;}';
    css += '.sp img{display:block;image-rendering:pixelated;will-change:transform;}';
    for (const [name, s] of Object.entries(manifest.sprites)) {
      if (s.frames > 1) {
        const total = s.frameW * s.frames;
        css += `.st-${name}{animation:a-${name} ${s.frames / s.fps}s steps(${s.frames}) infinite;}`;
        css += `@keyframes a-${name}{from{transform:translate3d(0,0,0)}to{transform:translate3d(-${total}px,0,0)}}`;
      }
    }
    return css;
  }

  private image(file: string, w: number, h: number): HTMLElement {
    const img = document.createElement('img');
    img.src = `${SCENE_ASSETS_URL}${file}`;
    img.width = w;
    img.height = h;
    img.style.cssText = 'position:absolute;left:0;top:0;image-rendering:pixelated;';
    return img;
  }

  private spriteNode(name: string, w: number, h: number, manifest: SceneManifest): SpriteNode {
    const def = manifest.sprites[name];
    const frame = document.createElement('div');
    frame.className = 'sp';
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    const strip = document.createElement('img');
    strip.src = `${SCENE_ASSETS_URL}${def.file}`;
    strip.className = `st-${name}`;
    strip.draggable = false;
    frame.appendChild(strip);
    const node: SpriteNode = { frame, w, h, last: '' };
    this.nodes.set(name, node);
    return node;
  }

  private loop(options: RendererOptions): void {
    const interval = 1000 / options.fps;
    let last = 0;
    const tick = (now: number): void => {
      this.raf = requestAnimationFrame(tick);
      if (now - last < interval - 2) {
        return;
      }
      last = now;
      this.apply(Date.now(), options);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private apply(nowMs: number, options: RendererOptions): void {
    const snap = sceneAt(nowMs, options.dayMs);

    if (Math.abs(snap.night - this.lastNight) > 0.004 && this.nightLayer) {
      this.lastNight = snap.night;
      this.nightLayer.style.opacity = snap.night.toFixed(3);
    }

    for (const name of ACTOR_NAMES) {
      this.place(name, snap[name]);
    }
  }

  private place(name: ActorName, actor: Actor): void {
    const sprites = this.actorSprites.get(name) ?? [];
    const shown = actor.visible ? actor.sprite : '';
    if (this.current.get(name) !== shown) {
      for (const s of sprites) {
        const node = this.nodes.get(s);
        if (node) {
          node.frame.style.display = s === shown ? 'block' : 'none';
        }
      }
      this.current.set(name, shown);
    }
    if (!shown) {
      return;
    }
    const node = this.nodes.get(shown);
    if (!node) {
      return;
    }
    const x = Math.round(actor.x - node.w / 2);
    const y = Math.round(actor.y - node.h);
    const transform = `translate3d(${x}px,${y}px,0)${actor.flip ? ' scaleX(-1)' : ''}`;
    if (transform !== node.last) {
      node.last = transform;
      node.frame.style.transform = transform;
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.root?.remove();
    this.style?.remove();
  }
}
