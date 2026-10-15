import {
  BOARD_SIZE_MAX,
  BOARD_SIZE_MIN,
  clampBoardSize,
  DEFAULT_SENSITIVITY,
  maxBoardSize,
  measureSensitivity,
  parseStoredBoardSize,
  sizeChangeToReach,
} from '@core/app/board-size.util';

describe('maxBoardSize', () => {
  it('es lo que queda de la ventana tras lo que reserva la pantalla', () => {
    expect(maxBoardSize(900, 150)).toBe(750);
    expect(maxBoardSize(900, 240)).toBe(660);
  });

  it('nunca baja del mínimo, aunque la ventana sea diminuta', () => {
    expect(maxBoardSize(300, 150)).toBe(BOARD_SIZE_MIN);
  });

  it('nunca pasa del máximo absoluto, aunque la ventana sea enorme', () => {
    expect(maxBoardSize(4000, 150)).toBe(BOARD_SIZE_MAX);
  });
});

describe('clampBoardSize', () => {
  it('deja pasar un tamaño razonable, redondeado', () => {
    expect(clampBoardSize(640.4)).toBe(640);
  });

  it('sube al mínimo y baja al máximo', () => {
    expect(clampBoardSize(100)).toBe(BOARD_SIZE_MIN);
    expect(clampBoardSize(5000)).toBe(BOARD_SIZE_MAX);
  });

  it('respeta el techo de la pantalla', () => {
    expect(clampBoardSize(900, 700)).toBe(700);
  });
});

describe('parseStoredBoardSize', () => {
  it('lee un número guardado', () => {
    expect(parseStoredBoardSize('720')).toBe(720);
  });

  it('sin nada guardado, o con basura, no hay tamaño', () => {
    expect(parseStoredBoardSize(null)).toBeNull();
    expect(parseStoredBoardSize('')).toBeNull();
    expect(parseStoredBoardSize('  ')).toBeNull();
    expect(parseStoredBoardSize('grande')).toBeNull();
    expect(parseStoredBoardSize('NaN')).toBeNull();
  });

  it('un valor fuera de los límites se descarta en vez de recortarse', () => {
    expect(parseStoredBoardSize('50')).toBeNull();
    expect(parseStoredBoardSize('99999')).toBeNull();
  });
});

describe('sizeChangeToReach', () => {
  it('con el asa pegada a la esquina (1, 1) sigue al puntero en diagonal', () => {
    expect(sizeChangeToReach({ x: 10, y: 10 }, { x: 1, y: 1 })).toBe(10);
  });

  it('con la columna centrada (0,5, 1) un movimiento vertical manda por completo', () => {
    expect(sizeChangeToReach({ x: 0, y: 40 }, DEFAULT_SENSITIVITY)).toBeCloseTo(32);
  });

  it('con la columna centrada, el horizontal pide el doble para llegar', () => {
    // El asa avanza 0,5 px por cada px de tablero: para recorrer 20 px hacen falta ~8 (mínimos cuadrados)
    expect(sizeChangeToReach({ x: 20, y: 0 }, DEFAULT_SENSITIVITY)).toBeCloseTo(8);
  });

  it('un puntero que ya está en el asa no cambia nada', () => {
    expect(sizeChangeToReach({ x: 0, y: 0 }, DEFAULT_SENSITIVITY)).toBe(0);
  });

  it('hacia atrás encoge', () => {
    expect(sizeChangeToReach({ x: -10, y: -10 }, { x: 1, y: 1 })).toBe(-10);
  });

  it('si el asa no se mueve en ningún eje no hay forma de seguir al puntero', () => {
    expect(sizeChangeToReach({ x: 30, y: 30 }, { x: 0, y: 0 })).toBe(0);
  });

  it('con la sensibilidad exacta, un paso lleva el asa al puntero', () => {
    // Si el asa se mueve (0,5, 1) por px y falta (15, 30), con +30 px de tablero llega justo
    const cambio = sizeChangeToReach({ x: 15, y: 30 }, DEFAULT_SENSITIVITY);
    expect(cambio * DEFAULT_SENSITIVITY.x).toBeCloseTo(15);
    expect(cambio * DEFAULT_SENSITIVITY.y).toBeCloseTo(30);
  });
});

describe('measureSensitivity', () => {
  it('lo que se movió el asa dividido entre lo que creció el tablero', () => {
    expect(measureSensitivity(20, { x: 10, y: 20 }, { x: 1, y: 1 })).toEqual({ x: 0.5, y: 1 });
  });

  it('un cambio de menos de un píxel no es fiable: conserva la medida anterior', () => {
    expect(measureSensitivity(0.4, { x: 5, y: 5 }, { x: 0.5, y: 1 })).toEqual({ x: 0.5, y: 1 });
  });

  it('también sirve al encoger', () => {
    expect(measureSensitivity(-20, { x: -10, y: -20 }, { x: 1, y: 1 })).toEqual({ x: 0.5, y: 1 });
  });

  it('acota valores disparatados (un panel que aparece de golpe)', () => {
    expect(measureSensitivity(2, { x: 400, y: -300 }, { x: 0.5, y: 1 })).toEqual({ x: 2, y: 0 });
  });

  it('si el asa no se movió en ningún eje conserva la anterior', () => {
    expect(measureSensitivity(30, { x: 0, y: 0 }, { x: 0.5, y: 1 })).toEqual({ x: 0.5, y: 1 });
  });
});
