import { WoodpeckerCycle, WoodpeckerProgress, WoodpeckerSet } from '@features/woodpecker/models/woodpecker.model';
import { isWoodpeckerProgress, isWoodpeckerSet } from '@features/woodpecker/utils/woodpecker-validation.util';

import { configuracion, conjunto, ejercicios, resultado, vuelta } from '@tests/support/pajaro-carpintero';

/**
 * Lo que se lee del dispositivo puede estar a medias o haber sido tocado: estas comprobaciones deciden
 * qué se acepta y qué se descarta.
 */

describe('isWoodpeckerSet', () => {
  const valido = (): WoodpeckerSet => conjunto(ejercicios(3));

  it('acepta un set completo', () => {
    expect(isWoodpeckerSet(valido())).toBe(true);
  });

  it.each([null, undefined, 'texto', 7, []])('descarta lo que ni es un objeto (%p)', (valor) => {
    expect(isWoodpeckerSet(valor)).toBe(false);
  });

  it('descarta un set sin ejercicios: no hay nada que jugar', () => {
    expect(isWoodpeckerSet({ ...valido(), puzzles: [] })).toBe(false);
  });

  it('descarta un ejercicio al que le falta el tablero o las jugadas', () => {
    const set = valido();

    expect(isWoodpeckerSet({ ...set, puzzles: [{ ...set.puzzles[0], fen: undefined }] })).toBe(false);
    expect(isWoodpeckerSet({ ...set, puzzles: [{ ...set.puzzles[0], moves: 3 }] })).toBe(false);
  });

  it('acepta un set armado desde un PGN propio, con o sin el nombre del archivo', () => {
    expect(isWoodpeckerSet({ ...valido(), source: 'pgn', sourceName: 'mis-tacticas.pgn' })).toBe(true);
    expect(isWoodpeckerSet({ ...valido(), source: 'pgn' })).toBe(true);
  });

  it('descarta una fuente desconocida o un nombre de archivo que no es texto', () => {
    expect(isWoodpeckerSet({ ...valido(), source: 'lichess' })).toBe(false);
    expect(isWoodpeckerSet({ ...valido(), source: 'pgn', sourceName: 7 })).toBe(false);
  });

  it('descarta un set cuya configuración no cuadra', () => {
    expect(isWoodpeckerSet({ ...valido(), config: { ...configuracion(), cycles: 'muchos' } })).toBe(false);
  });
});

describe('isWoodpeckerProgress', () => {
  const ciclo = (): WoodpeckerCycle => vuelta(1, ['p1', 'p2'], [resultado('p1', true), resultado('p2', false)], { finishedAt: 5_000 });
  const valido = (): WoodpeckerProgress => ({ setId: 'set-1', cycles: [ciclo()] });

  it('acepta un progreso con vueltas completas y uno recién empezado', () => {
    expect(isWoodpeckerProgress(valido())).toBe(true);
    expect(isWoodpeckerProgress({ setId: 'set-1', cycles: [] })).toBe(true);
  });

  it('acepta un progreso terminado y uno sin terminar', () => {
    expect(isWoodpeckerProgress({ ...valido(), completedAt: 1700000000000 })).toBe(true);
    expect(isWoodpeckerProgress({ ...valido(), completedAt: 'ayer' })).toBe(false);
  });

  it('descarta lo que no es un objeto o no trae el set', () => {
    expect(isWoodpeckerProgress(null)).toBe(false);
    expect(isWoodpeckerProgress({ cycles: [] })).toBe(false);
  });

  it('descarta una vuelta mal formada', () => {
    expect(isWoodpeckerProgress({ setId: 's', cycles: [{ ...ciclo(), order: [1, 2] }] })).toBe(false);
    expect(isWoodpeckerProgress({ setId: 's', cycles: [{ ...ciclo(), startedAt: 'hoy' }] })).toBe(false);
  });

  it('descarta un resultado al que le falta un campo', () => {
    const c = ciclo();
    const sinTiempo = { ...c, results: [{ ...c.results[0], timeMs: undefined }] };

    expect(isWoodpeckerProgress({ setId: 's', cycles: [sinTiempo] })).toBe(false);
  });
});
