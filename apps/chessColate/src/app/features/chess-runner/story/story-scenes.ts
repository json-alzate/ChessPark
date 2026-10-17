/**
 * La historia del Chess Runner, contada sin una sola palabra: un perrito que duerme junto al frasco de galletas
 * doradas del reino, el Rey de las Sombras que se lo lleva, y el camino tras él por seis mundos, uno por cada grupo
 * de patrones. En cada mundo un guardián le corta el paso; el perrito aprende el patrón, lo vence y gana un poder.
 * Al final recupera el frasco.
 *
 * Cada escena es una función pura del tiempo: dado el segundo `t` y el ancho de la pantalla, dice qué hay en el
 * escenario (`StageFrame`). Así se prueban sin dibujar y el dibujo (`rendering/stage.ts`) no sabe de la historia.
 */

import { CHAPTERS, RunnerPowerId, RunnerWorld } from '../campaign/runner-curriculum';
import { BubbleIcon } from '../rendering/pixel-art';
import { StageFrame, StageProp } from '../rendering/stage';

export type StorySceneId = 'prologue' | 'intro' | 'victory' | 'epilogue';

export interface StoryScene {
  /** Qué escena es y, si es de un capítulo, cuál. */
  id: StorySceneId;
  chapter?: number;
  /** Segundos que dura. */
  duration: number;
  /** El fotograma en el segundo `t`, para una pantalla de `width` de ancho lógico. */
  frame(t: number, width: number): StageFrame;
}

// ------------------------------------------------------------------ ayudas de tiempo y movimiento

export const clamp01 = (t: number): number => Math.min(Math.max(t, 0), 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
/** Cuánto ha avanzado `t` entre `from` y `to` (de 0 a 1). */
export const span = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));
/** Oscuridad de entrada y salida: negro al principio y al final de la escena. */
export const fadeAround = (t: number, duration: number, fadeIn = 0.45, fadeOut = 0.55): number =>
  Math.max(1 - span(t, 0, fadeIn), span(t, duration - fadeOut, duration));

/**
 * Un globo con dibujitos que sale entre `from` y `to` (con un fundido corto al entrar y al salir), o nada si no es su momento.
 * `x` e `y` son el centro de abajo del globo y `tail` hacia dónde apunta la colita.
 */
function bubble(t: number, from: number, to: number, x: number, y: number, icons: readonly BubbleIcon[], tail = x): StageProp[] {
  if (t < from || t > to) {
    return [];
  }
  const alpha = Math.min(1, (t - from) / 0.18, (to - t) / 0.18);
  if (alpha <= 0) {
    return [];
  }
  return [{ kind: 'bubble', x: Math.round(x), y, icons, tail: Math.round(tail), alpha }];
}

/** La pieza que guarda el mundo de cada capítulo: un ejército negro, de peón a rey. */
export const GUARDIANS: readonly string[] = [
  'bp', 'bn', 'bb', 'br', 'bn', 'bb', 'br', 'bq', 'bb', 'br',
  'bq', 'bn', 'br', 'bq', 'bn', 'bb', 'br', 'bq', 'bq', 'bk',
];

/** Lo grande que se planta el guardián de un capítulo: crecen según se avanza, y el último es el más enorme. */
export function guardianScale(chapter: number): number {
  return 2.1 + Math.min(Math.max(chapter, 0), GUARDIANS.length - 1) * 0.07;
}

export function guardianOf(chapter: number): string {
  return GUARDIANS[Math.min(Math.max(chapter, 0), GUARDIANS.length - 1)];
}

/** Mundo de un capítulo (el último se queda en la tormenta). */
function worldOf(chapter: number): RunnerWorld {
  return CHAPTERS[Math.min(Math.max(chapter, 0), CHAPTERS.length - 1)].world;
}

// ------------------------------------------------------------------------------- el prólogo

const PROLOGUE_SECONDS = 8.4;

