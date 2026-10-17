import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppService } from '@core/app/app.service';
import { ProfileService } from '@core/account/profile.service';
import { WoodpeckerSetupComponent } from '@features/woodpecker/containers/woodpecker-setup/woodpecker-setup.component';
import { WoodpeckerSetupInput } from '@features/woodpecker/utils/woodpecker-config.util';
import { translocoParaPruebas } from '@tests/support/racha-ajustes-recordatorios';

const GRUPOS = [
  {
    groupName: 'Temas',
    themes: [
      { value: 'fork', nameEs: 'Ataque doble', nameEn: 'Fork', img: 'fork.svg' },
      { value: 'pin', nameEs: 'Clavada', nameEn: 'Pin', img: 'pin.svg' },
      { value: 'sinArchivo', nameEs: 'Sin archivo', nameEn: 'No file', img: 'x.svg' },
    ],
  },
  {
    groupName: 'Mates',
    themes: [{ value: 'mateIn2', nameEs: 'Mate en 2', nameEn: 'Mate in 2', img: 'mate.svg' }],
  },
  {
    // Todo lo suyo está fuera del catálogo: el grupo entero no debe salir
    groupName: 'Duración',
    themes: [{ value: 'short', nameEs: 'Corto', nameEn: 'Short', img: 's.svg' }],
  },
];

