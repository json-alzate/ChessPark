import { ChessGame } from '@chesspark/models';

import { GameReflection, GameTag } from '@features/game-reflection/models/game-reflection.model';
import {
  addTagToSelection,
  buildReflection,
  buildTagOptions,
  cleanTagLabel,
  findTagByLabel,
  gameKeyOf,
  isCustomTagId,
  isSelectionEmpty,
  isValidTagLabel,
  labelOfTag,
  newCustomTagId,
  remainingSlots,
  removeTagFromSelection,
  selectionOf,
  summarizeTags,
  tagSearchKey,
} from '@features/game-reflection/utils/game-reflection.util';

const systemLabel = (key: string): string =>
  ({ tactics: 'Táctica', endgames: 'Finales', dynamism: 'Dinamismo' } as Record<string, string>)[key] ?? key;

function tag(id: string, label: string, createdAt = 1, archived = false): GameTag {
  return { id, label, createdAt, archived };
}

function partida(overrides: Partial<ChessGame> = {}): ChessGame {
  return {
    id: 'q7ZvsdUF',
    source: 'lichess',
    pgn: '',
    timeControl: '300+0',
    timeControlSeconds: 300,
    incrementSeconds: 0,
    timeClass: 'blitz',
    playedAt: 1_700_000_000_000,
    white: { username: 'yo', rating: 1500 },
    black: { username: 'rival', rating: 1500 },
    result: '1-0',
    userColor: 'white',
    variant: 'standard',
    analyzed: false,
    ...overrides,
  };
}

function reflexion(overrides: Partial<GameReflection> = {}): GameReflection {
  return {
    gameKey: 'lichess:a',
    platform: 'lichess',
    playedAt: 1,
    outcome: 'win',
    best: [],
    improve: [],
    updatedAt: 1,
    ...overrides,
  };
}

