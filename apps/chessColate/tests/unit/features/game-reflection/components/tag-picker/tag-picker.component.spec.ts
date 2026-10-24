import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagOption } from '@features/game-reflection/models/game-reflection.model';
import { TagPickerComponent } from '@features/game-reflection/components/tag-picker/tag-picker.component';
import { textoDe, translocoTesting } from '@tests/support/analisis-juegos';

const tactica: TagOption = { id: 'tactics', label: 'Táctica', system: true };
const finales: TagOption = { id: 'endgames', label: 'Finales', system: true };

describe('TagPickerComponent', () => {
  let fixture: ComponentFixture<TagPickerComponent>;

  const botones = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));
  const botonCon = (texto: string) => botones().find((b) => textoDe(b).includes(texto));
  const campo = (): HTMLInputElement | null => fixture.nativeElement.querySelector('input');

  function entrada(valores: Record<string, unknown>) {
    for (const [clave, valor] of Object.entries(valores)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TagPickerComponent, translocoTesting()] }).compileComponents();
    fixture = TestBed.createComponent(TagPickerComponent);
    fixture.componentRef.setInput('title', 'Lo mejor');
    fixture.componentRef.setInput('max', 2);
  });

  it('muestra el título y cuántos van de cuántos', () => {
    entrada({ selected: [tactica] });

    expect(textoDe(fixture.nativeElement)).toContain('Lo mejor');
    expect(textoDe(fixture.nativeElement)).toContain('1/2');
  });

  it('avisa del tag elegido al tocarlo en las sugerencias', () => {
    const picked = jest.fn();
    fixture.componentInstance.picked.subscribe(picked);
    entrada({ options: [tactica, finales] });

    botonCon('Finales')?.click();

    expect(picked).toHaveBeenCalledWith(finales);
  });

  it('avisa de quitar un tag elegido', () => {
    const removed = jest.fn();
    fixture.componentInstance.removed.subscribe(removed);
    entrada({ selected: [tactica] });

    botonCon('Táctica')?.click();

    expect(removed).toHaveBeenCalledWith('tactics');
  });

  it('con la lista llena no deja buscar ni elegir más', () => {
    entrada({ selected: [tactica, finales], options: [{ id: 'x', label: 'Otro', system: true }] });

    expect(campo()).toBeNull();
    expect(botonCon('Otro')).toBeUndefined();
  });

  it('emite el texto que se escribe', () => {
    const query = jest.fn();
    fixture.componentInstance.queryChange.subscribe(query);
    entrada({});

    campo()!.value = 'fin';
    campo()!.dispatchEvent(new Event('input'));

    expect(query).toHaveBeenCalledWith('fin');
  });

  it('limita el largo del texto al de un tag corto', () => {
    entrada({});

    expect(campo()!.maxLength).toBe(20);
  });

  it('ofrece crear el tag solo cuando se puede', () => {
    entrada({ query: 'Mi tag', canCreate: false });
    expect(botonCon('GAME_REFLECTION.create')).toBeUndefined();

    entrada({ canCreate: true });
    expect(botonCon('GAME_REFLECTION.create')).toBeDefined();
  });

  it('Enter crea el tag nuevo', () => {
    const created = jest.fn();
    fixture.componentInstance.created.subscribe(created);
    entrada({ query: 'Mi tag', canCreate: true });

    campo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(created).toHaveBeenCalledTimes(1);
  });

  it('Enter elige la primera sugerencia cuando el texto ya coincide con una', () => {
    const picked = jest.fn();
    fixture.componentInstance.picked.subscribe(picked);
    entrada({ query: 'tact', canCreate: false, options: [tactica] });

    campo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(picked).toHaveBeenCalledWith(tactica);
  });

  it('Enter con el campo vacío no hace nada', () => {
    const picked = jest.fn();
    fixture.componentInstance.picked.subscribe(picked);
    entrada({ query: '', options: [tactica] });

    campo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(picked).not.toHaveBeenCalled();
  });

  it('muestra pocas sugerencias a la vez', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, label: `Tag ${i}`, system: true }));
    entrada({ options: muchas });

    expect(botones().filter((b) => textoDe(b).startsWith('Tag')).length).toBe(8);
  });

  it('deshabilitado no deja tocar nada', () => {
    entrada({ selected: [tactica], options: [finales], disabled: true });

    expect(botones().every((b) => b.disabled)).toBe(true);
    expect(campo()!.disabled).toBe(true);
  });
});