describe('WoodpeckerSetupComponent', () => {
  let fixture: ComponentFixture<WoodpeckerSetupComponent>;
  let setup: WoodpeckerSetupComponent;
  let perfil: { elo: number } | null;
  const emitido: WoodpeckerSetupInput[] = [];

  const el = (id: string) =>
    fixture.nativeElement.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
  const botones = (id: string) =>
    Array.from(el(id)?.querySelectorAll('button') ?? []) as HTMLButtonElement[];

  async function iniciar(entradas: Partial<WoodpeckerSetupComponent> = {}) {
    fixture = TestBed.createComponent(WoodpeckerSetupComponent);
    setup = fixture.componentInstance;
    Object.assign(setup, { availableThemes: ['fork', 'pin', 'mateIn2'], ...entradas });
    emitido.length = 0;
    setup.create.subscribe((input) => emitido.push(input));
    fixture.detectChanges();
  }

  function rango(extremo: 'min' | 'max', valor: number) {
    const entrada = el('elo')?.querySelectorAll('input[type=range]')[extremo === 'min' ? 0 : 1] as HTMLInputElement;
    entrada.value = String(valor);
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    perfil = { elo: 1500 };
    await TestBed.configureTestingModule({
      imports: [WoodpeckerSetupComponent, translocoParaPruebas()],
      providers: [
        { provide: AppService, useValue: { getThemesPuzzle: GRUPOS } },
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return perfil;
            },
          },
        },
      ],
    }).compileComponents();
  });

  describe('valores por defecto', () => {
    beforeEach(() => iniciar());

    it('100 ejercicios, 5 vueltas, mezclado y ritmo estándar', () => {
      (el('create') as HTMLButtonElement).click();

      expect(emitido).toEqual([
        {
          size: 100,
          eloMin: 1300,
          eloMax: 1700,
          themes: 'all',
          cycles: 5,
          order: 'shuffle',
          pace: 'standard',
        },
      ]);
    });

    it('el rango arranca alrededor del ELO del usuario', async () => {
      perfil = { elo: 1000 };
      await iniciar();

      expect([setup.eloMin, setup.eloMax]).toEqual([800, 1200]);
    });

    it('sin sesión usa 1500', async () => {
      perfil = null;
      await iniciar();

      expect([setup.eloMin, setup.eloMax]).toEqual([1300, 1700]);
    });

    it('avisa de cuánto lleva una vuelta según el tamaño', () => {
      expect(el('size')?.textContent).toContain('WOODPECKER.setup.size.hint');
      expect(setup.cycleMinutes).toBe(40);
      botones('size')[3].click(); // 300
      expect(setup.cycleMinutes).toBe(125);
    });
  });

  describe('tamaño', () => {
    beforeEach(() => iniciar());

    it('se elige entre los tamaños ofrecidos', () => {
      expect(botones('size').map((b) => b.textContent?.trim())).toEqual(['50', '100', '200', '300', '500']);
      botones('size')[4].click();
      fixture.detectChanges();
      (el('create') as HTMLButtonElement).click();

      expect(emitido[0].size).toBe(500);
    });

    it('marca el elegido', () => {
      botones('size')[0].click();
      fixture.detectChanges();

      expect(botones('size')[0].getAttribute('aria-pressed')).toBe('true');
      expect(botones('size')[1].getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('rango de ELO', () => {
    beforeEach(() => iniciar());

    it('mover el mínimo cambia lo que se emite', () => {
      rango('min', 1100);
      (el('create') as HTMLButtonElement).click();

      expect([emitido[0].eloMin, emitido[0].eloMax]).toEqual([1100, 1700]);
    });

    it('subir el mínimo por encima del máximo empuja el máximo', () => {
      rango('min', 1900);

      expect([setup.eloMin, setup.eloMax]).toEqual([1900, 2100]);
    });

    it('bajar el máximo por debajo del mínimo empuja el mínimo', () => {
      rango('max', 1100);

      expect([setup.eloMin, setup.eloMax]).toEqual([900, 1100]);
    });
  });

  describe('temas', () => {
    beforeEach(() => iniciar());

    it('por defecto es una mezcla variada', () => {
      expect(setup.themeMode).toBe('all');
      expect(el('themes')?.textContent).toContain('WOODPECKER.setup.themes.all');
    });

    it('solo ofrece los temas del catálogo, agrupados', () => {
      expect(setup.groups.map((g) => g.name)).toEqual(['Temas', 'Mates']);
      expect(setup.groups[0].themes.map((t) => t.value)).toEqual(['fork', 'pin']);
    });

    it('con la lista elegida sin marcar nada no deja crear el set', () => {
      setup.setThemeMode('pick');
      fixture.detectChanges();

      expect(setup.canCreate).toBe(false);
      expect((el('create') as HTMLButtonElement).disabled).toBe(true);
      expect(el('themes')?.textContent).toContain('WOODPECKER.setup.themes.none');
    });

    it('lo marcado se emite en el orden del catálogo, no en el de los clics', () => {
      setup.setThemeMode('pick');
      setup.toggleTheme('mateIn2');
      setup.toggleTheme('fork');
      fixture.detectChanges();

      (el('create') as HTMLButtonElement).click();

      expect(emitido[0].themes).toEqual(['fork', 'mateIn2']);
    });

    it('desmarcar un tema lo quita', () => {
      setup.setThemeMode('pick');
      setup.toggleTheme('fork');
      setup.toggleTheme('fork');

      expect(setup.selectedThemes.size).toBe(0);
    });

    it('vuelve a «todos» y se emite la mezcla aunque haya marcados', () => {
      setup.setThemeMode('pick');
      setup.toggleTheme('fork');
      setup.setThemeMode('all');
      fixture.detectChanges();

      (el('create') as HTMLButtonElement).click();

      expect(emitido[0].themes).toBe('all');
    });

    it('traduce el nombre del grupo si hay traducción y deja el original si no', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [
          WoodpeckerSetupComponent,
          translocoParaPruebas({ 'WOODPECKER.setup.themes.groups.Mates': 'Checkmates' }),
        ],
        providers: [
          { provide: AppService, useValue: { getThemesPuzzle: GRUPOS } },
          { provide: ProfileService, useValue: { getProfile: { elo: 1500 } } },
        ],
      }).compileComponents();
      await iniciar();

      expect(setup.groups.map((g) => g.name)).toEqual(['Temas', 'Checkmates']);
    });
  });

  describe('vueltas', () => {
    beforeEach(() => iniciar());

    it('sube y baja de una en una', () => {
      setup.changeCycles(1);
      setup.changeCycles(1);
      setup.changeCycles(-1);

      expect(setup.cycles).toBe(6);
    });

    it('no baja de 2 ni sube de 12, y los botones se deshabilitan', () => {
      setup.changeCycles(-20);
      fixture.detectChanges();
      expect(setup.cycles).toBe(2);
      expect((botones('cycles')[0] as HTMLButtonElement).disabled).toBe(true);

      setup.changeCycles(50);
      fixture.detectChanges();
      expect(setup.cycles).toBe(12);
      expect((botones('cycles')[1] as HTMLButtonElement).disabled).toBe(true);
    });

    it('enseña el número elegido', () => {
      setup.changeCycles(2);
      fixture.detectChanges();

      expect(el('cycles-value')?.textContent).toBe('7');
    });
  });

  describe('orden y ritmo', () => {
    beforeEach(() => iniciar());

    it('el orden elegido se emite', () => {
      botones('order')[2].click(); // alterno
      fixture.detectChanges();
      (el('create') as HTMLButtonElement).click();

      expect(emitido[0].order).toBe('reverse');
    });

    it('el ritmo elegido se emite', () => {
      botones('pace')[0].click(); // sin reloj
      fixture.detectChanges();
      (el('create') as HTMLButtonElement).click();

      expect(emitido[0].pace).toBe('relaxed');
    });

    it('cada ritmo con reloj enseña cómo baja el tiempo vuelta a vuelta', () => {
      expect(setup.paceSequence('standard')).toEqual([60, 48, 38, 31, 25]);
      expect(setup.paceSequence('intense')).toEqual([30, 24, 19, 15, 12]);
    });

    it('sin reloj no hay secuencia de tiempos', () => {
      expect(setup.paceSequence('relaxed')).toEqual([]);
    });

    it('con pocas vueltas la secuencia se acorta', () => {
      setup.changeCycles(-3); // 2 vueltas
      expect(setup.paceSequence('standard')).toEqual([60, 48]);
      expect(setup.paceHasMore).toBe(false);
    });

    it('con más de 5 vueltas la secuencia se corta con puntos suspensivos', () => {
      setup.changeCycles(3); // 8 vueltas
      expect(setup.paceSequence('standard')).toHaveLength(5);
      expect(setup.paceHasMore).toBe(true);
    });
  });

  describe('crear', () => {
    it('no deja crear mientras se está armando un set', async () => {
      await iniciar({ busy: true });

      (el('create') as HTMLButtonElement).click();

      expect((el('create') as HTMLButtonElement).disabled).toBe(true);
      expect(emitido).toEqual([]);
    });

    it('avisa de que el set actual se borrará si ya hay uno', async () => {
      await iniciar({ replacesExisting: true });
      expect(el('replace-notice')).not.toBeNull();
    });

    it('sin set previo no dice nada de borrar', async () => {
      await iniciar();
      expect(el('replace-notice')).toBeNull();
    });
  });
});
