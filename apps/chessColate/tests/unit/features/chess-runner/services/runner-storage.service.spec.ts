import { RunnerStorageService } from '@features/chess-runner/services/runner-storage.service';

const KEY = 'chessColate_runner_tutorial_seen';

describe('RunnerStorageService', () => {
  let service: RunnerStorageService;

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new RunnerStorageService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('al principio el tutorial no está visto', () => {
    expect(service.isTutorialSeen()).toBe(false);
  });

  it('marcarlo lo deja visto, también para el próximo arranque', () => {
    service.markTutorialSeen();

    expect(service.isTutorialSeen()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('true');
    expect(new RunnerStorageService().isTutorialSeen()).toBe(true);
  });

  it('solo cuenta el valor exacto: un dato raro no lo da por visto', () => {
    localStorage.setItem(KEY, 'quizá');
    expect(service.isTutorialSeen()).toBe(false);
  });

  it('si el almacenamiento no se puede leer no se insiste con el tutorial', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin acceso');
    });
    expect(service.isTutorialSeen()).toBe(true);
  });

  it('si no se puede escribir no lanza', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota llena');
    });
    expect(() => service.markTutorialSeen()).not.toThrow();
  });
});