/** El perrito duerme junto al frasco; llega el Rey de las Sombras, se lo lleva, y el perrito despierta y corre tras él. */
export const prologue: StoryScene = {
  id: 'prologue',
  duration: PROLOGUE_SECONDS,
  frame(t, w) {
    const pedestalX = Math.round(w * 0.74);
    const dogHome = Math.round(w * 0.22);
    const props: StageProp[] = [{ kind: 'pedestal', x: pedestalX }];

    // El rey entra por la derecha, llega al frasco, se lo lleva y se va
    const arrive = ease(span(t, 2.4, 3.6));
    const leave = ease(span(t, 4.4, 6.2));
    const kingX = t < 4.4 ? lerp(w + 40, pedestalX + 26, arrive) : lerp(pedestalX + 26, w + 60, leave);
    const kingVisible = t >= 2.4 && t < 6.4;

    // El frasco: sobre el peldaño, luego en la mano del rey
    const lift = ease(span(t, 3.6, 4.2));
    const jarOnPedestal = t < 3.6;
    const jarX = jarOnPedestal ? pedestalX : lerp(pedestalX, kingX - 15, lift);
    const jarY = jarOnPedestal ? 2 : lerp(2, 16, lift);
    const glow = 0.5 + 0.5 * Math.sin(t * 4);
    if (t > 1.0 && t < 2.2) {
      props.push({ kind: 'spark', x: pedestalX + 6, y: 20, phase: t });
    }
    if (kingVisible) {
      props.push({ kind: 'piece', key: 'bk', x: kingX, y: 0, scale: 1.5, tint: 'shadow', eyes: ease(span(t, 2.8, 3.4)) });
    }
    // El frasco va después: en la mano del rey se ve delante de él
    if (t < 6.4) {
      props.push({ kind: 'jar', x: jarX, y: jarY, glow: t < 4.2 ? glow : 0.3 });
    }

    // Va soltando galletas por el camino
    [4.8, 5.3, 5.8].forEach((dropAt, i) => {
      if (t >= dropAt) {
        const x = lerp(pedestalX + 26, w + 60, ease(span(dropAt, 4.4, 6.2))) - 18 - i * 3;
        props.push({ kind: 'cookie', x, y: Math.max(0, 16 - (t - dropAt) * 70) });
      }
    });

    // Los globos cuentan la historia: el perrito sueña con galletas, el rey quiere el frasco, el perrito lo echa en falta
    // y, decidido, va a por el rey
    props.push(...bubble(t, 0.3, 2.3, dogHome + 4, 50, ['cookie', 'heart'], dogHome));
    props.push(...bubble(t, 3.0, 4.4, kingX - 4, 82, ['jar'], kingX));
    props.push(...bubble(t, 5.0, 6.0, dogHome + 4, 56, ['tear', 'jar'], dogHome));
    props.push(...bubble(t, 6.0, 7.2, dogHome + 6 + (t - 6.0) * 30, 60, ['fire', 'king'], dogHome + 6 + (t - 6.0) * 30));

    // El perrito: duerme, despierta atento, salta y corre detrás
    let dog: StageFrame['dog'];
    let scroll = 0;
    if (t < 5.0) {
      dog = { x: dogHome, y: 0, pose: 'sleep' };
    } else if (t < 6.2) {
      dog = { x: dogHome, y: 0, pose: 'idle' };
      props.push({ kind: 'alert', x: dogHome + 6, y: 40 });
    } else if (t < 6.7) {
      const up = span(t, 6.2, 6.7);
      dog = { x: dogHome + 6 * up, y: Math.sin(up * Math.PI) * 18, pose: 'jump' };
    } else {
      const run = t - 6.7;
      scroll = run * 150;
      dog = { x: dogHome + 6 + ease(span(t, 6.7, 8.4)) * (w * 0.32), y: 0, pose: 'run' };
    }
    return { world: 'night', scroll, dog, props, fade: fadeAround(t, PROLOGUE_SECONDS, 0.5, 0.7), flash: 0 };
  },
};

