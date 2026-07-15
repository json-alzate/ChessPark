# Calificar la App (In-App Review) — Feature Document

## Concepto

Invitar al usuario a **calificar ChessColate y dejar un comentario en la Play Store** usando el flujo nativo de **In-App Review** (la tarjeta que aparece _dentro_ de la app, sin sacar al usuario a la ficha de la tienda). La clave no es "pedir la reseña por pedirla", sino **pedirla en el momento emocional correcto**: justo después de que el usuario terminó una rutina y está satisfecho — no al azar, no al primer arranque, no tras una frustración.

El principio de fondo es el **peak-end rule**: la gente califica según cómo se sintió en el punto más alto de la experiencia. Si le pedimos la reseña en el pico (acaba de completar una rutina, batió un récord, mantuvo su racha), la calificación tenderá a ser positiva y honesta. Si se la pedimos en un mal momento (falló un puzzle, se le acabó el tiempo, recién abrió la app), corremos el riesgo de reseñas negativas o de "quemar" la única oportunidad que da el sistema.

Aplica a **chessColate en Android (Play Store)** como plataforma principal. iOS (`SKStoreReviewController`) y web quedan contemplados pero fuera del alcance inicial.

---

## Objetivos

- Aumentar la **cantidad y calidad de reseñas** en la Play Store (rating promedio + volumen), que impacta directamente en la conversión de la ficha.
- Pedir la reseña **solo a usuarios genuinamente enganchados** y **en un pico emocional positivo**.
- **Cero fricción y cero riesgo de sanción**: respetar al 100% las políticas de Google (nada de incentivos, nada de gating, nada de preguntar la opinión antes de mostrar la tarjeta).
- No ser molesto: como mucho **una petición por ventana larga**, respetando las cuotas nativas.

---

## El mejor momento — recomendación

Esta es la decisión central del feature. Se compone de **dos capas**: un _gate de elegibilidad_ (¿es este usuario candidato?) y un _disparador_ (¿es este el instante?).

### Capa 1 — Gate de elegibilidad (deben cumplirse TODAS)

| Condición | Valor recomendado | Por qué |
|-----------|-------------------|---------|
| Rutinas completadas (acumuladas) | **≥ 3** | 1 rutina no basta para formar opinión; 3 demuestra enganche real sin llegar tarde. |
| Días distintos usando la app | **≥ 2** | Evita pedir reseña a alguien que instaló hace 10 minutos. |
| No estamos en la primera sesión | siempre | La primera sesión es de descubrimiento, no de juicio. |
| No se ha pedido antes en los últimos | **90 días** | Aunque el SO tiene su propia cuota, llevamos nuestro propio cooldown para no "gastar" intentos. |

### Capa 2 — Disparador (el instante)

Cuando el usuario es elegible, **NO** disparamos en cualquier rutina: esperamos el **próximo "momento de victoria"**, en este orden de preferencia:

1. **Batió un récord personal** (`isNewRecord`) — pico emocional máximo. _(ya existe en [`plan-played.component.ts`](../../apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts))_
2. **Hito de racha** (p. ej. racha de 3, 7, 14 días).
3. **Reto 333 completado** con buen resultado (`completed: true`).
4. **Rutina completada con buena precisión** / `eloDelta` positivo.

**Regla de "no dejar pasar la ventana"**: si el usuario ya es elegible pero no ocurre ningún "momento de victoria" tras **2 rutinas completadas adicionales**, disparamos igualmente al terminar la siguiente rutina (siempre que no haya sido un fracaso evidente — p. ej. no justo tras un `timeout` o precisión muy baja).

### Momento exacto en la UI

El disparo se hace en la **pantalla de resultados** de la rutina ([`plan-played.component.ts`](../../apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts)), **después** de que el usuario ve su resultado (récord, ELO ganado, etc.), con un pequeño retardo (~800 ms) para que primero disfrute el resultado y _luego_ aparezca la tarjeta. Nunca durante el juego ni de forma que interrumpa una acción.

