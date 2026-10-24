import {
  bucketsInRange,
  pickSpread,
  planSources,
  planTopUp,
  selectPuzzles,
  sourceKey,
  splitEvenly,
  WoodpeckerSourceFile,
} from '@features/woodpecker/utils/woodpecker-set.util';
import { aleatorioConSemilla, ejercicio, ejercicios } from '@tests/support/pajaro-carpintero';

/** Franjas de 20 puntos de `desde` a `hasta` (ambos incluidos), como el manifiesto. */
function franjas(desde: number, hasta: number): Set<number> {
  const starts = new Set<number>();
  for (let elo = desde; elo <= hasta; elo += 20) {
    starts.add(elo);
  }
  return starts;
}

const TODAS = franjas(400, 2800);

describe('splitEvenly', () => {
  it('reparte en partes iguales cuando se puede', () => {
    expect(splitEvenly(100, 4)).toEqual([25, 25, 25, 25]);
  });

  it('el sobrante se reparte de uno en uno entre las primeras partes', () => {
    expect(splitEvenly(10, 3)).toEqual([4, 3, 3]);
  });

  it('siempre suma el total', () => {
    expect(splitEvenly(97, 8).reduce((a, b) => a + b, 0)).toBe(97);
  });

  it('sin partes no hay nada que repartir', () => {
    expect(splitEvenly(10, 0)).toEqual([]);
  });
});

describe('bucketsInRange', () => {
  it('toma solo las franjas que caben enteras en [min, max)', () => {
    expect(bucketsInRange(1500, 1600, TODAS)).toEqual([1500, 1520, 1540, 1560, 1580]);
  });

  it('descarta las franjas que el catálogo no tiene', () => {
    const sinHueco = new Set([1500, 1560]);
    expect(bucketsInRange(1500, 1600, sinHueco)).toEqual([1500, 1560]);
  });

  it('un tema que no existe no aporta franjas', () => {
    expect(bucketsInRange(1500, 1600, undefined)).toEqual([]);
  });

  it('devuelve las franjas ordenadas aunque el conjunto no lo esté', () => {
    expect(bucketsInRange(1500, 1560, new Set([1540, 1500, 1520]))).toEqual([1500, 1520, 1540]);
  });
});

describe('pickSpread', () => {
  const franjasLista = Array.from({ length: 20 }, (_, i) => 1000 + i * 20);

  it('si piden más de las que hay, devuelve todas', () => {
    expect(pickSpread([1000, 1020], 5)).toEqual([1000, 1020]);
  });

  it('reparte las elegidas por todo el rango, una por tramo', () => {
    const elegidas = pickSpread(franjasLista, 4, aleatorioConSemilla(11));

    expect(elegidas).toHaveLength(4);
    // Cada una cae en su cuarto del rango: nunca dos en el mismo tramo
    const tramo = (franja: number) => Math.floor((franjasLista.indexOf(franja) * 4) / 20);
    expect(elegidas.map(tramo)).toEqual([0, 1, 2, 3]);
  });

  it('no repite franjas', () => {
    const elegidas = pickSpread(franjasLista, 10, aleatorioConSemilla(2));
    expect(new Set(elegidas).size).toBe(10);
  });
});

