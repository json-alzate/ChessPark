import { GameHeader } from '@chesspark/games-provider';

import {
  EMPTY_FILTERS,
  buildPlayOrder,
  filterGames,
  formatBytes,
  nextPosition,
  opponentOf,
  outcomeFor,
  playedColor,
} from './games.util';

/** Cabecera de ejemplo, con lo mínimo para filtrar. */
function headerWith(overrides: Partial<GameHeader> = {}): GameHeader {
  return {
    index: 0,
    white: 'Petrosian, Tigran V',
    black: 'Botvinnik, Mikhail',
    event: 'Moscow',
    date: '1963.05.20',
    year: 1963,
    result: '1-0',
    whiteElo: null,
    blackElo: null,
    plies: 40,
    ...overrides,
  };
}

describe('playedColor', () => {
  it('reconoce al dueño de la colección por el apellido', () => {
    expect(playedColor(headerWith(), 'petrosian')).toBe('white');
    expect(
      playedColor(
        headerWith({ white: 'Spassky, Boris', black: 'Petrosian, Tigran V' }),
        'petrosian'
      )
    ).toBe('black');
  });

  it('devuelve null si no juega ninguno de los dos', () => {
    expect(playedColor(headerWith(), 'fischer')).toBeNull();
  });
});

describe('opponentOf', () => {
  it('devuelve al rival, juegue con el color que juegue', () => {
    expect(opponentOf(headerWith(), 'petrosian')).toBe('Botvinnik, Mikhail');
    expect(
      opponentOf(
        headerWith({ white: 'Spassky, Boris', black: 'Petrosian, Tigran V' }),
        'petrosian'
      )
    ).toBe('Spassky, Boris');
  });
});

describe('outcomeFor', () => {
  it('sabe si ganó con blancas o con negras', () => {
    expect(outcomeFor(headerWith({ result: '1-0' }), 'petrosian')).toBe('won');
    expect(outcomeFor(headerWith({ result: '0-1' }), 'petrosian')).toBe('lost');
    expect(
      outcomeFor(
        headerWith({
          white: 'Spassky, Boris',
          black: 'Petrosian, Tigran V',
          result: '0-1',
        }),
        'petrosian'
      )
    ).toBe('won');
  });

  it('las tablas son tablas para los dos', () => {
    expect(outcomeFor(headerWith({ result: '1/2-1/2' }), 'petrosian')).toBe(
      'drawn'
    );
  });

  it('una partida sin resultado no cuenta', () => {
    expect(outcomeFor(headerWith({ result: '*' }), 'petrosian')).toBeNull();
  });
});

describe('filterGames', () => {
  const games = [
    headerWith({ index: 0, black: 'Botvinnik, Mikhail', result: '1-0' }),
    headerWith({ index: 1, black: 'Fischer, Robert James', result: '1/2-1/2' }),
    headerWith({
      index: 2,
      white: 'Spassky, Boris',
      black: 'Petrosian, Tigran V',
      result: '1-0',
    }),
  ];

  it('sin filtros pasan todas', () => {
    expect(filterGames(games, 'petrosian', EMPTY_FILTERS)).toHaveLength(3);
  });

  it('busca por rival sin distinguir mayúsculas', () => {
    const found = filterGames(games, 'petrosian', {
      ...EMPTY_FILTERS,
      opponent: 'botvinnik',
    });

    expect(found).toHaveLength(1);
    expect(found[0].index).toBe(0);
  });

  it('filtra por color', () => {
    const withBlack = filterGames(games, 'petrosian', {
      ...EMPTY_FILTERS,
      color: 'black',
    });

    expect(withBlack.map((game) => game.index)).toEqual([2]);
  });

  it('filtra por resultado desde el punto de vista del jugador', () => {
    const won = filterGames(games, 'petrosian', {
      ...EMPTY_FILTERS,
      result: 'won',
    });

    expect(won.map((game) => game.index)).toEqual([0]);
  });

  it('combina los filtros', () => {
    const found = filterGames(games, 'petrosian', {
      opponent: 'fischer',
      result: 'drawn',
      color: 'white',
    });

    expect(found.map((game) => game.index)).toEqual([1]);
  });
});

describe('buildPlayOrder', () => {
  const games = [
    headerWith({ index: 0 }),
    headerWith({ index: 1 }),
    headerWith({ index: 2 }),
  ];

  it('sin aleatorio respeta el orden del archivo', () => {
    expect(buildPlayOrder(games, false)).toEqual([0, 1, 2]);
  });

  it('con aleatorio conserva todas las partidas', () => {
    expect(buildPlayOrder(games, true).sort()).toEqual([0, 1, 2]);
  });
});

describe('nextPosition', () => {
  it('avanza mientras queden partidas', () => {
    expect(nextPosition(0, 3, false)).toBe(1);
  });

  it('vuelve al principio si la repetición está activa', () => {
    expect(nextPosition(2, 3, true)).toBe(0);
  });

  it('se acaba si la repetición está apagada', () => {
    expect(nextPosition(2, 3, false)).toBeNull();
  });

  it('una colección vacía no tiene siguiente', () => {
    expect(nextPosition(0, 0, true)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('usa megabytes a partir de uno', () => {
    expect(formatBytes(1130944)).toBe('1,1 MB');
  });

  it('usa kilobytes por debajo', () => {
    expect(formatBytes(430000)).toBe('420 KB');
  });
});
