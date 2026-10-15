import { GESTURE_SWIPE_PX } from '@features/chess-runner/config/runner.config';
import {
  classifySwipe,
  keyCommand,
  logicalWidth,
  runnerScale,
} from '@features/chess-runner/utils/runner-input.util';

describe('classifySwipe', () => {
  const N = GESTURE_SWIPE_PX;

  it('un arrastre corto sigue siendo un toque', () => {
    expect(classifySwipe(3, 5)).toBeNull();
    expect(classifySwipe(0, N - 1)).toBeNull();
  });

  it('hacia abajo es agacharse', () => {
    expect(classifySwipe(0, N)).toBe('slide');
    expect(classifySwipe(4, 40)).toBe('slide');
    expect(classifySwipe(-6, 40)).toBe('slide');
  });

  it('más horizontal que vertical no es agacharse', () => {
    expect(classifySwipe(50, 20)).toBeNull();
  });

  it('hacia arriba y a la derecha es salto largo', () => {
    expect(classifySwipe(30, -20)).toBe('longJump');
    expect(classifySwipe(N, -N)).toBe('longJump');
  });

  it('hacia arriba a la izquierda no es nada (el juego solo corre hacia la derecha)', () => {
    expect(classifySwipe(-30, -30)).toBeNull();
  });

  it('solo hacia la derecha, sin subir, no es salto largo', () => {
    expect(classifySwipe(40, 0)).toBeNull();
  });

  it('solo hacia arriba no es salto largo: eso es un toque', () => {
    expect(classifySwipe(0, -40)).toBeNull();
  });
});

describe('keyCommand', () => {
  it.each([[' '], ['ArrowUp'], ['w'], ['W']])('%j salta y mantiene en el aire', (tecla) => {
    expect(keyCommand(tecla)).toEqual({ action: 'jump', holds: true });
  });

  it.each([['ArrowDown'], ['s'], ['S']])('%j agacha', (tecla) => {
    expect(keyCommand(tecla)).toEqual({ action: 'slide', holds: false });
  });

  it.each([['ArrowRight'], ['d'], ['D']])('%j hace el salto largo', (tecla) => {
    expect(keyCommand(tecla)).toEqual({ action: 'longJump', holds: false });
  });

  it('otras teclas no hacen nada', () => {
    expect(keyCommand('a')).toBeNull();
    expect(keyCommand('Enter')).toBeNull();
    expect(keyCommand('Tab')).toBeNull();
  });
});

describe('escala del lienzo', () => {
  it('un móvil se pinta a 2×, un portátil a 3× y una pantalla grande a 4×', () => {
    expect(runnerScale(393)).toBe(2);
    expect(runnerScale(640)).toBe(3);
    expect(runnerScale(960)).toBe(4);
  });

  it('nunca baja de 1×', () => {
    expect(runnerScale(120)).toBe(1);
    expect(runnerScale(0)).toBe(1);
  });

  it('el ancho lógico queda en un rango en el que el juego es jugable (160 a 280 px)', () => {
    // Más estrecho no deja ver venir el obstáculo; más ancho lo aleja demasiado de Chocolate
    for (let ancho = 330; ancho <= 1280; ancho += 4) {
      expect(logicalWidth(ancho)).toBeGreaterThanOrEqual(160);
      expect(logicalWidth(ancho)).toBeLessThanOrEqual(280);
    }
  });

  it('el ancho lógico por la escala nunca se pasa del ancho de pantalla', () => {
    for (const ancho of [320, 393, 480, 640, 768, 1024]) {
      expect(logicalWidth(ancho) * runnerScale(ancho)).toBeLessThanOrEqual(ancho);
    }
  });
});