> ### ⚠️ Importante: qué NO se puede hacer (políticas de Google)
> El In-App Review API de Google es estricto:
> - **No** preguntar al usuario su opinión antes ni durante la tarjeta ("¿Te gusta la app?", "¿Nos das 5 estrellas?"). Esto **prohíbe el clásico pre-prompt** de "¿estás disfrutando la app? Sí/No".
> - **No** incentivar (nada de "califícanos y te damos X").
> - **No** condicionar funciones de la app a que califique.
> - **No** llamar al API de forma repetida ni forzarlo: el SO decide si muestra la tarjeta o no, y **no** nos dice si el usuario calificó.
> Por eso toda la lógica de "cuándo" vive en **nuestro** código (gate + disparador), y a Google solo le pedimos `requestReview()` en el buen momento.

---

## Flujo de usuario

```
[Usuario completa una rutina]
         ↓
[Pantalla de resultados: ve su récord / ELO / racha]
         ↓
[¿Es elegible? (≥3 rutinas, ≥2 días, sin pedir en 90d)]
         │ no → nada, se registra el progreso del contador
         ↓ sí
[¿Es un "momento de victoria"? (o ya pasó la ventana de gracia)]
         │ no → esperar a la próxima rutina
         ↓ sí
[~800 ms después de mostrar el resultado]
         ↓
┌───────────────────────────────────────────────┐
│  Tarjeta nativa de Play Store (In-App Review)  │
│  ★★★★★  + campo de comentario                  │
│  (Google decide si realmente la muestra)        │
└───────────────────────────────────────────────┘
         ↓
[Marcamos "pedido" con fecha → cooldown de 90 días]
```

### Fallback manual (sin cuota)

Como el flujo nativo **puede no mostrarse** (el SO lo decide) y tiene cuota, añadimos en **Ajustes** un botón **"Califícanos ⭐"** que abre directamente la ficha de la Play Store:

```
market://details?id=com.jheison.chesscolate
(fallback web: https://play.google.com/store/apps/details?id=com.jheison.chesscolate)
```

Esta vía no tiene cuota, no está sujeta a las restricciones del API nativo y sirve para el usuario que _quiere_ calificar por iniciativa propia.

---

## Modelo de datos (local)

Persistencia local (mismo storage ya usado en la app, p. ej. `@capacitor/preferences`). No requiere backend.

```ts
interface AppReviewState {
  completedRoutines: number;      // contador acumulado de rutinas completadas
  distinctDaysUsed: number;       // días distintos con actividad
  firstUseDate: string;           // 'YYYY-MM-DD' local
  lastReviewRequestDate: string | null;  // última vez que llamamos a requestReview()
  eligibleSince: string | null;   // desde cuándo cumple el gate (para la ventana de gracia)
  routinesSinceEligible: number;  // rutinas completadas ya siendo elegible (regla de no dejar pasar la ventana)
}
```

> Nota: **no** guardamos si el usuario efectivamente calificó (el API nativo no lo informa). `lastReviewRequestDate` solo registra que _pedimos_, y eso alimenta el cooldown.

---

## Stack técnico

