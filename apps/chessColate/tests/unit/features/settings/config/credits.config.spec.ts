import {
  CREDIT_LICENSES,
  PIECE_CREDITS,
} from '@features/settings/config/credits.config';
import { MUSIC_CREDITS } from '@features/settings/config/music-credits.config';

/**
 * Guardas sobre los datos de créditos: lo que se publica en la pantalla (y en la descripción del
 * directo) no puede traer una URL rara ni una licencia que no se conoce.
 */
describe('créditos', () => {
  const licenciasConocidas = Object.keys(CREDIT_LICENSES);

  it('cada licencia enlaza a una página https', () => {
    Object.values(CREDIT_LICENSES).forEach((l) => {
      expect(l.label).not.toBe('');
      expect(l.url.startsWith('https://')).toBe(true);
    });
  });

  describe('piezas', () => {
    it('cada set tiene autor y una licencia conocida', () => {
      Object.entries(PIECE_CREDITS).forEach(([id, credito]) => {
        expect(credito.author).not.toBe('');
        expect(licenciasConocidas).toContain(credito.license);
        if (credito.url) {
          expect(credito.url.startsWith('https://')).toBe(true);
        }
        expect(id).not.toBe('staunty'); // licencia no comercial: se retiró de la app
      });
    });
  });

  describe('música', () => {
    it('hay pistas', () => {
      expect(MUSIC_CREDITS.length).toBeGreaterThan(0);
    });

    it('cada pista tiene licencia conocida y enlaza a su fuente por https', () => {
      const hosts = { ccmixter: 'ccmixter.org', commons: 'commons.wikimedia.org' };
      MUSIC_CREDITS.forEach((pista) => {
        expect(licenciasConocidas).toContain(pista.license);
        const url = new URL(pista.url);
        expect(url.protocol).toBe('https:');
        expect(url.hostname).toBe(hosts[pista.source]);
        expect(pista.title).not.toBe('');
        expect(pista.author).not.toBe('');
        expect(pista.durationSec).toBeGreaterThan(0);
      });
    });

    it('no repite pistas', () => {
      const urls = MUSIC_CREDITS.map((p) => p.url);
      expect(new Set(urls).size).toBe(urls.length);
    });
  });
});
