import { CampaignStep } from '@features/chess-runner/campaign/runner-campaign.model';
import { markSeen, newCampaign } from '@features/chess-runner/campaign/runner-campaign.util';
import { nextBeat, seenKeys } from '@features/chess-runner/campaign/runner-beats.util';

const bloque = (chapter: number, index = 0, theme = 'fork'): CampaignStep => ({
  kind: 'block',
  chapter,
  theme,
  index,
  total: 5,
  eloOffset: 0,
});
const repaso = (theme = 'fork', index = 0): CampaignStep => ({ kind: 'review', chapter: 2, theme, index, total: 2, eloOffset: -100 });

const vistas = (...claves: string[]) => claves.reduce((campaign, clave) => markSeen(campaign, clave), newCampaign());

describe('qué se enseña antes de correr', () => {
  it('lo primero de todo, en la primera carrera de la vida: el prólogo de la historia', () => {
    const beat = nextBeat(newCampaign(), bloque(0, 0, 'hangingPiece'), true);

    expect(beat).toEqual({ kind: 'prologue', seen: [seenKeys.prologue, seenKeys.intro(0)] });
  });

  it('el prólogo da por vista la llegada al primer mundo: después va directo a la lección', () => {
    const campaign = vistas(seenKeys.prologue, seenKeys.intro(0));

    expect(nextBeat(campaign, bloque(0, 0, 'hangingPiece'), true)).toEqual({
      kind: 'lesson',
      theme: 'hangingPiece',
      seen: [seenKeys.lesson('hangingPiece')],
    });
  });

  it('el prólogo solo sale con la campaña recién empezada', () => {
    const avanzada = { ...newCampaign(), puzzles: 3 };

    expect(nextBeat(avanzada, bloque(0, 0, 'hangingPiece'), false)).toEqual({ kind: 'intro', chapter: 0, seen: [seenKeys.intro(0)] });
  });

  it('cada capítulo nuevo empieza con la llegada al mundo, y después su lección', () => {
    const campaign = { ...vistas(seenKeys.prologue), puzzles: 12, chapter: 2 };

    const primero = nextBeat(campaign, bloque(2, 0, 'pin'), true);
    expect(primero).toEqual({ kind: 'intro', chapter: 2, seen: ['intro:2'] });

    const segundo = nextBeat(markSeen(campaign, 'intro:2'), bloque(2, 0, 'pin'), true);
    expect(segundo).toEqual({ kind: 'lesson', theme: 'pin', seen: ['lesson:pin'] });

    expect(nextBeat(markSeen(markSeen(campaign, 'intro:2'), 'lesson:pin'), bloque(2, 0, 'pin'), true)).toBeNull();
  });

  it('a mitad de un bloque no se interrumpe nunca, aunque no se haya visto nada', () => {
    expect(nextBeat(newCampaign(), bloque(0, 2), true)).toBeNull();
    expect(nextBeat({ ...newCampaign(), puzzles: 4 }, bloque(3, 4), true)).toBeNull();
  });

  it('un patrón sin lección salta directo a la carrera tras la llegada', () => {
    const campaign = { ...vistas('intro:4'), puzzles: 20, chapter: 4 };

    expect(nextBeat(campaign, bloque(4, 0, 'endgame'), false)).toBeNull();
  });

  describe('los repasos', () => {
    const campaign = { ...vistas(seenKeys.prologue), puzzles: 12 };

    it('no traen la llegada a un mundo (ya se estuvo): solo la lección, una vez', () => {
      expect(nextBeat(campaign, repaso('fork'), true)).toEqual({ kind: 'lesson', theme: 'fork', seen: ['review:fork'] });
      expect(nextBeat(markSeen(campaign, 'review:fork'), repaso('fork'), true)).toBeNull();
    });

    it('la lección de repaso es aparte de la del capítulo: haber visto una no cuenta como la otra', () => {
      const conLeccion = markSeen(campaign, 'lesson:fork');

      expect(nextBeat(conLeccion, repaso('fork'), true)).not.toBeNull();
    });

    it('el segundo ejercicio de un repaso no interrumpe', () => {
      expect(nextBeat(campaign, repaso('fork', 1), true)).toBeNull();
    });
  });

  it('las claves de lo visto son distintas para cada cosa', () => {
    const claves = [
      seenKeys.prologue,
      seenKeys.epilogue,
      seenKeys.intro(0),
      seenKeys.intro(1),
      seenKeys.lesson('fork'),
      seenKeys.review('fork'),
    ];

    expect(new Set(claves).size).toBe(claves.length);
  });
});