describe('game-reflection.util', () => {
  describe('gameKeyOf', () => {
    it('antepone la plataforma al id para que no choquen entre ellas', () => {
      expect(gameKeyOf(partida())).toBe('lichess:q7ZvsdUF');
      expect(gameKeyOf(partida({ source: 'chess.com', id: 'abc-123' }))).toBe('chesscom:abc-123');
    });

    it('cambia las barras, que un id de documento no admite', () => {
      const key = gameKeyOf(partida({ source: 'chess.com', id: 'https://www.chess.com/game/live/9' }));

      expect(key).not.toContain('/');
    });

    it('da la misma clave para la misma partida las veces que se calcule', () => {
      expect(gameKeyOf(partida())).toBe(gameKeyOf(partida({ pgn: 'otro' })));
    });
  });

  describe('nombres de tag', () => {
    it('limpia los espacios de más', () => {
      expect(cleanTagLabel('  Cambios   de dama ')).toBe('Cambios de dama');
    });

    it('compara sin mayúsculas ni tildes', () => {
      expect(tagSearchKey('Táctica')).toBe(tagSearchKey(' tactica '));
    });

    it('acepta un nombre corto y rechaza vacío o demasiado largo', () => {
      expect(isValidTagLabel('Finales')).toBe(true);
      expect(isValidTagLabel('   ')).toBe(false);
      expect(isValidTagLabel('x'.repeat(21))).toBe(false);
      expect(isValidTagLabel('x'.repeat(20))).toBe(true);
    });

    it('crea ids propios que se reconocen como tales', () => {
      const id = newCustomTagId();

      expect(isCustomTagId(id)).toBe(true);
      expect(isCustomTagId('tactics')).toBe(false);
    });

    it('crea ids distintos cada vez', () => {
      expect(newCustomTagId()).not.toBe(newCustomTagId());
    });
  });

  describe('selección', () => {
    it('lo mejor admite 2 y lo que mejorar admite 3', () => {
      let sel = selectionOf(null);
      sel = addTagToSelection(sel, 'best', 'a');
      sel = addTagToSelection(sel, 'best', 'b');
      sel = addTagToSelection(sel, 'best', 'c');
      expect(sel.best).toEqual(['a', 'b']);

      sel = addTagToSelection(sel, 'improve', 'd');
      sel = addTagToSelection(sel, 'improve', 'e');
      sel = addTagToSelection(sel, 'improve', 'f');
      sel = addTagToSelection(sel, 'improve', 'g');
      expect(sel.improve).toEqual(['d', 'e', 'f']);
    });

    it('un tag no puede estar en las dos listas', () => {
      let sel = addTagToSelection(selectionOf(null), 'best', 'tactics');
      sel = addTagToSelection(sel, 'improve', 'tactics');

      expect(sel.improve).toEqual([]);
    });

    it('no repite un tag dentro de la misma lista', () => {
      let sel = addTagToSelection(selectionOf(null), 'improve', 'a');
      sel = addTagToSelection(sel, 'improve', 'a');

      expect(sel.improve).toEqual(['a']);
    });

    it('quita un tag sin tocar la otra lista', () => {
      const sel = removeTagFromSelection({ best: ['a'], improve: ['b', 'c'] }, 'improve', 'b');

      expect(sel).toEqual({ best: ['a'], improve: ['c'] });
    });

    it('no modifica la selección original al añadir', () => {
      const original = selectionOf(null);

      addTagToSelection(original, 'best', 'a');

      expect(original.best).toEqual([]);
    });

    it('cuenta los huecos que quedan', () => {
      expect(remainingSlots({ best: ['a'], improve: [] }, 'best')).toBe(1);
      expect(remainingSlots({ best: [], improve: ['a', 'b', 'c'] }, 'improve')).toBe(0);
    });

    it('sabe cuándo no hay nada marcado', () => {
      expect(isSelectionEmpty({ best: [], improve: [] })).toBe(true);
      expect(isSelectionEmpty({ best: [], improve: ['a'] })).toBe(false);
    });
  });

  describe('buildTagOptions', () => {
    const propios = [tag('u_1', 'Cambios de dama', 1), tag('u_2', 'Apertura', 5), tag('u_3', 'Viejo', 9, true)];

    it('sin texto ofrece primero los propios más recientes y luego los del sistema', () => {
      const ids = buildTagOptions({ query: '', customTags: propios, systemLabel, chosen: [] }).map((o) => o.id);

      expect(ids.slice(0, 2)).toEqual(['u_2', 'u_1']);
      expect(ids).toContain('tactics');
    });

    it('oculta los archivados', () => {
      const ids = buildTagOptions({ query: '', customTags: propios, systemLabel, chosen: [] }).map((o) => o.id);

      expect(ids).not.toContain('u_3');
    });

    it('deja fuera lo ya elegido', () => {
      const ids = buildTagOptions({ query: '', customTags: propios, systemLabel, chosen: ['u_2', 'tactics'] }).map(
        (o) => o.id
      );

      expect(ids).not.toContain('u_2');
      expect(ids).not.toContain('tactics');
    });

    it('al escribir filtra sin importar tildes y pone antes lo que empieza igual', () => {
      const opciones = buildTagOptions({
        query: 'tact',
        customTags: [tag('u_1', 'Mi táctica', 1)],
        systemLabel,
        chosen: [],
      });

      expect(opciones.map((o) => o.id)).toEqual(['tactics', 'u_1']);
    });

    it('no ofrece nada si el texto no coincide', () => {
      expect(buildTagOptions({ query: 'zzz', customTags: propios, systemLabel, chosen: [] })).toEqual([]);
    });
  });

  describe('findTagByLabel', () => {
    it('encuentra un tag propio aunque cambien mayúsculas y tildes', () => {
      const found = findTagByLabel('CAMBIOS DE DAMA', [tag('u_1', 'Cambios de dama')], systemLabel);

      expect(found?.id).toBe('u_1');
    });

    it('encuentra uno del sistema por su texto traducido', () => {
      const found = findTagByLabel('tactica', [], systemLabel);

      expect(found).toEqual({ id: 'tactics', label: 'Táctica', system: true });
    });

    it('devuelve null si no existe o el texto está vacío', () => {
      expect(findTagByLabel('inventado', [], systemLabel)).toBeNull();
      expect(findTagByLabel('  ', [], systemLabel)).toBeNull();
    });
  });

  describe('labelOfTag', () => {
    it('muestra el texto propio tal cual y el del sistema traducido', () => {
      const propios = [tag('u_1', 'Mi tag')];

      expect(labelOfTag('u_1', propios, systemLabel)).toBe('Mi tag');
      expect(labelOfTag('endgames', propios, systemLabel)).toBe('Finales');
    });

    it('devuelve vacío si el tag ya no existe', () => {
      expect(labelOfTag('u_borrado', [], systemLabel)).toBe('');
      expect(labelOfTag('no_existe', [], systemLabel)).toBe('');
    });
  });

  describe('buildReflection', () => {
    it('copia plataforma, fecha y resultado visto desde el color del usuario', () => {
      const r = buildReflection(
        partida({ result: '0-1', userColor: 'black' }),
        { best: ['dynamism'], improve: ['u_1'] },
        42
      );

      expect(r).toEqual({
        gameKey: 'lichess:q7ZvsdUF',
        platform: 'lichess',
        playedAt: 1_700_000_000_000,
        outcome: 'win',
        best: ['dynamism'],
        improve: ['u_1'],
        updatedAt: 42,
      });
    });

    it('marca derrota cuando el resultado va contra su color', () => {
      expect(buildReflection(partida({ result: '0-1' }), { best: [], improve: ['a'] }, 1).outcome).toBe('loss');
    });
  });

  describe('summarizeTags', () => {
    const todas = [
      reflexion({ improve: ['tactics', 'endgames'], outcome: 'loss' }),
      reflexion({ improve: ['tactics'], outcome: 'win' }),
      reflexion({ improve: ['tactics'], outcome: 'loss', best: ['dynamism'] }),
    ];

    it('ordena por frecuencia y reparte los resultados', () => {
      const resumen = summarizeTags(todas, 'improve');

      expect(resumen[0]).toEqual({ id: 'tactics', count: 3, outcomes: { win: 1, draw: 0, loss: 2 } });
      expect(resumen[1].id).toBe('endgames');
    });

    it('solo cuenta la lista pedida', () => {
      expect(summarizeTags(todas, 'best').map((u) => u.id)).toEqual(['dynamism']);
    });

    it('sin reflexiones devuelve vacío', () => {
      expect(summarizeTags([], 'best')).toEqual([]);
    });
  });
});
