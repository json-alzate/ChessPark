import { isJumpKey, logicalWidth, runnerScale } from '@features/chess-runner/utils/runner-input.util';

describe('isJumpKey', () => {
  it.each([[' '], ['Spacebar'], ['ArrowUp'], ['w'], ['W']])('%j hace saltar', (tecla) => {
    expect(isJumpKey(tecla)).toBe(true);
  });

  it.each([['ArrowDown'], ['ArrowRight'], ['s'], ['d'], ['Enter'], ['Tab'], ['a']])(
    '%j no hace nada: solo hay un control',
    (tecla) => {
      expect(isJumpKey(tecla)).toBe(false);
    }
  );
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
    // Más estrecho no deja ver venir el obstáculo; más ancho lo aleja demasiado del perrito
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
