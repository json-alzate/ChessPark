import { fitScale } from '@core/stage/stage-scale.util';

describe('fitScale', () => {
  it('no escala cuando la ventana es exactamente el lienzo', () => {
    expect(fitScale(1920, 1080)).toBe(1);
  });

  it('encoge según el lado más limitante', () => {
    expect(fitScale(960, 1080)).toBe(0.5);
    expect(fitScale(1920, 540)).toBe(0.5);
  });

  it('no agranda por encima de 1 en pantallas más grandes', () => {
    expect(fitScale(3840, 2160)).toBe(1);
  });

  it('con una ventana sin tamaño devuelve 1 en lugar de 0 o NaN', () => {
    expect(fitScale(0, 0)).toBe(1);
  });
});
