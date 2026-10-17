import { TestBed } from '@angular/core/testing';

import { newCampaign } from '@features/chess-runner/campaign/runner-campaign.util';
import { BLOCK_SIZE } from '@features/chess-runner/campaign/runner-curriculum';
import { DOG_SKINS } from '@features/chess-runner/rendering/dog-skins';
import { RunnerGame } from '@features/chess-runner/game/runner-game';
import { RunnerRecordService } from '@features/chess-runner/services/runner-record.service';

/** Lo que el Chess Runner lleva de un jugador: campaña, partida en curso y récord, sin pantalla de por medio. */
const precio = (id: string) => DOG_SKINS.find((skin) => skin.id === id)!.price;

describe('RunnerGame', () => {
  let store: RunnerRecordService;
  let game: RunnerGame;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(RunnerRecordService);
    game = new RunnerGame(store);
    game.enter(1200);
  });

  afterEach(() => localStorage.clear());

  /** Resuelve ejercicios (los de repaso también) hasta cerrar el capítulo en que se va. Devuelve los eventos del que lo cierra. */
  function cerrarCapitulo() {
    for (let i = 0; i < 20; i++) {
      const eventos = game.recordSolved();
      if (eventos.some((e) => e.kind === 'chapterComplete')) {
        return eventos;
      }
    }
    throw new Error('el capítulo no se cerró');
  }

  it('arranca en el capítulo 1, sin poderes, con la partida a cero y el ELO algo por debajo del del usuario', () => {
    expect(game.level).toBe(1);
    expect(game.rating).toBe(900);
    expect(store.loadCampaign().rating).toBe(900);
    expect(game.step.kind).toBe('block');
    expect(game.campaign.powers).toEqual([]);
    expect(game.session.hearts).toBe(game.mods.maxHearts);
    expect(game.session.meters).toBe(0);
  });

  it('resolver avanza el bloque y lo guarda; fallar no avanza', () => {
    game.recordSolved();
    expect(game.step.index).toBe(1);
    expect(store.loadCampaign().solvedInBlock).toBe(1);

    game.recordFailed();
    expect(game.step.index).toBe(1);
    expect(game.session.strikes).toBe(1);
  });

  it('la partida pierde con tres fallos', () => {
    game.recordFailed();
    game.recordFailed();
    expect(game.session.outOfStrikes).toBe(false);
    game.recordFailed();
    expect(game.session.outOfStrikes).toBe(true);
  });

  it('cerrar el primer capítulo pasa al siguiente sin poder; el segundo sí lo da', () => {
    for (let i = 0; i < BLOCK_SIZE - 1; i++) {
      expect(game.recordSolved().filter((e) => e.kind !== 'rating')).toEqual([]);
    }
    const primero = game.recordSolved();

    expect(primero.some((e) => e.kind === 'chapterComplete')).toBe(true);
    expect(game.campaign.powers).toEqual([]);
    expect(game.level).toBe(2);

    const segundo = cerrarCapitulo();
    expect(segundo).toContainEqual(expect.objectContaining({ kind: 'chapterComplete', firstTime: true }));
    expect(game.campaign.powers).toHaveLength(1);
  });

  it('un poder que da un corazón de más lo trae ya lleno a la partida en curso', () => {
    const antes = game.session.hearts;
    // El poder del corazón está en algún capítulo: se cierran hasta que aparezca
    let guardia = 25;
    while (game.mods.maxHearts === antes && guardia-- > 0) {
      cerrarCapitulo();
    }

    expect(game.mods.maxHearts).toBeGreaterThan(antes);
    expect(game.session.hearts).toBe(game.mods.maxHearts);
  });

  it('el ELO que se pide es el del perrito más el desvío del puesto', () => {
    expect(game.targetRating).toBe(900 + game.step.eloOffset);
  });

  it('resolver un ejercicio sube el ELO, fallar lo baja, y se guarda', () => {
    const events = game.recordSolved(1000);
    expect(events).toContainEqual(expect.objectContaining({ kind: 'rating' }));
    const subido = game.rating;
    expect(subido).toBeGreaterThan(900);
    expect(store.loadCampaign().rating).toBe(subido);

    game.recordFailed(1000);
    expect(game.rating).toBeLessThan(subido);
  });

  it('el ELO que se pide nunca se sale de lo que tiene el catálogo, ni con un perrito muy flojo ni con uno de maestro', () => {
    game.campaign = { ...game.campaign, rating: 450 };
    expect(game.targetRating).toBe(400);
    expect(game.after(false, 800).elo).toBe(400);

    game.campaign = { ...game.campaign, rating: 2600, chapter: 4, solvedInBlock: 4 };
    expect(game.targetRating).toBeLessThanOrEqual(2800);
    game.campaign = { ...game.campaign, rating: 2790 };
    expect(game.targetRating).toBe(2800);
  });

  it('after muestra lo que seguiría sin tocar la campaña', () => {
    const antes = game.campaign;
    const siguiente = game.after(true, 1000);

    expect(siguiente.step.index).toBe(1);
    expect(siguiente.elo).toBe(game.after(true, 1000).elo);
    expect(siguiente.elo).toBeGreaterThan(game.targetRating - 200);
    expect(game.campaign).toBe(antes);
  });

  it('see apunta lo visto y lo guarda', () => {
    expect(game.hasSeen('prologue')).toBe(false);

    game.see('prologue', 'intro:0');

    expect(game.hasSeen('prologue')).toBe(true);
    expect(game.hasSeen('intro:0')).toBe(true);
    expect(store.loadCampaign().seen).toEqual(expect.arrayContaining(['prologue', 'intro:0']));
  });

  it('bank suma los metros a la partida y los guarda como récord si lo son', () => {
    game.bank(80);
    game.bank(50);

    expect(game.session.meters).toBe(130);
    expect(game.record).toBe(130);
    expect(store.best()).toBe(130);
  });

  it('saveRecord dice si supera el récord', () => {
    expect(game.saveRecord(200)).toBe(true);
    expect(game.saveRecord(150)).toBe(false);
    expect(game.record).toBe(200);
  });

  it('newMatch reinicia la partida pero conserva campaña y récord', () => {
    game.recordSolved();
    game.recordFailed();
    game.bank(90);

    game.newMatch();

    expect(game.session.strikes).toBe(0);
    expect(game.session.meters).toBe(0);
    expect(game.campaign.solvedInBlock).toBe(1);
    expect(game.record).toBe(90);
  });

  it('enter vuelve a leer lo guardado', () => {
    store.saveCampaign({ ...newCampaign(), chapter: 3, rating: 1300, peakRating: 1300 });

    game.enter(1200);

    expect(game.level).toBe(4);
    expect(game.rating).toBe(1300);
  });

  describe('galletas y pelajes', () => {
    it('las galletas que se ganan se guardan, y lo guardado se queda aunque se cierre', () => {
      game.earn(40);
      game.earn(0);
      game.earn(-5);

      expect(game.wallet).toBe(40);
      expect(store.loadCampaign().cookies).toBe(40);
    });

    it('con galletas de sobra se compra un pelaje, se paga y se lo pone', () => {
      game.earn(precio('golden') + 50);

      expect(game.canBuy('golden')).toBe(true);
      expect(game.buy('golden')).toBe(true);

      expect(game.wallet).toBe(50);
      expect(game.skin).toBe('golden');
      expect(game.campaign.skins).toEqual(['choco', 'golden']);
      expect(store.loadCampaign().skin).toBe('golden');
    });

    it('no se compra lo que no alcanza, lo que ya se tiene ni lo que no existe', () => {
      game.earn(precio('golden') - 1);

      expect(game.buy('golden')).toBe(false);
      expect(game.buy('volador')).toBe(false);
      game.earn(51);
      expect(game.buy('golden')).toBe(true);
      expect(game.canBuy('golden')).toBe(false);
      expect(game.buy('golden')).toBe(false);
      expect(game.wallet).toBe(50);
    });

    it('se cambia entre los pelajes que ya se tienen, pero no a uno que no', () => {
      game.earn(precio('golden') + precio('snow'));
      game.buy('golden');
      game.buy('snow');

      expect(game.select('choco')).toBe(true);
      expect(game.skin).toBe('choco');
      expect(game.select('golden')).toBe(true);
      expect(game.select('night')).toBe(false);
      expect(game.skin).toBe('golden');
    });

    it('el armario dice de cada pelaje si está puesto, es tuyo, alcanza o falta', () => {
      game.earn(precio('golden') + precio('snow'));
      game.buy('golden');

      const estados = Object.fromEntries(game.wardrobe.map((p) => [p.id, p.state]));

      expect(estados).toEqual({ choco: 'owned', golden: 'worn', snow: 'affordable', night: 'locked', berry: 'locked', sky: 'locked' });
    });
  });

  describe('días seguidos', () => {
    it('resolver un ejercicio cuenta como jugar hoy; otro el mismo día no suma, el día siguiente sí', () => {
      game.today = () => '2026-05-01';
      game.recordSolved();
      expect(game.dayStreak).toBe(1);
      game.recordSolved();
      expect(game.dayStreak).toBe(1);

      game.today = () => '2026-05-02';
      expect(game.dayStreak).toBe(1);
      game.recordSolved();

      expect(game.dayStreak).toBe(2);
      expect(store.loadCampaign()).toMatchObject({ days: 2, lastDay: '2026-05-02' });
    });

    it('fallar no cuenta, y si pasan días sin jugar la racha se rompe', () => {
      game.today = () => '2026-05-01';
      game.recordFailed();
      expect(game.dayStreak).toBe(0);
      game.recordSolved();
      expect(game.dayStreak).toBe(1);

      game.today = () => '2026-05-05';
      expect(game.dayStreak).toBe(0);
      game.recordSolved();
      expect(game.dayStreak).toBe(1);
    });
  });
});