describe('planSources', () => {
  const filtros = { eloMin: 1300, eloMax: 1700, themes: ['fork', 'pin'] };
  const validas = () => TODAS;

  it('el total pedido se reparte entre los archivos', () => {
    const fuentes = planSources(100, filtros, validas, aleatorioConSemilla(1));
    expect(fuentes.reduce((suma, f) => suma + f.take, 0)).toBe(100);
  });

  it('cada tema recibe la misma parte', () => {
    const fuentes = planSources(100, filtros, validas, aleatorioConSemilla(1));
    const porTema = (tema: string) =>
      fuentes.filter((f) => f.theme === tema).reduce((suma, f) => suma + f.take, 0);
    expect(porTema('fork')).toBe(50);
    expect(porTema('pin')).toBe(50);
  });

  it('usa pocos archivos: unos 25 ejercicios de cada uno', () => {
    const fuentes = planSources(100, filtros, validas, aleatorioConSemilla(1));
    // 100 ejercicios / 25 por archivo = 4 archivos, no una franja por cada 20 puntos del rango
    expect(fuentes).toHaveLength(4);
  });

  it('un set grande de un solo tema usa más archivos, sin pasar de los que hay', () => {
    const fuentes = planSources(
      500,
      { eloMin: 1300, eloMax: 1500, themes: ['fork'] },
      validas,
      aleatorioConSemilla(1)
    );
    expect(fuentes).toHaveLength(10); // el rango solo tiene 10 franjas
    expect(fuentes.reduce((suma, f) => suma + f.take, 0)).toBe(500);
  });

  it('todos los archivos están dentro del rango pedido', () => {
    const fuentes = planSources(200, filtros, validas, aleatorioConSemilla(4));
    fuentes.forEach((f) => {
      expect(f.eloStart).toBeGreaterThanOrEqual(1300);
      expect(f.eloStart + 20).toBeLessThanOrEqual(1700);
    });
  });

  it('cubre el rango entero y no solo una esquina', () => {
    const fuentes = planSources(
      200,
      { eloMin: 1000, eloMax: 2000, themes: ['fork'] },
      validas,
      aleatorioConSemilla(8)
    );
    const franjasUsadas = fuentes.map((f) => f.eloStart).sort((a, b) => a - b);
    expect(franjasUsadas[0]).toBeLessThan(1250);
    expect(franjasUsadas[franjasUsadas.length - 1]).toBeGreaterThan(1750);
  });

  it('descarta los temas sin archivos en el rango y reparte entre el resto', () => {
    const solo = (tema: string) => (tema === 'fork' ? TODAS : undefined);
    const fuentes = planSources(60, filtros, solo, aleatorioConSemilla(1));

    expect(fuentes.every((f) => f.theme === 'fork')).toBe(true);
    expect(fuentes.reduce((suma, f) => suma + f.take, 0)).toBe(60);
  });

  it('sin ningún tema utilizable no hay nada que descargar', () => {
    expect(planSources(100, filtros, () => undefined)).toEqual([]);
  });

  it('con sorteos distintos puede elegir archivos distintos', () => {
    const a = planSources(100, filtros, validas, aleatorioConSemilla(1));
    const b = planSources(100, filtros, validas, aleatorioConSemilla(50));
    expect(a.map(sourceKey)).not.toEqual(b.map(sourceKey));
  });
});

describe('planTopUp', () => {
  const filtros = { eloMin: 1300, eloMax: 1700, themes: ['fork', 'pin'] };
  const validas = () => TODAS;

  it('no pide nada si no falta nada', () => {
    expect(planTopUp(0, filtros, validas, new Set())).toEqual([]);
  });

  it('pide lo que falta sin repetir archivos ya usados', () => {
    const usados = new Set(['fork|1300', 'pin|1300']);
    const extra = planTopUp(40, filtros, validas, usados, aleatorioConSemilla(2));

    expect(extra.reduce((suma, f) => suma + f.take, 0)).toBe(40);
    extra.forEach((f) => expect(usados.has(sourceKey(f))).toBe(false));
  });

  it('alterna entre temas para no cargar todo sobre uno', () => {
    const extra = planTopUp(50, filtros, validas, new Set(), aleatorioConSemilla(2));
    expect(extra.map((f) => f.theme).slice(0, 2).sort()).toEqual(['fork', 'pin']);
  });

  it('si los archivos rinden poco, pide más archivos para cubrir lo mismo', () => {
    const normales = planTopUp(60, filtros, validas, new Set(), aleatorioConSemilla(2));
    const flojos = planTopUp(60, filtros, validas, new Set(), aleatorioConSemilla(2), 6);

    expect(normales.length).toBe(3); // 60 / 25 por archivo
    expect(flojos.length).toBe(10); // 60 / 6 por archivo
    expect(flojos.reduce((suma, f) => suma + f.take, 0)).toBe(60);
  });

  it('si ya no quedan archivos, devuelve lo que pueda (nada)', () => {
    const todos = new Set<string>();
    for (const tema of ['fork', 'pin']) {
      for (let elo = 1300; elo < 1700; elo += 20) {
        todos.add(sourceKey({ theme: tema, eloStart: elo }));
      }
    }
    expect(planTopUp(30, filtros, validas, todos)).toEqual([]);
  });
});

