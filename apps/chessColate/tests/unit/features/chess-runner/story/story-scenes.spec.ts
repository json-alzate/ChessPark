import { CHAPTERS } from '@features/chess-runner/campaign/runner-curriculum';
import { BUBBLE_ICONS } from '@features/chess-runner/rendering/pixel-art';
import { StageFrame, StageProp } from '@features/chess-runner/rendering/stage';
import {
  clamp01,
  ease,
  epilogueScene,
  fadeAround,
  guardianOf,
  GUARDIANS,
  introScene,
  lerp,
  prologue,
  span,
  StoryScene,
  victoryScene,
} from '@features/chess-runner/story/story-scenes';

const ANCHO = 200;
const props = (frame: StageFrame, kind: StageProp['kind']) => frame.props.filter((p) => p.kind === kind);
const pieza = (frame: StageFrame, key: string) => frame.props.find((p) => p.kind === 'piece' && p.key === key) as Extract<StageProp, { kind: 'piece' }> | undefined;
const frasco = (frame: StageFrame) => props(frame, 'jar')[0] as Extract<StageProp, { kind: 'jar' }> | undefined;

/** Todas las escenas, para las comprobaciones que valen para todas. */
const ESCENAS: [string, StoryScene][] = [
  ['el prólogo', prologue],
  ['la llegada a un mundo', introScene(2)],
  ['la victoria', victoryScene({ chapter: 2, stars: 2, power: 'shield', gearBefore: ['nose', 'spring'] })],
  ['el final', epilogueScene(['nose', 'spring', 'shield'])],
];

describe('ayudas de movimiento', () => {
  it('clamp01, lerp, ease y span', () => {
    expect([clamp01(-1), clamp01(0.4), clamp01(9)]).toEqual([0, 0.4, 1]);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect([ease(0), ease(1), ease(0.5)]).toEqual([0, 1, 0.5]);
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(span(5, 4, 6)).toBe(0.5);
    expect(span(1, 4, 6)).toBe(0);
    expect(span(9, 4, 6)).toBe(1);
  });

  it('fadeAround: negro al empezar y al acabar, claro en medio', () => {
    expect(fadeAround(0, 10)).toBe(1);
    expect(fadeAround(5, 10)).toBe(0);
    expect(fadeAround(10, 10)).toBe(1);
    expect(fadeAround(9.8, 10)).toBeGreaterThan(0.5);
  });
});

describe.each(ESCENAS)('%s', (_nombre, escena) => {
  it('dura unos segundos, ni un parpadeo ni una película', () => {
    expect(escena.duration).toBeGreaterThan(3);
    expect(escena.duration).toBeLessThan(11);
  });

  it('empieza y acaba a oscuras, con la imagen entrando y saliendo', () => {
    expect(escena.frame(0, ANCHO).fade).toBeGreaterThan(0.9);
    expect(escena.frame(escena.duration, ANCHO).fade).toBeGreaterThan(0.9);
    expect(escena.frame(escena.duration / 2, ANCHO).fade).toBe(0);
  });

  it('cada fotograma es válido: el perrito y los objetos están a la vista y nada es raro', () => {
    for (let t = 0; t <= escena.duration; t += 0.1) {
      const frame = escena.frame(t, ANCHO);

      expect(frame.fade).toBeGreaterThanOrEqual(0);
      expect(frame.fade).toBeLessThanOrEqual(1);
      expect(frame.flash).toBeGreaterThanOrEqual(0);
      expect(frame.flash).toBeLessThanOrEqual(1);
      expect(frame.scroll).toBeGreaterThanOrEqual(0);
      if (frame.dog) {
        expect(Number.isFinite(frame.dog.x)).toBe(true);
        expect(frame.dog.y).toBeGreaterThanOrEqual(-0.001);
      }
      for (const prop of frame.props) {
        expect(Number.isFinite((prop as { x: number }).x)).toBe(true);
        expect(Number.isNaN((prop as { y?: number }).y ?? 0)).toBe(false);
      }
    }
  });

  it('es una función del tiempo: el mismo instante da el mismo fotograma', () => {
    expect(escena.frame(2.3, ANCHO)).toEqual(escena.frame(2.3, ANCHO));
  });

  it('se adapta a cualquier ancho de pantalla sin salirse de lo normal', () => {
    for (const ancho of [165, 196, 275]) {
      const frame = escena.frame(escena.duration / 2, ancho);
      expect(frame.dog === null || (frame.dog.x > -60 && frame.dog.x < ancho + 60)).toBe(true);
    }
  });

  it('nunca lleva texto: sus objetos son dibujos', () => {
    const permitidos = new Set(['pedestal', 'jar', 'piece', 'cookie', 'spark', 'alert', 'star', 'power', 'bubble']);
    for (let t = 0; t <= escena.duration; t += 0.5) {
      escena.frame(t, ANCHO).props.forEach((p) => expect(permitidos.has(p.kind)).toBe(true));
    }
  });
});