// -------------------------------------------------------------- llegada a un mundo (un capítulo)

const INTRO_SECONDS = 3.8;

/** El perrito llega a un mundo nuevo: el ladrón huye dejando una galleta y, de la nada, aparece el guardián. */
export function introScene(chapter: number): StoryScene {
  return {
    id: 'intro',
    chapter,
    duration: INTRO_SECONDS,
    frame(t, w) {
      const props: StageProp[] = [];
      const guardianX = Math.round(w * 0.8);

      // El ladrón cruza el fondo con el frasco y deja caer una galleta
      if (t < 1.8) {
        const thiefX = lerp(w * 0.5, w + 30, ease(span(t, 0.1, 1.7)));
        props.push({ kind: 'piece', key: 'bk', x: thiefX, y: 0, scale: 1.0, tint: 'shadow', eyes: 1 });
        props.push({ kind: 'jar', x: thiefX - 9, y: 10, scale: 0.6 });
        if (t > 0.7) {
          props.push({ kind: 'cookie', x: lerp(w * 0.5, w + 30, ease(span(0.7, 0.1, 1.7))) - 6, y: Math.max(0, 10 - (t - 0.7) * 60) });
        }
      }

      // El guardián sube del suelo, abre los ojos y se planta
      const rise = ease(span(t, 0.9, 1.8));
      const shake = t > 1.8 && t < 2.1 ? Math.sin(t * 90) * 2 : 0;
      props.push({
        kind: 'piece',
        key: guardianOf(chapter),
        x: guardianX + shake,
        y: lerp(-64, 0, rise),
        scale: guardianScale(chapter),
        tint: 'shadow',
        eyes: ease(span(t, 1.6, 2.1)),
      });

      // El ladrón huye con el frasco (se ve en su globo); ante el guardián, el perrito se pone en guardia
      props.push(...bubble(t, 0.2, 1.6, lerp(w * 0.5, w + 30, ease(span(t, 0.1, 1.7))), 56, ['jar', 'arrow'], lerp(w * 0.5, w + 30, ease(span(t, 0.1, 1.7)))));
      props.push(...bubble(t, 2.9, 3.7, w * 0.34 + 4, 52, ['fire'], w * 0.34));

      // El perrito corre y, ante el guardián, frena y se pone alerta
      const running = t < 2.5;
      const dogX = running ? w * 0.3 : lerp(w * 0.3, w * 0.34, ease(span(t, 2.5, 2.9)));
      if (!running) {
        props.push({ kind: 'alert', x: dogX + 6, y: 40 });
      }
      return {
        world: worldOf(chapter),
        scroll: running ? t * 130 : 2.5 * 130,
        dog: { x: dogX, y: 0, pose: running ? 'run' : 'idle' },
        props,
        fade: fadeAround(t, INTRO_SECONDS, 0.4, 0.45),
        flash: 0,
      };
    },
  };
}

// ----------------------------------------------------------------- victoria: el poder y las estrellas

const VICTORY_SECONDS = 5.8;
const BURST_COOKIES = 9;

export interface VictoryOptions {
  chapter: number;
  /** Estrellas del capítulo (1 a 3). */
  stars: number;
  /** El poder que gana (los capítulos intermedios no traen ninguno). */
  power: RunnerPowerId | null;
  /** Lo que ya llevaba puesto antes (sin el poder nuevo). */
  gearBefore: readonly RunnerPowerId[];
}

