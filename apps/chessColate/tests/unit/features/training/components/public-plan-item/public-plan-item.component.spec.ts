import { CommonModule } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TranslocoPipe } from '@jsverse/transloco';

import { PlanInteraction, PublicPlan } from '@chesspark/models';
import { SecondsToMinutesSecondsPipe } from '@chesspark/common-utils';

import { AppService } from '@core/app/app.service';
import { ProfileService } from '@core/account/profile.service';

import { PublicPlanItemComponent } from '@features/training/components/public-plan-item/public-plan-item.component';

import {
  findButton,
  findButtonByIcon,
  iconName,
  iconNames,
  makeBlock,
  makePublicPlan,
  textOf,
  translocoModule,
} from '@tests/support/puzzles-pages';

function interaction(overrides: Partial<PlanInteraction> = {}): PlanInteraction {
  return {
    uid: 'i1',
    uidUser: 'user-1',
    planUid: 'pub-1',
    liked: false,
    played: false,
    saved: false,
    ...overrides,
  };
}

describe('PublicPlanItemComponent', () => {
  let fixture: ComponentFixture<PublicPlanItemComponent>;
  let component: PublicPlanItemComponent;
  let profile: { uid: string } | null;
  let appService: { getNameThemePuzzleByValue: jest.Mock; getThemePuzzleByValue: jest.Mock };

  async function render(plan: PublicPlan): Promise<HTMLElement> {
    fixture = TestBed.createComponent(PublicPlanItemComponent);
    component = fixture.componentInstance;
    component.plan = plan;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    profile = { uid: 'user-1' };
    appService = {
      getNameThemePuzzleByValue: jest.fn((v: string) => `Tema ${v}`),
      getThemePuzzleByValue: jest.fn((v: string) =>
        v === 'fork' ? { value: 'fork', img: 'fork.svg' } : undefined
      ),
    };

    await TestBed.configureTestingModule({
      imports: [PublicPlanItemComponent, translocoModule()],
      providers: [
        {
          provide: ProfileService,
          useValue: {
            get getProfile() {
              return profile;
            },
          },
        },
        { provide: AppService, useValue: appService },
      ],
    })
      // Sin web components de Ionic: el icono se sustituye por un elemento
      // personalizado inerte y la prueba lee su atributo `name`.
      .overrideComponent(PublicPlanItemComponent, {
        set: {
          imports: [CommonModule, TranslocoPipe, SecondsToMinutesSecondsPipe],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();
  });

  describe('datos que ve el usuario', () => {
    it('muestra el título, las veces jugado, los me gusta y el total de bloques', async () => {
      const el = await render(
        makePublicPlan({
          title: 'Mates en 1',
          timesPlayed: 12,
          likesCount: 3,
          blocks: [makeBlock(), makeBlock()],
        })
      );

      expect(textOf(el.querySelector('h3'))).toBe('Mates en 1');
      expect(textOf(el.querySelector('.collapse-title'))).toBe('PUBLIC_PLANS.viewBlocks (2)');
      const stats = textOf(el.querySelector('.text-base-content\\/70'));
      expect(stats).toContain('12');
      expect(textOf(findButton(el, '3'))).toBe('3');
    });

    it('un plan sin título muestra el texto de "sin título"', async () => {
      const el = await render(makePublicPlan({ title: undefined }));

      expect(textOf(el.querySelector('h3'))).toBe('PUBLIC_PLANS.untitled');
    });

    it('cada bloque aparece con su título propio o con "Bloque N", y su descripción solo si la tiene', async () => {
      const el = await render(
        makePublicPlan({
          blocks: [
            makeBlock({ title: 'Calentamiento', description: 'Para entrar en calor' }),
            makeBlock({ title: undefined, description: undefined }),
          ],
        })
      );

      const cards = Array.from(el.querySelectorAll('.collapse-content .card'));
      expect(cards).toHaveLength(2);
      expect(textOf(cards[0])).toContain('Calentamiento');
      expect(textOf(cards[0])).toContain('Para entrar en calor');
      expect(textOf(cards[1])).toContain('PUBLIC_PLANS.block 2');
      expect(cards[1].querySelector('.text-base-content\\/70')).toBeNull();
    });

    it('la configuración del bloque se pinta según sea por tiempo, por cantidad, ambas o sin límite', async () => {
      const el = await render(
        makePublicPlan({
          blocks: [
            makeBlock({ time: 300, puzzlesCount: 0 }),
            makeBlock({ time: -1, puzzlesCount: 10 }),
            makeBlock({ time: 120, puzzlesCount: 5 }),
            makeBlock({ time: -1, puzzlesCount: 0 }),
          ],
        })
      );

      const cards = Array.from(el.querySelectorAll('.collapse-content .card'));
      expect(textOf(cards[0])).toContain('05:00');
      expect(textOf(cards[1])).toContain('10 NEW_BLOCK.fields.puzzles');
      expect(textOf(cards[2])).toContain(
        '02:00 NEW_BLOCK.form.or 5 NEW_BLOCK.fields.puzzles'
      );
      // Sin tiempo ni cantidad solo hay el icono de infinito.
      expect(iconNames(cards[3])).toEqual(['infinite-outline']);
    });

    it('el tema aleatorio y el de debilidades usan icono propio; un tema normal usa su imagen y su nombre', async () => {
      const el = await render(
        makePublicPlan({
          blocks: [
            makeBlock({ theme: 'all' }),
            makeBlock({ theme: 'weakness' }),
            makeBlock({ theme: 'fork' }),
          ],
        })
      );

      const cards = Array.from(el.querySelectorAll('.collapse-content .card'));
      expect(iconNames(cards[0])).toEqual(['shuffle']);
      expect(textOf(cards[0])).toContain('NEW_BLOCK.theme.random');
      expect(iconNames(cards[1])).toEqual(['trending-down']);
      expect(textOf(cards[1])).toContain('NEW_BLOCK.theme.weakness');
      expect(cards[2].querySelector('img')?.getAttribute('src')).toBe(
        '/assets/images/puzzle-themes/fork.svg'
      );
      expect(textOf(cards[2])).toContain('Tema fork');
    });

    it('un tema sin catálogo no pinta icono y muestra el valor tal cual', async () => {
      appService.getNameThemePuzzleByValue.mockReturnValue('');
      const el = await render(makePublicPlan({ blocks: [makeBlock({ theme: 'raro' })] }));

      const card = el.querySelector('.collapse-content .card') as HTMLElement;
      expect(card.querySelector('img')).toBeNull();
      expect(textOf(card)).toContain('raro');
    });
  });

  describe('Jugar', () => {
    it('al pulsar Jugar emite el plan', async () => {
      const plan = makePublicPlan();
      const el = await render(plan);
      const emitted: PublicPlan[] = [];
      component.play.subscribe((p) => emitted.push(p));

      findButton(el, 'PUBLIC_PLANS.play')?.click();

      expect(emitted).toEqual([plan]);
    });
  });

  describe('Me gusta', () => {
    it('sin haber dado me gusta, pulsar emite liked=true y muestra el corazón vacío', async () => {
      const plan = makePublicPlan();
      const el = await render(plan);
      const emitted: { plan: PublicPlan; liked: boolean }[] = [];
      component.toggleLike.subscribe((e) => emitted.push(e));

      const likeButton = findButton(el, '3') as HTMLButtonElement;
      expect(iconName(likeButton.querySelector('ion-icon'))).toBe('heart-outline');
      likeButton.click();

      expect(emitted).toEqual([{ plan, liked: true }]);
    });

    it('con me gusta dado, el corazón sale lleno y pulsar emite liked=false', async () => {
      const plan = makePublicPlan({ userInteraction: interaction({ liked: true }) });
      const el = await render(plan);
      const emitted: { plan: PublicPlan; liked: boolean }[] = [];
      component.toggleLike.subscribe((e) => emitted.push(e));

      const likeButton = findButton(el, '3') as HTMLButtonElement;
      expect(iconName(likeButton.querySelector('ion-icon'))).toBe('heart');
      expect(likeButton.className).toContain('text-primary');
      likeButton.click();

      expect(emitted).toEqual([{ plan, liked: false }]);
    });

    it('el autor no puede dar me gusta a su propio plan: botón deshabilitado y sin emisión', async () => {
      profile = { uid: 'author-1' };
      const el = await render(makePublicPlan({ uidUser: 'author-1' }));
      const emitted: unknown[] = [];
      component.toggleLike.subscribe((e) => emitted.push(e));

      const likeButton = findButton(el, '3') as HTMLButtonElement;
      expect(likeButton.disabled).toBe(true);
      expect(likeButton.title).toBe('PUBLIC_PLANS.cannotLikeOwn');
      likeButton.click();
      component.onToggleLike();

      expect(emitted).toEqual([]);
    });

    it('un visitante sin sesión puede pulsar me gusta (el contenedor decide qué hacer)', async () => {
      profile = null;
      const el = await render(makePublicPlan());

      expect((findButton(el, '3') as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('Guardar', () => {
    it('sin guardar, pulsar emite saved=true y el botón queda en modo fantasma con marcador vacío', async () => {
      const plan = makePublicPlan();
      const el = await render(plan);
      const emitted: { plan: PublicPlan; saved: boolean }[] = [];
      component.toggleSaved.subscribe((e) => emitted.push(e));

      const saveButton = findButtonByIcon(el, 'bookmark') as HTMLButtonElement;
      expect(iconName(saveButton.querySelector('ion-icon'))).toBe('bookmark-outline');
      expect(saveButton.className).toContain('btn-ghost');
      // Un botón de solo icono necesita nombre y estado para los lectores de pantalla
      expect(saveButton.getAttribute('aria-label')).toBe('PUBLIC_PLANS.saveSession');
      expect(saveButton.getAttribute('aria-pressed')).toBe('false');
      saveButton.click();

      expect(emitted).toEqual([{ plan, saved: true }]);
    });

    it('guardado: el botón se resalta con marcador lleno y pulsar emite saved=false', async () => {
      const plan = makePublicPlan({ userInteraction: interaction({ saved: true }) });
      const el = await render(plan);
      const emitted: { plan: PublicPlan; saved: boolean }[] = [];
      component.toggleSaved.subscribe((e) => emitted.push(e));

      const saveButton = findButtonByIcon(el, 'bookmark') as HTMLButtonElement;
      expect(iconName(saveButton.querySelector('ion-icon'))).toBe('bookmark');
      expect(saveButton.className).toContain('btn-primary');
      expect(saveButton.getAttribute('aria-label')).toBe('PUBLIC_PLANS.unsaveSession');
      expect(saveButton.getAttribute('aria-pressed')).toBe('true');
      saveButton.click();

      expect(emitted).toEqual([{ plan, saved: false }]);
    });
  });
});