describe('el prólogo', () => {
  it('empieza con el perrito dormido junto al frasco, que está en su peldaño', () => {
    const frame = prologue.frame(1, ANCHO);

    expect(frame.world).toBe('night');
    expect(frame.dog?.pose).toBe('sleep');
    expect(props(frame, 'pedestal')).toHaveLength(1);
    expect(frasco(frame)!.y).toBe(2);
    expect(frasco(frame)!.glow).toBeGreaterThan(0);
    expect(pieza(frame, 'bk')).toBeUndefined();
  });

  it('llega el rey de las sombras, con los ojos encendidos, y se acerca al frasco', () => {
    const entrando = pieza(prologue.frame(3.0, ANCHO), 'bk')!;
    const llegado = pieza(prologue.frame(3.9, ANCHO), 'bk')!;

    expect(entrando.tint).toBe('shadow');
    expect(llegado.x).toBeLessThan(entrando.x);
    expect(llegado.eyes).toBe(1);
  });

  it('se lleva el frasco: lo levanta, y el frasco sigue al rey', () => {
    const rey = pieza(prologue.frame(5.2, ANCHO), 'bk')!;
    const jarra = frasco(prologue.frame(5.2, ANCHO))!;

    expect(jarra.y).toBeGreaterThan(10);
    expect(Math.abs(jarra.x - (rey.x - 15))).toBeLessThan(1);
  });

  it('se va por la derecha dejando un rastro de galletas', () => {
    const final = prologue.frame(6.8, ANCHO);

    expect(pieza(final, 'bk')).toBeUndefined();
    expect(frasco(final)).toBeUndefined();
    expect(props(final, 'cookie').length).toBe(3);
  });

  it('el perrito despierta, se da cuenta (un signo de alerta) y sale corriendo detrás', () => {
    expect(prologue.frame(5.5, ANCHO).dog?.pose).toBe('idle');
    expect(props(prologue.frame(5.5, ANCHO), 'alert')).toHaveLength(1);
    const salto = prologue.frame(6.4, ANCHO);
    expect(salto.dog?.pose).toBe('jump');
    expect(salto.dog!.y).toBeGreaterThan(0);
    const carrera = prologue.frame(8.0, ANCHO);
    expect(carrera.dog?.pose).toBe('run');
    expect(carrera.scroll).toBeGreaterThan(100);
    expect(carrera.dog!.x).toBeGreaterThan(prologue.frame(6.8, ANCHO).dog!.x);
  });

  it('antes de despertar no hay alerta', () => {
    expect(props(prologue.frame(2, ANCHO), 'alert')).toHaveLength(0);
  });
});

describe('la llegada a un mundo', () => {
  it('usa el mundo del capítulo y su guardián', () => {
    for (const [capitulo, { world }] of CHAPTERS.entries()) {
      const frame = introScene(capitulo).frame(2.2, ANCHO);

      expect(frame.world).toBe(world);
      expect(pieza(frame, guardianOf(capitulo))).toBeDefined();
    }
  });

  it('el guardián sube del suelo, se planta y abre los ojos', () => {
    const escena = introScene(1);
    const abajo = pieza(escena.frame(1.0, ANCHO), 'bn')!;
    const arriba = pieza(escena.frame(2.2, ANCHO), 'bn')!;

    expect(abajo.y).toBeLessThan(0);
    expect(arriba.y).toBe(0);
    expect(arriba.eyes).toBe(1);
    expect(arriba.scale).toBeGreaterThan(2);
  });

  it('el ladrón cruza el fondo con el frasco y deja una galleta; después ya no está', () => {
    const escena = introScene(1);
    const cruzando = escena.frame(1.0, ANCHO);

    expect(pieza(cruzando, 'bk')).toBeDefined();
    expect(frasco(cruzando)).toBeDefined();
    expect(props(cruzando, 'cookie')).toHaveLength(1);
    expect(pieza(escena.frame(2.5, ANCHO), 'bk')).toBeUndefined();
  });

  it('el perrito corre, y ante el guardián frena y se pone alerta', () => {
    const escena = introScene(3);

    expect(escena.frame(1, ANCHO).dog?.pose).toBe('run');
    expect(escena.frame(3.2, ANCHO).dog?.pose).toBe('idle');
    expect(props(escena.frame(3.2, ANCHO), 'alert')).toHaveLength(1);
  });

  it('cada guardián es una pieza negra del ejército, de peón a rey', () => {
    expect(GUARDIANS).toHaveLength(CHAPTERS.length);
    GUARDIANS.forEach((clave) => expect(clave).toMatch(/^b[pnbrqk]$/));
    expect(GUARDIANS[0]).toBe('bp');
    expect(GUARDIANS[GUARDIANS.length - 1]).toBe('bk');
    // Pasado el último, el guardián es el rey
    expect(guardianOf(99)).toBe('bk');
    expect(guardianOf(-1)).toBe('bp');
  });
});