/** El guardián cae en una lluvia de galletas, el poder vuela al perrito y las estrellas dicen lo bien que lo hizo. */
export function victoryScene(options: VictoryOptions): StoryScene {
  const { chapter, stars, power, gearBefore } = options;
  return {
    id: 'victory',
    chapter,
    duration: VICTORY_SECONDS,
    frame(t, w) {
      const props: StageProp[] = [];
      const guardianX = Math.round(w * 0.74);
      const dogX = Math.round(w * 0.28);

      // El guardián tiembla, destella y se deshace en galletas
      if (t < 1.4) {
        const shake = t > 0.4 ? Math.sin(t * 80) * 2.5 * (1 - span(t, 0.4, 1.4)) : 0;
        props.push({
          kind: 'piece',
          key: guardianOf(chapter),
          x: guardianX + shake,
          y: 0,
          scale: guardianScale(chapter),
          tint: 'shadow',
          eyes: 0.5 + 0.5 * Math.sin(t * 25),
          alpha: 1 - span(t, 1.1, 1.4),
        });
      }
      if (t >= 1.2) {
        const since = t - 1.2;
        for (let i = 0; i < BURST_COOKIES; i++) {
          const angle = (-0.15 + (i / (BURST_COOKIES - 1)) * 1.3) * Math.PI + Math.PI * 0.2;
          const speed = 55 + (i % 3) * 18;
          const x = guardianX - Math.cos(angle) * speed * since * 0.9;
          const y = Math.max(0, 28 + Math.sin(angle) * speed * since - 130 * since * since);
          props.push({ kind: 'cookie', x, y, alpha: 1 - span(t, 3.6, 4.6) });
        }
        if (since < 0.6) {
          props.push({ kind: 'spark', x: guardianX, y: 24, phase: since });
        }
      }

      // El poder surge, flota y vuela al perrito
      const gearOn = t >= 2.9;
      if (power && t >= 1.6 && t < 3.0) {
        const out = ease(span(t, 1.6, 2.1));
        const fly = ease(span(t, 2.3, 2.95));
        props.push({
          kind: 'power',
          id: power,
          x: lerp(lerp(guardianX, w * 0.52, fly), dogX, fly),
          y: lerp(lerp(18, 56, out), 26, fly),
          scale: lerp(2.6, 1.2, fly),
          alpha: Math.min(1, out + 0.2) * (1 - span(t, 2.85, 3.0)),
        });
      }

      // Las estrellas, una a una: aparecen de golpe, se pasan de tamaño y se asientan
      for (let i = 0; i < 3; i++) {
        const at = 3.3 + i * 0.45;
        if (t >= at) {
          const pop = span(t, at, at + 0.3);
          const scale = pop < 1 ? lerp(0.5, 3.0, ease(pop)) : 3.0 - 1.0 * Math.min(1, (t - at - 0.3) * 4);
          props.push({ kind: 'star', x: dogX + (i - 1) * 32, y: 64, scale: Math.max(2, scale), filled: i < stars });
        }
      }

      const gear = gearOn && power ? [...gearBefore, power] : [...gearBefore];
      return {
        world: worldOf(chapter),
        scroll: t * 70,
        dog: gearOn ? { x: dogX, y: 0, pose: 'run', gear } : { x: dogX, y: t < 1.2 ? Math.abs(Math.sin(t * 7)) * 10 : 0, pose: 'happy', gear },
        props,
        fade: fadeAround(t, VICTORY_SECONDS, 0.35, 0.6),
        flash: Math.max(0.9 * (1 - span(t, 1.2, 1.6)) * span(t, 1.15, 1.25), 0.35 * (1 - span(t, 2.9, 3.2)) * span(t, 2.88, 2.92)),
      };
    },
  };
}

// ------------------------------------------------------------------------------- el epílogo

const EPILOGUE_SECONDS = 9.6;