describe('selectPuzzles', () => {
  const fuente = (theme: string, take: number): WoodpeckerSourceFile => ({
    theme,
    eloStart: 1500,
    take,
  });

  it('cada archivo aporta lo suyo', () => {
    const set = selectPuzzles(
      [
        { source: fuente('fork', 3), puzzles: ejercicios(10, 'a') },
        { source: fuente('pin', 2), puzzles: ejercicios(10, 'b') },
      ],
      5,
      aleatorioConSemilla(1)
    );

    expect(set).toHaveLength(5);
    expect(set.filter((p) => p.uid.startsWith('a'))).toHaveLength(3);
    expect(set.filter((p) => p.uid.startsWith('b'))).toHaveLength(2);
  });

  it('no repite un ejercicio que entró por dos temas', () => {
    const compartido = ejercicio('mismo');
    const set = selectPuzzles(
      [
        { source: fuente('fork', 2), puzzles: [compartido, ejercicio('a1'), ejercicio('a2')] },
        { source: fuente('pin', 2), puzzles: [compartido, ejercicio('b1'), ejercicio('b2')] },
      ],
      4,
      aleatorioConSemilla(1)
    );

    const uids = set.map((p) => p.uid);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('si un archivo da de menos, completa con lo que sobró de los demás', () => {
    const set = selectPuzzles(
      [
        { source: fuente('fork', 5), puzzles: ejercicios(2, 'a') },
        { source: fuente('pin', 5), puzzles: ejercicios(20, 'b') },
      ],
      10,
      aleatorioConSemilla(1)
    );

    expect(set).toHaveLength(10);
    expect(set.filter((p) => p.uid.startsWith('a'))).toHaveLength(2);
  });

  it('devuelve menos si el catálogo no da para más (lo decide quien llama)', () => {
    const set = selectPuzzles(
      [{ source: fuente('fork', 10), puzzles: ejercicios(4, 'a') }],
      10,
      aleatorioConSemilla(1)
    );
    expect(set).toHaveLength(4);
  });

  it('nunca pasa del tamaño pedido', () => {
    const set = selectPuzzles(
      [
        { source: fuente('fork', 8), puzzles: ejercicios(50, 'a') },
        { source: fuente('pin', 8), puzzles: ejercicios(50, 'b') },
      ],
      10,
      aleatorioConSemilla(1)
    );
    expect(set).toHaveLength(10);
  });

  it('mezcla los temas en lugar de dejarlos por bloques', () => {
    const set = selectPuzzles(
      [
        { source: fuente('fork', 30), puzzles: ejercicios(30, 'a') },
        { source: fuente('pin', 30), puzzles: ejercicios(30, 'b') },
      ],
      60,
      aleatorioConSemilla(3)
    );

    const primeros30 = set.slice(0, 30);
    const deA = primeros30.filter((p) => p.uid.startsWith('a')).length;
    // Si fueran bloques saldrían 30 y 0; mezclado queda cerca de la mitad
    expect(deA).toBeGreaterThan(8);
    expect(deA).toBeLessThan(22);
  });

  it('sin archivos no hay set', () => {
    expect(selectPuzzles([], 10)).toEqual([]);
  });
});