describe('la victoria', () => {
  const escena = (estrellas: number) => victoryScene({ chapter: 2, stars: estrellas, power: 'shield', gearBefore: ['nose', 'spring'] });

  it('al principio el guardián sigue en pie y el perrito salta contento', () => {
    const frame = escena(3).frame(0.6, ANCHO);

    expect(pieza(frame, 'bb')).toBeDefined();
    expect(frame.dog?.pose).toBe('happy');
    expect(frame.world).toBe(CHAPTERS[2].world);
  });

  it('el guardián tiembla, destella y se deshace en galletas', () => {
    expect(escena(3).frame(0.8, ANCHO).props.some((p) => p.kind === 'piece' && p.x !== Math.round(ANCHO * 0.74))).toBe(true);
    expect(escena(3).frame(1.3, ANCHO).flash).toBeGreaterThan(0.2);
    const despues = escena(3).frame(2.0, ANCHO);

    expect(pieza(despues, 'bb')).toBeUndefined();
    expect(props(despues, 'cookie')).toHaveLength(9);
  });

  it('el poder aparece y vuela hasta el perrito, y al llegar ya lo lleva puesto', () => {
    const e = escena(3);
    const saliendo = props(e.frame(1.9, ANCHO), 'power')[0] as Extract<StageProp, { kind: 'power' }>;
    const llegando = props(e.frame(2.8, ANCHO), 'power')[0] as Extract<StageProp, { kind: 'power' }>;

    expect(saliendo.id).toBe('shield');
    expect(saliendo.scale).toBeGreaterThan(llegando.scale);
    expect(llegando.x).toBeLessThan(saliendo.x);
    expect(e.frame(2.0, ANCHO).dog?.gear).toEqual(['nose', 'spring']);
    expect(e.frame(3.2, ANCHO).dog?.gear).toEqual(['nose', 'spring', 'shield']);
    expect(e.frame(3.2, ANCHO).dog?.pose).toBe('run');
  });

  it.each([1, 2, 3])('con %s estrellas, salen tres y están llenas tantas como estrellas', (estrellas) => {
    const frame = escena(estrellas).frame(5.0, ANCHO);
    const todas = props(frame, 'star') as Extract<StageProp, { kind: 'star' }>[];

    expect(todas).toHaveLength(3);
    expect(todas.filter((s) => s.filled)).toHaveLength(estrellas);
  });

  it('las estrellas salen una a una', () => {
    const e = escena(3);

    expect(props(e.frame(3.4, ANCHO), 'star')).toHaveLength(1);
    expect(props(e.frame(3.9, ANCHO), 'star')).toHaveLength(2);
    expect(props(e.frame(4.4, ANCHO), 'star')).toHaveLength(3);
  });
});

