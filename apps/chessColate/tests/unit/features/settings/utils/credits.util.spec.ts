import type { MusicCredit } from '@features/settings/models/credits.model';
import {
  countAuthors,
  formatDuration,
  groupMusicByLicense,
} from '@features/settings/utils/credits.util';

function pista(extra: Partial<MusicCredit> = {}): MusicCredit {
  return {
    title: 'Pista',
    author: 'Autor',
    source: 'ccmixter',
    url: 'https://ccmixter.org/files/a/1',
    license: 'CC-BY-3.0',
    durationSec: 200,
    ...extra,
  };
}

describe('credits.util', () => {
  describe('groupMusicByLicense', () => {
    it('agrupa por licencia en el orden fijo, con las que exigen atribución primero', () => {
      const grupos = groupMusicByLicense([
        pista({ license: 'CC0-1.0', title: 'c' }),
        pista({ license: 'CC-BY-4.0', title: 'b' }),
        pista({ license: 'CC-BY-3.0', title: 'a' }),
      ]);

      expect(grupos.map((g) => g.license)).toEqual(['CC-BY-3.0', 'CC-BY-4.0', 'CC0-1.0']);
      expect(grupos.map((g) => g.tracks[0].title)).toEqual(['a', 'b', 'c']);
    });

    it('omite las licencias sin pistas y conserva el orden de las pistas dentro de cada grupo', () => {
      const grupos = groupMusicByLicense([
        pista({ title: 'uno' }),
        pista({ title: 'dos' }),
      ]);

      expect(grupos).toHaveLength(1);
      expect(grupos[0].tracks.map((t) => t.title)).toEqual(['uno', 'dos']);
    });

    it('sin pistas no hay grupos', () => {
      expect(groupMusicByLicense([])).toEqual([]);
    });
  });

  describe('countAuthors', () => {
    it('cuenta autores distintos, no pistas', () => {
      expect(
        countAuthors([pista({ author: 'A' }), pista({ author: 'A' }), pista({ author: 'B' })])
      ).toBe(2);
    });
  });

  describe('formatDuration', () => {
    it.each([
      [0, '0:00'],
      [5, '0:05'],
      [225, '3:45'],
      [600, '10:00'],
      [59.6, '1:00'],
      [-3, '0:00'],
    ])('%s s → %s', (segundos, esperado) => {
      expect(formatDuration(segundos)).toBe(esperado);
    });
  });
});
