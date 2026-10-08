import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { AppearanceService } from '../../app/appearance.service';
import { ProfileService } from '@services/account/profile.service';

// La lógica real de @chesspark/board se prueba en su propia librería; aquí se usa un
// doble para no cargar cm-chessboard (módulo ESM que Jest no resuelve).
const mockAppearance = { pieces: 'cburnett', board: 'chessboard-js' };
const mockSet = jest.fn((next: { pieces?: string; board?: string }) => {
  Object.assign(mockAppearance, Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
});
jest.mock('@chesspark/board', () => ({
  getChessboardAppearance: () => ({ ...mockAppearance }),
  setChessboardAppearance: (next: { pieces?: string; board?: string }) => mockSet(next),
  isPiecesStyle: (v: unknown) => ['cburnett', 'fantasy', 'staunty'].includes(v as string),
  isBoardStyle: (v: unknown) => ['chessboard-js', 'green', 'blue'].includes(v as string),
}));

describe('AppearanceService', () => {
  let profile$: BehaviorSubject<{ pieces?: string; board?: string } | null>;
  let requestUpdateProfile: jest.Mock;
  let service: AppearanceService;

  beforeEach(() => {
    localStorage.clear();
    mockSet.mockClear();
    Object.assign(mockAppearance, { pieces: 'cburnett', board: 'chessboard-js' });
    profile$ = new BehaviorSubject<{ pieces?: string; board?: string } | null>(null);
    requestUpdateProfile = jest.fn();

    TestBed.configureTestingModule({
      providers: [{ provide: ProfileService, useValue: { profile$, requestUpdateProfile } }],
    });
    service = TestBed.inject(AppearanceService);
  });

  it('al iniciar aplica lo guardado en el dispositivo', () => {
    localStorage.setItem('chessColate_pieces', 'fantasy');
    localStorage.setItem('chessColate_board', 'green');

    service.init();

    expect(service.pieces()).toBe('fantasy');
    expect(service.board()).toBe('green');
  });

  it('ignora valores guardados que ya no existen', () => {
    localStorage.setItem('chessColate_pieces', 'borrado');

    service.init();

    expect(service.pieces()).toBe('cburnett');
  });

  it('una elección se guarda en el dispositivo y se pide también al perfil', () => {
    service.init();

    service.setPieces('staunty');
    service.setBoard('blue');

    expect(localStorage.getItem('chessColate_pieces')).toBe('staunty');
    expect(localStorage.getItem('chessColate_board')).toBe('blue');
    expect(service.pieces()).toBe('staunty');
    expect(service.board()).toBe('blue');
    // Sin sesión, requestUpdateProfile ya ignora la llamada: no hay perfil que actualizar
    expect(requestUpdateProfile).toHaveBeenCalledWith({ pieces: 'staunty' });
    expect(requestUpdateProfile).toHaveBeenCalledWith({ board: 'blue' });
  });

  it('elegir lo que ya está elegido no hace nada', () => {
    service.init();
    mockSet.mockClear();

    service.setPieces('cburnett');

    expect(mockSet).not.toHaveBeenCalled();
    expect(requestUpdateProfile).not.toHaveBeenCalled();
  });

  it('lo que trae el perfil predomina sobre lo guardado en el dispositivo', () => {
    localStorage.setItem('chessColate_pieces', 'staunty');
    service.init();

    profile$.next({ pieces: 'fantasy', board: 'green' });

    expect(service.pieces()).toBe('fantasy');
    expect(service.board()).toBe('green');
    expect(localStorage.getItem('chessColate_pieces')).toBe('fantasy');
  });

  it('un perfil sin estilos guardados conserva la apariencia del dispositivo', () => {
    localStorage.setItem('chessColate_board', 'blue');
    service.init();

    profile$.next({});

    expect(service.board()).toBe('blue');
  });

  it('otra actualización del perfil con los mismos estilos no pisa una elección reciente', () => {
    service.init();
    profile$.next({ pieces: 'fantasy', board: 'green' });

    service.setPieces('staunty');
    // llega el perfil (p. ej. por un cambio de elo) todavía con el valor anterior
    profile$.next({ pieces: 'fantasy', board: 'green' });

    expect(service.pieces()).toBe('staunty');
  });
});