/** El perrito, con todo su equipo, se enfrenta al Rey de las Sombras y recupera el frasco: amanece. */
export function epilogueScene(gear: readonly RunnerPowerId[]): StoryScene {
  return {
    id: 'epilogue',
    duration: EPILOGUE_SECONDS,
    frame(t, w) {
      const props: StageProp[] = [];
      const kingX = Math.round(w * 0.72);
      const dawn = t >= 4.6;

      // El rey, enorme, hasta que el golpe lo encoge y lo deshace
      const shrink = ease(span(t, 2.7, 4.3));
      if (t < 4.5) {
        props.push({
          kind: 'piece',
          key: 'bk',
          x: kingX + (t > 2.7 && t < 3.2 ? Math.sin(t * 70) * 3 : 0),
          y: 0,
          scale: lerp(4.0, 1.0, shrink),
          tint: 'shadow',
          eyes: 1 - span(t, 3.6, 4.3),
          alpha: 1 - span(t, 4.0, 4.5),
        });
      }

      // El frasco, en alto junto al rey; cuando este cae, vuelve al peldaño y brilla
      const pedestalX = Math.round(w * 0.55);
      if (t >= 4.9) {
        props.push({ kind: 'pedestal', x: pedestalX });
      }
      if (t < 2.9) {
        props.push({ kind: 'jar', x: kingX - 38, y: 44, scale: 1.5, glow: 0.5 });
      } else if (t < 5.2) {
        const fall = ease(span(t, 2.9, 3.7));
        props.push({ kind: 'jar', x: lerp(kingX - 38, pedestalX, fall), y: lerp(44, 2, fall), scale: lerp(1.5, 1, fall), glow: 0.4 });
      } else {
        props.push({ kind: 'jar', x: pedestalX, y: 2, glow: 0.5 + 0.5 * Math.sin(t * 4) });
      }

      // Lluvia de galletas al amanecer
      if (dawn) {
        for (let i = 0; i < 14; i++) {
          const start = 5.2 + (i % 7) * 0.18;
          const fallen = t - start;
          if (fallen > 0) {
            props.push({ kind: 'cookie', x: ((i * 61) % 97) / 97 * w, y: Math.max(0, 150 - fallen * 90), alpha: 1 - span(t, 8.6, 9.2) });
          }
        }
      }
      if (t > 5.2 && t < 7.4) {
        props.push({ kind: 'spark', x: pedestalX + 12, y: 22, phase: t });
        props.push({ kind: 'spark', x: pedestalX - 14, y: 30, phase: t + 0.1 });
      }

      // Recuperado el frasco, el perrito lo celebra
      props.push(...bubble(t, 5.8, 8.2, w * 0.4 + 4, 56, ['jar', 'heart'], w * 0.4));

      // El perrito llega corriendo, salta (dos veces) hacia el rey y, ganado el frasco, se sienta contento
      let dog: StageFrame['dog'];
      let scroll = 0;
      if (t < 1.5) {
        scroll = t * 150;
        dog = { x: lerp(-10, w * 0.3, ease(span(t, 0, 1.5))), y: 0, pose: 'run', gear };
      } else if (t < 2.6) {
        const air = span(t, 1.5, 2.6);
        dog = { x: lerp(w * 0.3, w * 0.5, ease(air)), y: Math.sin(air * Math.PI) * 26 + (air > 0.45 ? Math.sin((air - 0.45) * Math.PI * 1.8) * 22 : 0), pose: 'jump', gear };
      } else if (t < 4.6) {
        // Aterriza ante el rey y, con el golpe dado, vuelve atrás despacio
        scroll = 40 * t;
        dog = { x: lerp(w * 0.5, w * 0.4, ease(span(t, 2.6, 3.4))), y: 0, pose: 'run', gear };
      } else {
        dog = { x: w * 0.4, y: 0, pose: 'happy' };
      }

      return {
        world: dawn ? 'dawn' : 'storm',
        scroll,
        dog,
        props,
        fade: fadeAround(t, EPILOGUE_SECONDS, 0.5, 0.8),
        flash: Math.max(0.85 * (1 - span(t, 2.6, 3.0)) * span(t, 2.58, 2.62), 0.9 * (1 - span(t, 4.6, 5.1)) * span(t, 4.55, 4.62)),
      };
    },
  };
}
