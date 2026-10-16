import { TestBed } from '@angular/core/testing';

import { RunnerRecordService } from '@features/chess-runner/services/runner-record.service';

/** Lo único que el Chess Runner guarda en el dispositivo: el récord de distancia de una partida. */
describe('RunnerRecordService', () => {
  const CLAVE = 'chessColate_runner_best_m';
  let servicio: RunnerRecordService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(RunnerRecordService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('sin nada guardado el récord es 0', () => {
    expect(servicio.best()).toBe(0);
  });

  it('una distancia mayor es récord y se guarda', () => {
    expect(servicio.save(120)).toBe(true);

    expect(servicio.best()).toBe(120);
    expect(localStorage.getItem(CLAVE)).toBe('120');
  });

  it('una distancia menor o igual no lo cambia ni se anuncia como récord', () => {
    servicio.save(300);

    expect(servicio.save(200)).toBe(false);
    expect(servicio.save(300)).toBe(false);
    expect(servicio.best()).toBe(300);
  });

  it('se quedan los metros enteros', () => {
    servicio.save(99.9);

    expect(servicio.best()).toBe(99);
  });

  it('un cero o un valor raro no guarda nada', () => {
    expect(servicio.save(0)).toBe(false);
    expect(servicio.save(NaN)).toBe(false);
    expect(servicio.save(-5)).toBe(false);
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it('un dato guardado que no es un número se ignora', () => {
    localStorage.setItem(CLAVE, 'abc');
    expect(servicio.best()).toBe(0);

    localStorage.setItem(CLAVE, '-4');
    expect(servicio.best()).toBe(0);
  });

  it('el récord sobrevive: lo lee otra instancia', () => {
    servicio.save(450);

    expect(new RunnerRecordService().best()).toBe(450);
  });

  it('sin acceso al almacenamiento no se rompe: el juego sigue sin récord', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(servicio.best()).toBe(0);
    expect(servicio.save(100)).toBe(false);
  });
});