describe('el final', () => {
  const todo = ['nose', 'spring', 'shield', 'trail', 'ghost', 'dodge', 'heart', 'net', 'cloak', 'crown'] as const;
  const escena = epilogueScene(todo);

  it('empieza en la tormenta, con el rey enorme y el frasco en alto', () => {
    const frame = escena.frame(1, ANCHO);

    expect(frame.world).toBe('storm');
    expect(pieza(frame, 'bk')!.scale).toBeGreaterThan(3.5);
    expect(frasco(frame)!.y).toBeGreaterThan(30);
    expect(frame.dog?.gear).toEqual(todo);
  });

  it('el perrito salta dos veces hacia él', () => {
    const alturas = [1.8, 2.0, 2.2, 2.4, 2.55].map((t) => escena.frame(t, ANCHO).dog!.y);

    expect(Math.max(...alturas)).toBeGreaterThan(25);
    expect(escena.frame(2.0, ANCHO).dog?.pose).toBe('jump');
  });

  it('el golpe encoge al rey hasta deshacerlo y el frasco cae', () => {
    const antes = pieza(escena.frame(2.5, ANCHO), 'bk')!;
    const despues = pieza(escena.frame(4.0, ANCHO), 'bk')!;

    expect(despues.scale).toBeLessThan(antes.scale);
    expect(pieza(escena.frame(4.8, ANCHO), 'bk')).toBeUndefined();
    expect(frasco(escena.frame(3.9, ANCHO))!.y).toBeLessThan(frasco(escena.frame(2.5, ANCHO))!.y);
  });

  it('amanece: el mundo cambia a dawn, el frasco vuelve a su peldaño y llueven galletas', () => {
    const frame = escena.frame(7.0, ANCHO);

    expect(escena.frame(4.0, ANCHO).world).toBe('storm');
    expect(frame.world).toBe('dawn');
    expect(props(frame, 'pedestal')).toHaveLength(1);
    expect(frasco(frame)!.y).toBe(2);
    expect(props(frame, 'cookie').length).toBeGreaterThan(8);
    expect(frame.dog?.pose).toBe('happy');
  });

  it('el cambio de mundo va con un destello', () => {
    expect(escena.frame(4.62, ANCHO).flash).toBeGreaterThan(0.5);
  });
});

describe('los globos con dibujitos: la historia se entiende sin palabras', () => {
  type Globo = Extract<StageProp, { kind: 'bubble' }>;
  const globos = (frame: StageFrame) => frame.props.filter((p): p is Globo => p.kind === 'bubble');
  const iconos = (escena: StoryScene, t: number) => globos(escena.frame(t, ANCHO)).map((g) => g.icons.join('+'));

  it('todos los dibujitos existen y ningún globo se queda vacío', () => {
    for (const [, escena] of ESCENAS) {
      for (let t = 0; t <= escena.duration; t += 0.1) {
        for (const globo of globos(escena.frame(t, ANCHO))) {
          expect(globo.icons.length).toBeGreaterThan(0);
          globo.icons.forEach((icono) => expect(BUBBLE_ICONS[icono]).toBeDefined());
          expect(globo.alpha ?? 1).toBeGreaterThan(0);
          expect(globo.alpha ?? 1).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('el prólogo cuenta: sueña con galletas, el rey quiere el frasco, el perrito lo echa en falta y se decide a seguir al rey', () => {
    expect(iconos(prologue, 1.2)).toEqual(['cookie+heart']);
    expect(iconos(prologue, 3.7)).toEqual(['jar']);
    expect(iconos(prologue, 5.4)).toEqual(['tear+jar']);
    expect(iconos(prologue, 6.5)).toEqual(['fire+king']);
    // Y entre medias no hay globos que se amontonen
    expect(iconos(prologue, 0)).toEqual([]);
    expect(iconos(prologue, 8.3)).toEqual([]);
  });

  it('los globos entran y salen con un fundido, no de golpe', () => {
    const [entrando] = globos(prologue.frame(0.36, ANCHO));
    const [dentro] = globos(prologue.frame(1.2, ANCHO));

    expect(entrando.alpha).toBeLessThan(1);
    expect(dentro.alpha).toBe(1);
  });

  it('la colita del globo apunta al personaje que habla', () => {
    const [soñando] = globos(prologue.frame(1.2, ANCHO));

    expect(soñando.tail).toBe(Math.round(ANCHO * 0.22));
  });

  it('la llegada a un mundo enseña al ladrón huyendo con el frasco y al perrito listo para pelear', () => {
    const escena = introScene(3);

    expect(iconos(escena, 1.0)).toEqual(['jar+arrow']);
    expect(iconos(escena, 3.3)).toEqual(['fire']);
  });

  it('el final celebra el frasco recuperado', () => {
    expect(iconos(epilogueScene(['nose']), 7)).toEqual(['jar+heart']);
  });
});
