import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { BehaviorSubject } from 'rxjs';

import { ChessGame } from '@chesspark/models';

import { GameReflectionComponent } from '@features/game-reflection/containers/game-reflection/game-reflection.component';
import { GameReflection, GameTag } from '@features/game-reflection/models/game-reflection.model';
import { GameReflectionService } from '@features/game-reflection/services/game-reflection.service';
import { LoginComponent } from '@shared/components/login/login.component';
import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const partida = { id: 'g1', source: 'lichess', playedAt: 1, result: '1-0', userColor: 'white' } as ChessGame;

function reflexion(best: string[], improve: string[]): GameReflection {
  return { gameKey: 'lichess:g1', platform: 'lichess', playedAt: 1, outcome: 'win', best, improve, updatedAt: 1 };
}

describe('GameReflectionComponent', () => {
  let fixture: ComponentFixture<GameReflectionComponent>;
  let uid$: BehaviorSubject<string | null>;
  let modal: { present: jest.Mock };
  let modalController: { create: jest.Mock };
  let service: {
    canSave: boolean;
    uid: string | null;
    uid$: BehaviorSubject<string | null>;
    getReflection: jest.Mock;
    getTags: jest.Mock;
    saveSelection: jest.Mock;
    createTag: jest.Mock;
  };

  const texto = () => textoDe(fixture.nativeElement);
  const botonCon = (t: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      textoDe(b).includes(t)
    );
  const campos = (): HTMLInputElement[] => Array.from(fixture.nativeElement.querySelectorAll('input'));

  async function abrir(): Promise<void> {
    fixture.componentRef.setInput('game', partida);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function escribir(i: number, valor: string): Promise<void> {
    campos()[i].value = valor;
    campos()[i].dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    uid$ = new BehaviorSubject<string | null>('u1');
    modal = { present: jest.fn().mockResolvedValue(undefined) };
    modalController = { create: jest.fn().mockResolvedValue(modal) };
    service = {
      canSave: true,
      uid: 'u1',
      uid$,
      getReflection: jest.fn().mockResolvedValue(null),
      getTags: jest.fn().mockResolvedValue([]),
      saveSelection: jest.fn().mockResolvedValue(undefined),
      createTag: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [GameReflectionComponent, translocoTesting()],
      providers: [
        { provide: GameReflectionService, useValue: service },
        { provide: ModalController, useValue: modalController },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GameReflectionComponent);
  });

  it('sin sesión pide iniciarla y no lee nada', async () => {
    service.canSave = false;
    service.uid = null;
    uid$.next(null);

    await abrir();

    expect(texto()).toContain('GAME_REFLECTION.needsLogin');
    expect(service.getReflection).not.toHaveBeenCalled();
    expect(campos().length).toBe(0);
  });

  it('sin sesión ofrece iniciarla y abre el modal de inicio de sesión', async () => {
    service.canSave = false;
    service.uid = null;
    uid$.next(null);
    await abrir();

    botonCon('GAME_REFLECTION.login')!.click();
    await fixture.whenStable();

    expect(modalController.create).toHaveBeenCalledWith({
      component: LoginComponent,
      componentProps: { segmentEmailPassword: 'login' },
    });
    expect(modal.present).toHaveBeenCalled();
  });

  it('al iniciar sesión la tarjeta se renueva sola y muestra los selectores', async () => {
    service.canSave = false;
    service.uid = null;
    uid$.next(null);
    await abrir();
    expect(campos().length).toBe(0);

    service.canSave = true;
    service.uid = 'u1';
    service.getReflection.mockResolvedValue(reflexion(['dynamism'], []));
    uid$.next('u1');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).not.toContain('GAME_REFLECTION.needsLogin');
    expect(texto()).toContain('GAME_REFLECTION.systemTags.dynamism');
    expect(campos().length).toBeGreaterThan(0);
  });

  it('no vuelve a leer la partida cuando la sesión emite el mismo uid con el que ya cargó', async () => {
    await abrir();

    uid$.next('u1');
    await fixture.whenStable();

    expect(service.getReflection).toHaveBeenCalledTimes(1);
  });

  it('muestra lo que ya se anotó de la partida', async () => {
    service.getReflection.mockResolvedValue(reflexion(['dynamism'], ['tactics', 'u_1']));
    service.getTags.mockResolvedValue([{ id: 'u_1', label: 'Cambios de dama', createdAt: 1 } as GameTag]);

    await abrir();

    expect(texto()).toContain('GAME_REFLECTION.systemTags.dynamism');
    expect(texto()).toContain('GAME_REFLECTION.systemTags.tactics');
    expect(texto()).toContain('Cambios de dama');
  });

  it('guarda al elegir una sugerencia', async () => {
    await abrir();

    botonCon('GAME_REFLECTION.systemTags.dynamism')!.click();
    await fixture.whenStable();

    expect(service.saveSelection).toHaveBeenCalledWith(partida, { best: ['dynamism'], improve: [] });
  });

  it('guarda al quitar un tag', async () => {
    service.getReflection.mockResolvedValue(reflexion(['dynamism'], []));
    await abrir();

    botonCon('GAME_REFLECTION.systemTags.dynamism')!.click();
    await fixture.whenStable();

    expect(service.saveSelection).toHaveBeenCalledWith(partida, { best: [], improve: [] });
  });

  it('un tag elegido en una lista ya no se ofrece en la otra', async () => {
    service.getReflection.mockResolvedValue(reflexion(['dynamism'], []));

    await abrir();

    const sugerencias = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button.btn-soft'));
    expect(sugerencias.some((b) => textoDe(b).includes('systemTags.dynamism'))).toBe(false);
  });

  it('crea un tag propio con lo escrito y lo elige', async () => {
    service.createTag.mockResolvedValue({ id: 'u_nuevo', label: 'Mi tag', createdAt: 1 });
    await abrir();

    await escribir(1, 'Mi tag');
    botonCon('GAME_REFLECTION.create')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.createTag).toHaveBeenCalledWith('Mi tag');
    expect(service.saveSelection).toHaveBeenCalledWith(partida, { best: [], improve: ['u_nuevo'] });
    expect(texto()).toContain('Mi tag');
  });

  it('no ofrece crear un tag que ya existe con otro formato', async () => {
    service.getTags.mockResolvedValue([{ id: 'u_1', label: 'Cambios de dama', createdAt: 1 }]);
    await abrir();

    await escribir(0, 'cambios DE dama');

    expect(botonCon('GAME_REFLECTION.create')).toBeUndefined();
  });

  it('si falla el guardado vuelve a lo anterior y avisa', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    service.saveSelection.mockRejectedValue(new Error('sin red'));
    await abrir();

    botonCon('GAME_REFLECTION.systemTags.tactics')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('GAME_REFLECTION.saveFailed');
    expect(
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button.badge')).length
    ).toBe(0);
  });

  it('al cambiar de partida lee la nueva y no deja lo de la anterior', async () => {
    service.getReflection.mockResolvedValueOnce(reflexion(['dynamism'], []));
    await abrir();
    expect(texto()).toContain('systemTags.dynamism');

    service.getReflection.mockResolvedValueOnce(null);
    fixture.componentRef.setInput('game', { ...partida, id: 'g2' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getReflection).toHaveBeenCalledTimes(2);
    expect(
      Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button.badge')).length
    ).toBe(0);
  });
});
