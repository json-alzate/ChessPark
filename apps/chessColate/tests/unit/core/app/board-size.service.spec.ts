import { BoardSizeService } from '@core/app/board-size.service';

const KEY = 'chessColate_board_size';
const raiz = () => document.documentElement.style.getPropertyValue('--cc-board-size');

describe('BoardSizeService', () => {
  let service: BoardSizeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--cc-board-size');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service = new BoardSizeService();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('init', () => {
    it('sin nada guardado no publica ninguna variable: cada pantalla usa su tamaño', () => {
      service.init();

      expect(service.size()).toBeNull();
      expect(raiz()).toBe('');
    });

    it('aplica el tamaño guardado', () => {
      localStorage.setItem(KEY, '720');

      service.init();

      expect(service.size()).toBe(720);
      expect(raiz()).toBe('720px');
    });

    it('ignora un valor guardado que no sirve', () => {
      localStorage.setItem(KEY, 'enorme');

      service.init();

      expect(service.size()).toBeNull();
      expect(raiz()).toBe('');
    });

    it('si el almacenamiento falla no rompe el arranque', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('sin acceso');
      });

      expect(() => service.init()).not.toThrow();
      expect(service.size()).toBeNull();
    });
  });

  describe('set', () => {
    it('publica el tamaño al instante y lo devuelve', () => {
      expect(service.set(700)).toBe(700);
      expect(service.size()).toBe(700);
      expect(raiz()).toBe('700px');
    });

    it('mientras se arrastra no escribe en el dispositivo', () => {
      service.set(700);
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('lo acota al mínimo y al techo que le pasen', () => {
      expect(service.set(10)).toBe(320);
      expect(service.set(2000, 800)).toBe(800);
      expect(raiz()).toBe('800px');
    });
  });

  describe('save', () => {
    it('guarda el tamaño actual', () => {
      service.set(680);
      service.save();

      expect(localStorage.getItem(KEY)).toBe('680');
    });

    it('sin tamaño elegido no guarda nada', () => {
      service.save();
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('si el dispositivo no deja escribir no lanza y el tamaño sigue aplicado', () => {
      service.set(680);
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota llena');
      });

      expect(() => service.save()).not.toThrow();
      expect(service.size()).toBe(680);
    });

    it('lo guardado se recupera al arrancar de nuevo', () => {
      service.set(680);
      service.save();
      document.documentElement.style.removeProperty('--cc-board-size');

      const otro = new BoardSizeService();
      otro.init();

      expect(otro.size()).toBe(680);
      expect(raiz()).toBe('680px');
    });
  });

  describe('reset', () => {
    it('quita la variable y lo guardado: vuelve el tamaño de cada pantalla', () => {
      service.set(680);
      service.save();

      service.reset();

      expect(service.size()).toBeNull();
      expect(raiz()).toBe('');
      expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('sin tamaño elegido tampoco falla', () => {
      expect(() => service.reset()).not.toThrow();
    });
  });
});
