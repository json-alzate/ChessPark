import { buildPuzzleUrl, estimateSizeBytes, parsePuzzleUrl } from './utils';
import { ELO_CONSTANTS } from './constants';
import { Puzzle } from './types';

const CDN = 'https://cdn.jsdelivr.net/gh';
const USER = 'json-alzate';

describe('parsePuzzleUrl', () => {
  it('extrae tema y rango de ELO de una URL de tema', () => {
    const url = buildPuzzleUrl(CDN, USER, 1500, 'fork');

    expect(parsePuzzleUrl(url)).toEqual({
      theme: 'fork',
      opening: undefined,
      eloStart: 1500,
      eloEnd: 1519,
    });
  });

  it('extrae la apertura sin confundirse con sus guiones bajos', () => {
    const url = buildPuzzleUrl(CDN, USER, 1720, undefined, 'Sicilian_Defense');

    expect(parsePuzzleUrl(url)).toEqual({
      theme: undefined,
      opening: 'Sicilian_Defense',
      eloStart: 1720,
      eloEnd: 1739,
    });
  });

  it('es la inversa de buildPuzzleUrl para todo el rango de ELO', () => {
    for (let elo = ELO_CONSTANTS.MIN_ELO; elo <= ELO_CONSTANTS.MAX_ELO; elo += ELO_CONSTANTS.ELO_STEP) {
      const url = buildPuzzleUrl(CDN, USER, elo, 'mateIn2');
      const parsed = parsePuzzleUrl(url);

      expect(parsed?.theme).toBe('mateIn2');
      expect(parsed?.eloStart).toBe(elo);
      expect(parsed?.eloEnd).toBe(elo + 19);
    }
  });

  it('devuelve null si la URL no tiene rango de ELO', () => {
    expect(parsePuzzleUrl('https://cdn.jsdelivr.net/gh/json-alzate/repo/algo.json')).toBeNull();
  });

  it('recupera el rango de ELO aunque cambie la estructura de carpetas', () => {
    const parsed = parsePuzzleUrl('https://otro-cdn/loquesea/fork_1500_1519.json');

    expect(parsed).toEqual({ eloStart: 1500, eloEnd: 1519 });
  });
});

describe('estimateSizeBytes', () => {
  it('crece con el número de puzzles', () => {
    const puzzle = { uid: '00001', fen: '8/8/8/8/8/8/8/K6k w - - 0 1', moves: 'a1a2' } as Puzzle;

    const one = estimateSizeBytes([puzzle]);
    const three = estimateSizeBytes([puzzle, puzzle, puzzle]);

    expect(one).toBeGreaterThan(0);
    expect(three).toBeGreaterThan(one);
  });

  it('no falla con una lista vacía', () => {
    expect(estimateSizeBytes([])).toBe(2); // '[]'
  });
});
