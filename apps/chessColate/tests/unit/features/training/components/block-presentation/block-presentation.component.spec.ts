import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { BlockPresentationComponent } from '@app/features/training/components/block-presentation/block-presentation.component';

describe('BlockPresentationComponent', () => {
  let component: BlockPresentationComponent;
  let fixture: ComponentFixture<BlockPresentationComponent>;
  let modalController: { dismiss: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    modalController = { dismiss: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [BlockPresentationComponent],
      providers: [{ provide: ModalController, useValue: modalController }],
    }).compileComponents();

    fixture = TestBed.createComponent(BlockPresentationComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Mates en 2');
    fixture.componentRef.setInput('description', 'Busca el mate');
    fixture.componentRef.setInput('image', 'assets/mate.png');
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    jest.useRealTimers();
  });

  it('se crea con la cuenta regresiva en 5', () => {
    expect(component).toBeTruthy();
    expect(component.timer).toBe(5);
  });

  it('pinta el título, la descripción y la imagen del bloque', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('h1')?.textContent).toContain('Mates en 2');
    expect(el.querySelector('p')?.textContent).toContain('Busca el mate');
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('assets/mate.png');
    expect(img?.getAttribute('alt')).toBe('Mates en 2');
  });

  it('descuenta un segundo por vez sin cerrar antes de tiempo', () => {
    jest.advanceTimersByTime(3000);

    expect(component.timer).toBe(2);
    expect(modalController.dismiss).not.toHaveBeenCalled();
  });

  it('al llegar a cero cierra el modal una sola vez y detiene el reloj', () => {
    jest.advanceTimersByTime(5000);

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(10000);
    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    expect(component.timer).toBe(0);
  });

  it('el botón de empezar cierra de inmediato y cancela la cuenta regresiva', () => {
    const button = fixture.nativeElement.querySelector('ion-button') as HTMLElement;

    button.click();

    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(10000);
    expect(modalController.dismiss).toHaveBeenCalledTimes(1);
    expect(component.timer).toBe(5);
  });

  it('al destruirse deja de contar', () => {
    fixture.destroy();

    jest.advanceTimersByTime(10000);

    expect(modalController.dismiss).not.toHaveBeenCalled();
  });
});
