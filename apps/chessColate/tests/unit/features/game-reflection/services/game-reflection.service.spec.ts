import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { ChessGame } from '@chesspark/models';

import { ProfileService } from '@core/account/profile.service';
import { GameReflectionRepository } from '@features/game-reflection/data/game-reflection.repository';
import { GameReflectionService } from '@features/game-reflection/services/game-reflection.service';

const partida = {
  id: 'q7ZvsdUF',
  source: 'lichess',
  playedAt: 10,
  result: '1-0',
  userColor: 'white',
} as ChessGame;

describe('GameReflectionService', () => {
  let service: GameReflectionService;
  let profile: { getProfile: { uid: string } | null; subscribeToProfile: jest.Mock };
  let profile$: BehaviorSubject<{ uid: string } | null>;
  const repo = {
    getReflection: jest.fn(),
    getReflections: jest.fn(),
    saveReflection: jest.fn(),
    deleteReflection: jest.fn(),
    getTags: jest.fn(),
    saveTag: jest.fn(),
  };

  beforeEach(() => {
    Object.values(repo).forEach((fn) => fn.mockReset());
    repo.getTags.mockResolvedValue([]);
    profile$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'u1' });
    profile = { getProfile: { uid: 'u1' }, subscribeToProfile: jest.fn(() => profile$) };
    TestBed.configureTestingModule({
      providers: [
        { provide: GameReflectionRepository, useValue: repo },
        { provide: ProfileService, useValue: profile },
      ],
    });
    service = TestBed.inject(GameReflectionService);
  });

  it('sin sesión no puede guardar ni lee nada', async () => {
    profile.getProfile = null;

    expect(service.canSave).toBe(false);
    expect(await service.getReflection(partida)).toBeNull();
    expect(await service.getTags()).toEqual([]);
    expect(repo.getReflection).not.toHaveBeenCalled();
    await expect(service.saveSelection(partida, { best: ['a'], improve: [] })).rejects.toThrow();
  });

  it('avisa cuando cambia la sesión y no repite el mismo uid', () => {
    const vistos: Array<string | null> = [];
    service.uid$.subscribe((uid) => vistos.push(uid));

    profile$.next({ uid: 'u1' });
    profile$.next(null);
    profile$.next({ uid: 'u2' });

    expect(vistos).toEqual(['u1', null, 'u2']);
  });

  it('lee la reflexión con la clave de la partida', async () => {
    repo.getReflection.mockResolvedValue(null);

    await service.getReflection(partida);

    expect(repo.getReflection).toHaveBeenCalledWith('u1', 'lichess:q7ZvsdUF');
  });

  it('guarda la selección con los datos de la partida', async () => {
    await service.saveSelection(partida, { best: ['dynamism'], improve: ['tactics'] });

    expect(repo.saveReflection).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        gameKey: 'lichess:q7ZvsdUF',
        outcome: 'win',
        best: ['dynamism'],
        improve: ['tactics'],
      })
    );
  });

  it('con las dos listas vacías borra la anotación en vez de guardar una vacía', async () => {
    await service.saveSelection(partida, { best: [], improve: [] });

    expect(repo.deleteReflection).toHaveBeenCalledWith('u1', 'lichess:q7ZvsdUF');
    expect(repo.saveReflection).not.toHaveBeenCalled();
  });

  it('lee los tags una sola vez mientras sea la misma cuenta', async () => {
    await service.getTags();
    await service.getTags();

    expect(repo.getTags).toHaveBeenCalledTimes(1);
  });

  it('vuelve a leer los tags si cambia la cuenta', async () => {
    await service.getTags();
    profile.getProfile = { uid: 'u2' };
    await service.getTags();

    expect(repo.getTags).toHaveBeenCalledTimes(2);
    expect(repo.getTags).toHaveBeenLastCalledWith('u2');
  });

  it('crea un tag propio con el nombre limpio y lo añade a los conocidos', async () => {
    const tag = await service.createTag('  Cambios   de dama ');

    expect(tag.label).toBe('Cambios de dama');
    expect(tag.id.startsWith('u_')).toBe(true);
    expect(repo.saveTag).toHaveBeenCalledWith('u1', tag);
    expect(await service.getTags()).toContain(tag);
  });

  it('rechaza un nombre vacío o largo sin escribir nada', async () => {
    await expect(service.createTag('   ')).rejects.toThrow();
    await expect(service.createTag('x'.repeat(21))).rejects.toThrow();
    expect(repo.saveTag).not.toHaveBeenCalled();
  });

  it('si falla al guardar el tag no lo da por creado', async () => {
    repo.saveTag.mockRejectedValue(new Error('sin red'));

    await expect(service.createTag('Nuevo')).rejects.toThrow('sin red');
    expect(await service.getTags()).toEqual([]);
  });
});