- **Plugin**: [`@capacitor-community/in-app-review`](https://github.com/capacitor-community/in-app-review) — envuelve el **Play In-App Review API** (Android) y `SKStoreReviewController` (iOS) con una sola llamada `requestReview()`.
- **Instalación**:
  ```bash
  npm install @capacitor-community/in-app-review
  npx cap sync
  ```
- **Web/PWA**: el plugin es no-op en web. En navegador se degrada al **fallback manual** (abrir la URL de la ficha) o simplemente se oculta la entrada.
- **Requisito Android**: el In-App Review solo funciona con la app **instalada desde Play Store** (o vía internal testing track). En debug local la tarjeta no aparece — es esperado.

### Fachada `AppReviewService`

Siguiendo el mismo principio del [AnalyticsService](../implementado/OBSERVABILITY_REFERENCIA.md): toda la lógica pasa por **una sola fachada**, los componentes nunca llaman al plugin directo.

```ts
@Injectable({ providedIn: 'root' })
export class AppReviewService {
  /** Se llama al terminar una rutina, con el contexto del resultado. */
  async maybeRequestReview(ctx: {
    isNewRecord: boolean;
    completed: boolean;
    eloDelta: number | null;
    streakMilestone?: boolean;
  }): Promise<void> {
    const state = await this.loadState();
    if (!this.isEligible(state)) return;
    if (!this.isWinningMoment(ctx) && !this.graceWindowExpired(state)) return;
    await this.delay(800);
    try { await InAppReview.requestReview(); } catch {}
    await this.markRequested(state);
    this.analytics.logEvent('app_review_requested', { trigger: /* ... */ });
  }

  /** Botón manual en Ajustes → abre la ficha de la tienda (sin cuota). */
  async openStoreListing(): Promise<void> { /* market:// | https:// */ }
}
```

### Instrumentación (analytics)

Reusar el `AnalyticsService` ya existente. Eventos sugeridos (siguen el catálogo de [OBSERVABILITY_TRACKING](../implementado/OBSERVABILITY_TRACKING.md)):

| Evento | Cuándo | Params |
|--------|--------|--------|
| `app_review_requested` | llamamos a `requestReview()` | `trigger` (`new_record`/`streak`/`reto333`/`good_routine`/`grace_window`), `completed_routines` |
| `app_review_store_opened` | usuario toca "Califícanos ⭐" en Ajustes | — |

> No podemos medir si calificó (el API no lo informa); medimos **peticiones** y **aperturas manuales**. El impacto real se observa en el volumen/rating de la Play Console.

---

## Configuración del usuario

En **Ajustes**:

- Botón **"Califícanos ⭐"** → abre la ficha de la Play Store (fallback manual, siempre disponible).

No hay toggle: el flujo automático es silencioso y de baja frecuencia por diseño, así que no necesita opción de apagado (y añadir una invitaría a apagarlo).

---

## Consideraciones UX

- **Solo en picos positivos**: nunca tras `timeout`, precisión muy baja o abandono de rutina.
- **Sin interrumpir**: la tarjeta aparece sobre la pantalla de resultados, con retardo, cuando el usuario ya "respiró" el logro.
- **Una vez y a esperar**: si se pidió, cooldown de 90 días como mínimo (encima de la cuota del propio SO).
- **Nada de trucos**: cero incentivos, cero pre-prompts, cero gating — tanto por política como por respeto al usuario.
- **Fallback digno**: el botón de Ajustes es para el fan que quiere calificar sin esperar a que la app se lo pida.

---

## Métricas de éxito

- **Volumen de reseñas** y **rating promedio** en Play Console (antes vs. después).
- Nº de `app_review_requested` disparados y su distribución por `trigger`.
- Nº de `app_review_store_opened` (interés proactivo desde Ajustes).
- (Cualitativo) Tono/estrellas de las reseñas nuevas vs. la línea base.

---

## Alcance inicial (MVP)

1. `AppReviewState` en storage local + contadores (rutinas, días, cooldown).
2. Gate de elegibilidad (≥3 rutinas, ≥2 días, cooldown 90d).
3. Disparador por "momento de victoria" (récord / reto333 / buena rutina) + ventana de gracia.
4. Llamada a `requestReview()` desde la pantalla de resultados vía `AppReviewService`.
5. Botón "Califícanos ⭐" en Ajustes (fallback a la ficha de la tienda).
6. Eventos `app_review_requested` / `app_review_store_opened`.

## Fuera de alcance inicial

- iOS (`SKStoreReviewController`) — el plugin ya lo soporta; solo falta validarlo y ajustar copy/política ATT.
- Detección de hitos de racha (si aún no existe la señal de streak) — empezar con récord + reto333 + buena rutina.
- Cualquier A/B testing del momento o del umbral de rutinas.

---

## Decisiones a alinear antes de implementar

> Siguiendo la práctica del repo de **discutir antes de implementar** los detalles de diseño/producto:

1. **Umbral de rutinas**: ¿3 es el número correcto, o prefieres 2 (más agresivo) o 5 (más conservador)?
2. **Cooldown**: 90 días propuesto — ¿lo dejamos, o lo alineamos con algún ciclo de releases?
3. **Ventana de gracia**: disparar tras 2 rutinas sin "victoria" — ¿o esperamos siempre a un pico aunque tarde más?
4. **Hitos de racha**: ¿existe ya la señal de racha para usarla como disparador, o lo dejamos para una segunda iteración?

---

## Dependencias técnicas

- `@capacitor-community/in-app-review` (agregar al proyecto).
- Storage local ya existente para `AppReviewState`.
- Hook en la pantalla de resultados de rutina ([`plan-played.component.ts`](../../apps/chessColate/src/app/pages/puzzles/containers/plan-played/plan-played.component.ts)) para llamar a `AppReviewService.maybeRequestReview(...)`.
- `AnalyticsService` existente para los eventos.
- App publicada en Play Store (o track de testing) para poder ver la tarjeta nativa en dispositivo.
</content>
</invoke>
