import { Block } from '@cpark/models';

import {
  blockPresentationImage,
  BlockPresentationSources,
  buildBlockPresentation,
} from '../../training/block-presentation.util';

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    time: 60,
    puzzlesCount: 0,
    theme: 'fork',
    elo: 1500,
    color: 'random',
    puzzles: [],
    puzzlesPlayed: [],
    ...overrides,
  };
}

/**
 * Catálogos con prefijo para que cada texto delate de qué fuente salió
 * (`tema:`, `apertura:`, `t:`), y espías para comprobar qué se consultó.
 */
function makeSources(): BlockPresentationSources & {
  themeName: jest.Mock;
  themeDescription: jest.Mock;
  openingName: jest.Mock;
  openingDescription: jest.Mock;
  translate: jest.Mock;
} {
  return {
    themeName: jest.fn((theme: string) => `tema:${theme}`),
    themeDescription: jest.fn((theme: string) => `desc-tema:${theme}`),
    openingName: jest.fn((opening: string) => `apertura:${opening}`),
    openingDescription: jest.fn((opening: string) => `desc-apertura:${opening}`),
    translate: jest.fn((key: string) => `t:${key}`),
  };
}

describe('buildBlockPresentation', () => {
  describe('título', () => {
    it('con color fijo une el nombre del tema, el conector y el color', () => {
      const sources = makeSources();

      const white = buildBlockPresentation(makeBlock({ color: 'white' }), sources);
      const black = buildBlockPresentation(makeBlock({ color: 'black' }), sources);

      expect(white.title).toBe('tema:forkt:PUZZLES.witht:PUZZLES.colors.white');
      expect(black.title).toBe('tema:forkt:PUZZLES.witht:PUZZLES.colors.black');
    });

    it('con color aleatorio queda solo el nombre del tema y no traduce el conector', () => {
      const sources = makeSources();

      const presentation = buildBlockPresentation(makeBlock({ color: 'random' }), sources);

      expect(presentation.title).toBe('tema:fork');
      expect(sources.translate).not.toHaveBeenCalledWith('PUZZLES.with');
    });

    it('el título propio del bloque manda sobre el tema y el color', () => {
      const sources = makeSources();

      const presentation = buildBlockPresentation(
        makeBlock({ title: 'Mi bloque', color: 'white' }),
        sources
      );

      expect(presentation.title).toBe('Mi bloque');
      expect(sources.translate).not.toHaveBeenCalledWith('PUZZLES.with');
    });

    it('un bloque sin tema se titula por su familia de aperturas', () => {
      const sources = makeSources();

      const presentation = buildBlockPresentation(
        makeBlock({ theme: '', openingFamily: 'Sicilian', color: 'black' }),
        sources
      );

      expect(presentation.title).toBe('apertura:Siciliant:PUZZLES.witht:PUZZLES.colors.black');
    });
  });

  describe('descripción', () => {
    it('usa la propia del bloque cuando la tiene', () => {
      const sources = makeSources();

      const presentation = buildBlockPresentation(
        makeBlock({ description: 'Texto propio' }),
        sources
      );

      expect(presentation.description).toBe('Texto propio');
      expect(sources.themeDescription).not.toHaveBeenCalled();
    });

    it('sin descripción propia toma la del catálogo del tema', () => {
      const presentation = buildBlockPresentation(makeBlock(), makeSources());

      expect(presentation.description).toBe('desc-tema:fork');
    });

    it('ignora una descripción que solo repite el color del bloque y cae al catálogo', () => {
      const white = buildBlockPresentation(
        makeBlock({ color: 'white', description: 't:PUZZLES.colors.white' }),
        makeSources()
      );
      const black = buildBlockPresentation(
        makeBlock({ color: 'black', description: 't:PUZZLES.colors.black' }),
        makeSources()
      );

      expect(white.description).toBe('desc-tema:fork');
      expect(black.description).toBe('desc-tema:fork');
    });

    it('un bloque sin tema describe su familia de aperturas', () => {
      const presentation = buildBlockPresentation(
        makeBlock({ theme: '', openingFamily: 'Sicilian', description: 't:PUZZLES.colors.white' }),
        makeSources()
      );

      expect(presentation.description).toBe('desc-apertura:Sicilian');
    });
  });

  describe('imagen', () => {
    it('cada tema lleva su propia imagen', () => {
      expect(buildBlockPresentation(makeBlock({ theme: 'fork' }), makeSources()).image).toBe(
        '/assets/images/puzzle-themes/fork.svg'
      );
      expect(blockPresentationImage('pin')).toBe('/assets/images/puzzle-themes/pin.svg');
    });

    it('todos los mates en N comparten la imagen de mate', () => {
      expect(blockPresentationImage('mateIn1')).toBe('/assets/images/puzzle-themes/mate.svg');
      expect(blockPresentationImage('mateIn3')).toBe('/assets/images/puzzle-themes/mate.svg');
    });

    it('sin tema lleva la imagen de aperturas', () => {
      expect(blockPresentationImage('')).toBe('/assets/images/puzzle-themes/opening.svg');
      expect(blockPresentationImage(undefined)).toBe('/assets/images/puzzle-themes/opening.svg');
    });
  });

  describe('qué catálogo se consulta', () => {
    it('con tema no toca el catálogo de aperturas', () => {
      const sources = makeSources();

      buildBlockPresentation(makeBlock({ theme: 'fork', openingFamily: 'Sicilian' }), sources);

      expect(sources.themeName).toHaveBeenCalledWith('fork');
      expect(sources.themeDescription).toHaveBeenCalledWith('fork');
      expect(sources.openingName).not.toHaveBeenCalled();
      expect(sources.openingDescription).not.toHaveBeenCalled();
    });

    it('sin tema no toca el catálogo de temas y pasa una cadena vacía si tampoco hay apertura', () => {
      const sources = makeSources();

      const presentation = buildBlockPresentation(makeBlock({ theme: '' }), sources);

      expect(sources.themeName).not.toHaveBeenCalled();
      expect(sources.themeDescription).not.toHaveBeenCalled();
      expect(sources.openingName).toHaveBeenCalledWith('');
      expect(sources.openingDescription).toHaveBeenCalledWith('');
      expect(presentation).toEqual({
        title: 'apertura:',
        description: 'desc-apertura:',
        image: '/assets/images/puzzle-themes/opening.svg',
      });
    });
  });

  it('devuelve exactamente los tres campos que espera el modal de presentación', () => {
    const presentation = buildBlockPresentation(makeBlock({ theme: 'mateIn2' }), makeSources());

    expect(presentation).toEqual({
      title: 'tema:mateIn2',
      description: 'desc-tema:mateIn2',
      image: '/assets/images/puzzle-themes/mate.svg',
    });
  });
});
